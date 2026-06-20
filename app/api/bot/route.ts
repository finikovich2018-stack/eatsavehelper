import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { activatePremium } from '@/lib/premium';
import {
  hasRecoverablePremiumPayment,
  logPremiumPayment,
  markLatestPaymentActivated,
} from '@/lib/premium-payments';
import { botLocale, botMsg } from '@/lib/bot-messages';
import { FEEDBACK_CHANNEL_URL } from '@/lib/constants';
import { syncUserProfile } from '@/lib/sync-user-profile';
import { getAppHomeUrl } from '@/lib/app-url';
import { getBotToken } from '@/lib/bot-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type TelegramUpdate = {
  message?: {
    from: { id: number; first_name?: string; username?: string; language_code?: string };
    text?: string;
    successful_payment?: {
      invoice_payload: string;
      currency: string;
      total_amount: number;
      telegram_payment_charge_id?: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    invoice_payload: string;
  };
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function checkWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  return req.headers.get('x-telegram-bot-api-secret-token') === secret;
}

async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  const botToken = getBotToken();
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });
}

function feedbackReplyMarkup(locale: ReturnType<typeof botLocale>) {
  const msg = botMsg(locale);
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: msg.openChannel, url: FEEDBACK_CHANNEL_URL }],
        [{ text: msg.openApp, web_app: { url: getAppHomeUrl() } }],
      ],
    },
  };
}

async function sendFeedbackChannelReply(chatId: number, locale: ReturnType<typeof botLocale>) {
  const msg = botMsg(locale);
  await sendMessage(chatId, msg.feedbackChannel, feedbackReplyMarkup(locale));
}

async function sendHelpReply(chatId: number, locale: ReturnType<typeof botLocale>) {
  const msg = botMsg(locale);
  await sendMessage(chatId, msg.help, feedbackReplyMarkup(locale));
}

async function answerPreCheckout(queryId: string, ok: boolean, errorMessage?: string) {
  const botToken = getBotToken();
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pre_checkout_query_id: queryId,
      ok,
      error_message: errorMessage,
    }),
  });
}

function parsePremiumUserId(payload: string): number | null {
  if (!payload.startsWith('premium_')) return null;
  const id = Number(payload.replace('premium_', ''));
  return Number.isFinite(id) ? id : null;
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'EatSave bot webhook is live' });
}

export async function POST(req: NextRequest) {
  if (!checkWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const BOT_TOKEN = getBotToken();

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  try {
    const body = (await req.json()) as TelegramUpdate;

    if (body.pre_checkout_query) {
      const { id, invoice_payload } = body.pre_checkout_query;
      const userId = parsePremiumUserId(invoice_payload);

      if (!userId) {
        await answerPreCheckout(id, false, 'Некорректный платёж');
        return NextResponse.json({ ok: true });
      }

      await answerPreCheckout(id, true);
      return NextResponse.json({ ok: true });
    }

    const payment = body.message?.successful_payment;
    if (payment) {
      const userId =
        parsePremiumUserId(payment.invoice_payload) ?? body.message?.from?.id ?? null;

      if (userId && payment.currency === 'XTR') {
        try {
          await logPremiumPayment(supabase, {
            telegramUserId: userId,
            amount: payment.total_amount,
            currency: payment.currency,
            invoicePayload: payment.invoice_payload,
            chargeId: payment.telegram_payment_charge_id,
          });
          await activatePremium(userId);
          await markLatestPaymentActivated(supabase, userId);
          const locale = botLocale(body.message?.from?.language_code);
          await sendMessage(userId, botMsg(locale).premiumActivated);
        } catch (e) {
          console.error('activatePremium failed:', e);
          const locale = botLocale(body.message?.from?.language_code);
          await sendMessage(userId, botMsg(locale).premiumFailed);
        }
      } else {
        console.error('Premium payment ignored:', payment);
      }
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text?.startsWith('/start')) {
      const from = body.message.from;
      const chatId = from.id;
      const firstName = from.first_name || '';
      const username = from.username;
      const locale = botLocale(from.language_code);
      const msg = botMsg(locale);
      const startPayload = body.message.text.split(/\s+/)[1] || '';

      await supabase.from('users').upsert(
        {
          telegram_user_id: chatId,
          telegram_chat_id: chatId,
          notifications_enabled: true,
        },
        { onConflict: 'telegram_user_id' }
      );

      await syncUserProfile(supabase, chatId, {
        first_name: firstName,
        username: username || null,
      });

      if (startPayload.startsWith('join_')) {
        await sendMessage(chatId, msg.familyInviteOpen, {
          reply_markup: {
            inline_keyboard: [[
              {
                text: msg.openApp,
                url: `https://t.me/EatSavehelper_bot?startapp=${startPayload}`,
              },
            ]],
          },
        });
        return NextResponse.json({ ok: true });
      }

      if (startPayload.startsWith('ref_')) {
        await sendMessage(chatId, msg.referralInviteOpen, {
          reply_markup: {
            inline_keyboard: [[
              {
                text: msg.openApp,
                url: `https://t.me/EatSavehelper_bot?startapp=${startPayload}`,
              },
            ]],
          },
        });
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, msg.start(firstName), {
        reply_markup: {
          inline_keyboard: [[{ text: msg.openApp, web_app: { url: getAppHomeUrl() } }]],
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/subscribe') {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await supabase
        .from('users')
        .update({ notifications_enabled: true, telegram_chat_id: chatId })
        .eq('telegram_user_id', chatId);

      await sendMessage(chatId, botMsg(locale).subscribed);
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/unsubscribe') {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await supabase
        .from('users')
        .update({ notifications_enabled: false })
        .eq('telegram_user_id', chatId);

      await sendMessage(chatId, botMsg(locale).unsubscribed);
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/activate') {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      const msg = botMsg(locale);
      try {
        const canRecover = await hasRecoverablePremiumPayment(supabase, chatId);
        if (!canRecover) {
          await sendMessage(chatId, msg.activateFail);
          return NextResponse.json({ ok: true });
        }
        await activatePremium(chatId);
        await markLatestPaymentActivated(supabase, chatId);
        await sendMessage(chatId, msg.activateOk);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error('Manual activate failed:', e);
        await sendMessage(chatId, `${msg.activateFail}\n\n${errMsg.slice(0, 120)}`);
      }
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/status') {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      const { data } = await supabase
        .from('users')
        .select('is_premium, notifications_enabled')
        .eq('telegram_user_id', chatId)
        .single();

      await sendMessage(
        chatId,
        botMsg(locale).status(Boolean(data?.is_premium), data?.notifications_enabled !== false)
      );
      return NextResponse.json({ ok: true });
    }

    if (
      body.message?.text === '/help' ||
      body.message?.text?.startsWith('/help@') ||
      body.message?.text === '/feedback' ||
      body.message?.text?.startsWith('/feedback@')
    ) {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await sendHelpReply(chatId, locale);
      return NextResponse.json({ ok: true });
    }

    if (body.message?.from) {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await sendFeedbackChannelReply(chatId, locale);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Bot webhook error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
