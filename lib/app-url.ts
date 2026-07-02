/** Base URL of the deployed app (no trailing slash, no path). */
export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://eatsavehelper-m6hl.vercel.app' : '');
  return raw.replace(/\/$/, '').replace(/\/home$/, '');
}

export function getAppHomeUrl(): string {
  return `${getAppBaseUrl()}/home`;
}

export function getAppShoppingUrl(): string {
  return `${getAppBaseUrl()}/shopping`;
}
