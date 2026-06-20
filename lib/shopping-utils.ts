/** Ingredients in recipe that are not matched by anything in the fridge */
export function findMissingIngredients(
  recipeIngredients: string[],
  fridgeNames: string[]
): string[] {
  const normalizedFridge = fridgeNames.map((n) => n.toLowerCase().trim());

  return recipeIngredients.filter((ing) => {
    const lower = ing.toLowerCase().trim();
    return !normalizedFridge.some(
      (fn) => fn.includes(lower) || lower.includes(fn) || fn.split(/\s+/)[0] === lower.split(/\s+/)[0]
    );
  });
}

/** Default expiry date N days from today (YYYY-MM-DD) */
export function defaultExpiryDate(daysFromNow = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}
