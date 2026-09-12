import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { IntlProvider } from './setup';
import { messagesDe } from './messages';
import { readLocale, storeLocale, type Locale } from './locale';
import { translate } from './standalone';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale);
  const setLocale = useCallback((next: Locale) => {
    storeLocale(next);
    setLocaleState(next);
  }, []);
  useEffect(() => {
    const t = translate(locale);
    document.documentElement.lang = locale;
    document.title = t('app.title');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('app.description'));
  }, [locale]);
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {locale === 'de' ? (
        <IntlProvider messages={messagesDe} locale="de">
          {children}
        </IntlProvider>
      ) : (
        <IntlProvider>{children}</IntlProvider>
      )}
    </LocaleContext.Provider>
  );
}

export function useLocalePreference() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('Locale context unavailable');
  return value;
}
