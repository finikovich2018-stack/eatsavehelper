/** Returns true if user has active Premium subscription */
export function isPremiumActive(user: {
  is_premium?: boolean | null;
  premium_until?: string | null;
}): boolean {
  if (!user.is_premium) return false;
  if (!user.premium_until) return true;
  return new Date(user.premium_until) > new Date();
}

/** Own Premium or family owner Premium (via effective_premium flag from API). */
export function hasPremiumAccess(user: {
  is_premium?: boolean | null;
  premium_until?: string | null;
  effective_premium?: boolean | null;
}): boolean {
  return isPremiumActive(user) || Boolean(user.effective_premium);
}

/** Normalize user row: expire premium if past due */
export function normalizeUser<T extends {
  is_premium?: boolean | null;
  premium_until?: string | null;
}>(user: T): T {
  if (user.is_premium && user.premium_until && new Date(user.premium_until) <= new Date()) {
    return { ...user, is_premium: false };
  }
  return user;
}
