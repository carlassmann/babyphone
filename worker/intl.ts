import { createIntl } from '@ccssmnn/intl';
import {
  errorMessagesFor,
  pushMessagesFor,
  type ServerErrorKey,
  type ServerPushKey,
} from '../src/intl/server-messages';
import { isLocale, type Locale } from '../src/intl/locale';

export type { ServerErrorKey, ServerPushKey };

export function serverLocale(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

type ErrorTranslator = (key: ServerErrorKey) => string;
type PushTranslator = (key: ServerPushKey, params: Record<string, unknown>) => string;

const errorTranslators = new Map<Locale, ErrorTranslator>();
const pushTranslators = new Map<Locale, PushTranslator>();

export function serverError(locale: Locale): ErrorTranslator {
  let translator = errorTranslators.get(locale);
  if (!translator) {
    translator = createIntl(errorMessagesFor(locale), locale) as unknown as ErrorTranslator;
    errorTranslators.set(locale, translator);
  }
  return translator;
}

export function serverPush(locale: Locale): PushTranslator {
  let translator = pushTranslators.get(locale);
  if (!translator) {
    translator = createIntl(pushMessagesFor(locale), locale) as unknown as PushTranslator;
    pushTranslators.set(locale, translator);
  }
  return translator;
}
