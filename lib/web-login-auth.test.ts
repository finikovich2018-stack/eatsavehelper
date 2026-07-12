import { describe, expect, it, beforeAll } from 'vitest';
import crypto from 'crypto';

const TEST_BOT_TOKEN = '123456:AAFakeTestTokenForUnitTestsOnly000000';

beforeAll(() => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
});

function signLoginWidgetPayload(fields: Record<string, string | number>) {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(TEST_BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return hash;
}

describe('verifyTelegramLoginWidget', () => {
  it('accepts a correctly signed payload', async () => {
    const { verifyTelegramLoginWidget } = await import('@/lib/telegram-login-verify');
    const auth_date = Math.floor(Date.now() / 1000);
    const fields = { id: 42, first_name: 'Test', auth_date };
    const hash = signLoginWidgetPayload(fields);

    expect(verifyTelegramLoginWidget({ ...fields, hash })).toBe(true);
  });

  it('rejects a tampered payload (wrong id, stale hash)', async () => {
    const { verifyTelegramLoginWidget } = await import('@/lib/telegram-login-verify');
    const auth_date = Math.floor(Date.now() / 1000);
    const fields = { id: 42, first_name: 'Test', auth_date };
    const hash = signLoginWidgetPayload(fields);

    // Attacker changes the id after the hash was computed for id=42.
    expect(verifyTelegramLoginWidget({ id: 999, first_name: 'Test', auth_date, hash })).toBe(false);
  });

  it('rejects a stale login attempt (auth_date > 24h old)', async () => {
    const { verifyTelegramLoginWidget } = await import('@/lib/telegram-login-verify');
    const auth_date = Math.floor(Date.now() / 1000) - 90_000; // > 24h ago
    const fields = { id: 42, first_name: 'Test', auth_date };
    const hash = signLoginWidgetPayload(fields);

    expect(verifyTelegramLoginWidget({ ...fields, hash })).toBe(false);
  });
});

describe('mintSyntheticInitData / verifyTelegramInitData round-trip', () => {
  it('mints an initData string that the existing Mini App verifier accepts', async () => {
    const { mintSyntheticInitData } = await import('@/lib/synthetic-session');
    const { verifyTelegramInitData, parseTelegramUser } = await import('@/lib/telegram');

    const initData = mintSyntheticInitData({ id: 7, first_name: 'Web User' });

    expect(verifyTelegramInitData(initData, TEST_BOT_TOKEN)).toBe(true);
    expect(parseTelegramUser(initData)?.id).toBe(7);
  });

  it('produces initData that fails verification under a different bot token', async () => {
    const { mintSyntheticInitData } = await import('@/lib/synthetic-session');
    const { verifyTelegramInitData } = await import('@/lib/telegram');

    const initData = mintSyntheticInitData({ id: 7, first_name: 'Web User' });
    expect(verifyTelegramInitData(initData, '999999:SomeOtherToken')).toBe(false);
  });
});
