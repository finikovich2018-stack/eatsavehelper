export interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN: string;
  RATE_LIMIT: KVNamespace;
}

import { CLAUDE_MODEL } from '@/lib/constants';

const FREE_DAILY_LIMIT = 10;
const PREMIUM_DAILY_LIMIT = 200;
const MODEL = CLAUDE_MODEL;

function corsHeaders(origin: string, allowedOrigin: string) {
  const allowOrigin = origin === allowedOrigin ? origin : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function checkRateLimit(
  kv: KVNamespace,
  userId: string,
  isPremium: boolean
): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}_${today}`;
  const limit = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;

  const current = Number(await kv.get(key)) || 0;
  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(key, String(current + 1), { expirationTtl: 86_400 });
  return { allowed: true, remaining: limit - current - 1 };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST' || new URL(request.url).pathname !== '/claude') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json<{
        messages: Array<{ role: string; content: unknown }>;
        max_tokens?: number;
        userId?: string | number;
        isPremium?: boolean;
      }>();

      const userId = String(body.userId || 'anonymous');
      const rate = await checkRateLimit(env.RATE_LIMIT, userId, Boolean(body.isPremium));

      if (!rate.allowed) {
        return new Response(
          JSON.stringify({ error: 'rate_limit', remaining: 0 }),
          { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: body.max_tokens || 1500,
          messages: body.messages,
        }),
      });

      const anthropicData = await anthropicRes.json();

      if (!anthropicRes.ok) {
        return new Response(JSON.stringify({ error: 'claude_error', details: anthropicData }), {
          status: anthropicRes.status,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      const text = (anthropicData.content || [])
        .filter((block: { type: string }) => block.type === 'text')
        .map((block: { text: string }) => block.text)
        .join('');

      return new Response(JSON.stringify({ text, remaining: rate.remaining }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Worker error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  },
};
