import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  getInitDataAuthAgeSeconds,
  parseLaunchAuthFromSources,
  parseLaunchAuthFromUrl,
  parseUserFromInitData,
} from '@/lib/telegram-launch-params';
import { verifyTelegramInitData } from '@/lib/telegram';

const TEST_USER = {
  id: 279058397,
  first_name: 'Vladislav',
  last_name: 'Koa',
  username: 'VladislavKoa',
  language_code: 'ru',
};

function signInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('telegram-launch-params', () => {
  it('parses user from initData string', () => {
    const initData = `user=${encodeURIComponent(JSON.stringify(TEST_USER))}&auth_date=1662771648`;
    expect(parseUserFromInitData(initData)).toMatchObject({
      id: TEST_USER.id,
      first_name: TEST_USER.first_name,
    });
  });

  it('parses tgWebAppData from hash URL', () => {
    const initData = `user=${encodeURIComponent(JSON.stringify({ id: 42, first_name: 'Test' }))}&auth_date=1700000000&hash=abc`;
    const url = `https://example.com/home#tgWebAppVersion=7.2&tgWebAppData=${encodeURIComponent(initData)}`;
    const parsed = parseLaunchAuthFromUrl(url);
    expect(parsed?.user.id).toBe(42);
    expect(parsed?.initData).toContain('auth_date=1700000000');
  });

  it('falls back to navigation URL when hash is empty', () => {
    const initData = `user=${encodeURIComponent(JSON.stringify({ id: 7, first_name: 'Nav' }))}&auth_date=1700000001`;
    const navUrl = `https://example.com/home?tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=7.2`;
    const parsed = parseLaunchAuthFromSources(['https://example.com/home', '', '', navUrl]);
    expect(parsed?.user.first_name).toBe('Nav');
  });

  it('computes auth age in seconds', () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = `auth_date=${now - 120}&user=${encodeURIComponent(JSON.stringify({ id: 1, first_name: 'A' }))}`;
    const age = getInitDataAuthAgeSeconds(initData);
    expect(age).toBeGreaterThanOrEqual(119);
    expect(age).toBeLessThanOrEqual(121);
  });
});

describe('verifyTelegramInitData', () => {
  it('accepts a correctly signed initData payload', () => {
    const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    const initData = signInitData(
      {
        auth_date: '1662771648',
        query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
        user: JSON.stringify(TEST_USER),
      },
      botToken
    );

    expect(verifyTelegramInitData(initData, botToken)).toBe(true);
    expect(verifyTelegramInitData(initData, 'wrong-token')).toBe(false);
  });
});
