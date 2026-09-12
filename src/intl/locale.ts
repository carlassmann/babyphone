export type Locale = 'en' | 'de';

export const LOCALES: Locale[] = ['en', 'de'];

const STORAGE_KEY = 'pip-locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'de';
}

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return preferred.some((language) => language?.toLowerCase().startsWith('de')) ? 'de' : 'en';
}

export function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {}
  return detectLocale();
}

export function storeLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
}
