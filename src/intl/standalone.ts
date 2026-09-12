import { createIntl } from '@ccssmnn/intl';
import { catalogs, messagesEn, type MessageKey } from './messages';
import { readLocale, type Locale } from './locale';

export type Translate = (key: MessageKey, params?: Record<string, unknown>) => string;

const translators = new Map<Locale, Translate>();

export function translate(locale: Locale = readLocale()): Translate {
  let translator = translators.get(locale);
  if (!translator) {
    const catalog = catalogs[locale] as unknown as typeof messagesEn;
    translator = createIntl(catalog, locale) as unknown as Translate;
    translators.set(locale, translator);
  }
  return translator;
}
