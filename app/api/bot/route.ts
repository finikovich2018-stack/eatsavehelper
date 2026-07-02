import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { activatePremium } from '@/lib/premium';
import {
  hasRecoverablePremiumPayment,
  logPremiumPayment,
  markLatestPaymentActivated,
} from '@/lib/premium-payments';
import { botLocale, botMsg } from '@/lib/bot-messages';
import { isAdminTelegramId } from '@/lib/admin';
import {
  parseReplyCommand,
  resolveFeedbackUserId,
  sendAdminReplyToUser,
} from '@/lib/bot-admin-reply';
import { getFeedbackCommentUrl, parseFeedbackMessage, relayFeedbackToAdmins } from '@/lib/bot-feedback';
import { matchMenuAction, withMainMenu } from '@/lib/bot-keyboard';
import { syncUserProfile } from '@/lib/sync-user-profile';
import { getAppHomeUrl } from '@/lib/app-url';
import { getBotToken } from '@/lib/bot-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type TelegramMessageLike = Record<string, unknown>;

type TelegramUpdate = {
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string; language_code?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
  message?: TelegramMessageLike & {
    message_id?: number;
    chat?: { id: number };
    from: { id: number; first_name?: string; username?: string; language_code?: string };
    text?: string;
    caption?: string;
    reply_to_message?: {
      text?: string;
      forward_from?: { id: number };
      forward_origin?: {
        type?: string;
        sender_user?: { id: number };
      };
    };
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

// Real, user-authored content. Anything without one of these is a Telegram
// service/system event (e.g. write_access_allowed) that must not be relayed.
const USER_CONTENT_KEYS = [
  'text', 'caption', 'photo', 'document', 'voice', 'video', 'video_note',
  'audio', 'sticker', 'animation', 'contact', 'location', 'venue', 'poll',
  'dice', 'game', 'story', 'web_app_data', 'users_shared', 'chat_shared',
];

function hasUserContent(msg: TelegramMessageLike): boolean {
  return USER_CONTENT_KEYS.some((key) => msg[key] != null);
}

function checkWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  return req.headers.get('x-telegram-bot-api-secret-token') === secret;
}

async function sendMessage(
  chatId: number,
  text: string,
  extra?: Record<string, unknown>
) {
  const botToken = getBotToken();
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });
}

async function answerCallbackQuery(queryId: string, text?: string) {
  const botToken = getBotToken();
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: queryId, text, show_alert: false }),
  });
}

function feedbackChoiceMarkup(locale: ReturnType<typeof botLocale>) {
  const msg = botMsg(locale);
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: msg.writeToBot, callback_data: 'feedback:bot' }],
        [{ text: msg.openChannel, url: getFeedbackCommentUrl() }],
        [{ text: msg.openApp, web_app: { url: getAppHomeUrl() } }],
      ],
    },
  };
}

async function sendFeedbackChoiceReply(chatId: number, locale: ReturnType<typeof botLocale>) {
  const msg = botMsg(locale);
  await sendMessage(chatId, msg.feedbackChoose, {
    parse_mode: 'HTML',
    ...withMainMenu(locale),
  });
}

async function sendHelpReply(chatId: number, locale: ReturnType<typeof botLocale>) {
  const msg = botMsg(locale);
  await sendMessage(chatId, msg.help, withMainMenu(locale));
}

async function sendChannelHint(chatId: number, locale: ReturnType<typeof botLocale>) {
  const msg = botMsg(locale);
  const url = getFeedbackCommentUrl();
  await sendMessage(
    chatId,
    `${msg.feedbackChannel}\n\n<a href="${url}">${url}</a>`,
    { parse_mode: 'HTML', ...withMainMenu(locale) }
  );
}

async function sendStatusReply(
  chatId: number,
  locale: ReturnType<typeof botLocale>,
  supabase: ReturnType<typeof getSupabase>
) {
  const { data } = await supabase
    .from('users')
    .select('is_premium, notifications_enabled')
    .eq('telegram_user_id', chatId)
    .single();

  await sendMessage(
    chatId,
    botMsg(locale).status(Boolean(data?.is_premium), data?.notifications_enabled !== false),
    withMainMenu(locale)
  );
}

