/** Islamic greeting + translation + familiar hello + name. */
export function greetingWithName(name: string, locale: 'ru' | 'en' = 'ru'): string {
  if (locale === 'en') {
    return `As-salamu alaykum (peace be upon you). Hi, ${name}!`;
  }
  return `Ассаляму алейкум (мир вам). Привет, ${name}!`;
}