async function handleMenuAction(
  chatId: number,
  locale: ReturnType<typeof botLocale>,
  action: 'support' | 'channel' | 'status' | 'help',
  supabase: ReturnType<typeof getSupabase>
) {
  const msg = botMsg(locale);
  if (action === 'support') {
    await sendMessage(chatId, msg.feedbackWriteHere, withMainMenu(locale));
    return;
  }
  if (action === 'channel') {
    await sendChannelHint(chatId, locale);
    return;
  }
  if (action === 'status') {
    await sendStatusReply(chatId, locale, supabase);
    return;
  }
  await sendHelpReply(chatId, locale);
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

async function handleAdminReply(
  adminChatId: number,
  locale: ReturnType<typeof botLocale>,
  replyText: string,
  targetUserId: number | null
) {
  const msg = botMsg(locale);

  if (!targetUserId) {
    await sendMessage(adminChatId, msg.adminFeedbackHint);
    return;
  }

  if (!replyText) {
    await sendMessage(adminChatId, msg.adminFeedbackHint);
    return;
  }

  const result = await sendAdminReplyToUser(getBotToken()!, targetUserId, replyText, locale);
  if (result.ok) {
    await sendMessage(adminChatId, msg.adminReplySent(targetUserId));
  } else {
    const reason = result.description || 'unknown error';
    await sendMessage(adminChatId, msg.adminReplyFailed(reason.slice(0, 180)));
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'EatSave bot webhook is live',
    features: { feedbackChoice: true, adminReply: true, replyKeyboardMenu: true },
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  });
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
          await sendMessage(userId, botMsg(locale).premiumActivated, withMainMenu(locale));
        } catch (e) {
          console.error('activatePremium failed:', e);
          const locale = botLocale(body.message?.from?.language_code);
          await sendMessage(userId, botMsg(locale).premiumFailed, withMainMenu(locale));
        }
      } else {
        console.error('Premium payment ignored:', payment);
      }
      return NextResponse.json({ ok: true });
    }

    if (body.callback_query?.data === 'feedback:bot') {
      const query = body.callback_query;
      const chatId = query.message?.chat.id ?? query.from.id;
      const locale = botLocale(query.from.language_code);
      const msg = botMsg(locale);
      await answerCallbackQuery(query.id);
      await sendMessage(chatId, msg.feedbackWriteHere, withMainMenu(locale));
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

      await sendMessage(chatId, msg.start(firstName), withMainMenu(locale));

      return NextResponse.json({ ok: true });
    }

    if (body.message?.text) {
      const menuAction = matchMenuAction(body.message.text.trim(), botLocale(body.message.from.language_code));
      if (menuAction) {
        const chatId = body.message.from.id;
        const locale = botLocale(body.message.from.language_code);
        await handleMenuAction(chatId, locale, menuAction, supabase);
        return NextResponse.json({ ok: true });
      }
    }

    if (body.message?.text === '/subscribe') {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await supabase
        .from('users')
        .update({ notifications_enabled: true, telegram_chat_id: chatId })
        .eq('telegram_user_id', chatId);

      await sendMessage(chatId, botMsg(locale).subscribed, withMainMenu(locale));
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/unsubscribe') {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await supabase
        .from('users')
        .update({ notifications_enabled: false })
        .eq('telegram_user_id', chatId);

      await sendMessage(chatId, botMsg(locale).unsubscribed, withMainMenu(locale));
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/activate') {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      const msg = botMsg(locale);
      try {
        const canRecover = await hasRecoverablePremiumPayment(supabase, chatId);
        if (!canRecover) {
          await sendMessage(chatId, msg.activateFail, withMainMenu(locale));
          return NextResponse.json({ ok: true });
        }
        await activatePremium(chatId);
        await markLatestPaymentActivated(supabase, chatId);
        await sendMessage(chatId, msg.activateOk, withMainMenu(locale));
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error('Manual activate failed:', e);
        await sendMessage(chatId, `${msg.activateFail}\n\n${errMsg.slice(0, 120)}`, withMainMenu(locale));
      }
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/status') {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await sendStatusReply(chatId, locale, supabase);
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/help' || body.message?.text?.startsWith('/help@')) {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await sendHelpReply(chatId, locale);
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/feedback' || body.message?.text?.startsWith('/feedback@')) {
      const chatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      await sendFeedbackChoiceReply(chatId, locale);
      return NextResponse.json({ ok: true });
    }

    if (body.message?.from && isAdminTelegramId(body.message.from.id) && body.message.text) {
      const adminChatId = body.message.from.id;
      const locale = botLocale(body.message.from.language_code);
      const replyCmd = parseReplyCommand(body.message.text.trim());

      if (replyCmd) {
        await handleAdminReply(adminChatId, locale, replyCmd.body, replyCmd.userId);
        return NextResponse.json({ ok: true });
      }
    }

    if (body.message?.from && body.message.message_id) {
      const from = body.message.from;
      const chatId = from.id;
      const locale = botLocale(from.language_code);
      const msg = botMsg(locale);
      const text = body.message.text?.trim() || '';

      // Ignore Telegram service events (e.g. write_access_allowed sent when a
      // user grants the bot permission to message them) — they are not feedback.
      if (!hasUserContent(body.message as TelegramMessageLike)) {
        return NextResponse.json({ ok: true });
      }

      if (text.startsWith('/') && !text.match(/^\/reply(?:@\w+)?\s/i)) {
        await sendFeedbackChoiceReply(chatId, locale);
        return NextResponse.json({ ok: true });
      }

      if (isAdminTelegramId(from.id)) {
        const targetUserId = resolveFeedbackUserId(body.message.reply_to_message);
        if (targetUserId) {
          await handleAdminReply(chatId, locale, text, targetUserId);
        } else {
          await sendMessage(chatId, msg.adminFeedbackHint);
        }
        return NextResponse.json({ ok: true });
      }

      const relayed = await relayFeedbackToAdmins(
        BOT_TOKEN,
        body.message.chat?.id ?? chatId,
        body.message.message_id,
        from,
        parseFeedbackMessage(body.message as TelegramMessageLike),
        body.message as TelegramMessageLike
      );

      if (relayed) {
        await sendMessage(chatId, msg.feedbackReceived, withMainMenu(locale));
      } else {
        await sendMessage(chatId, msg.feedbackNoAdmin, withMainMenu(locale));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Bot webhook error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
