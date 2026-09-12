import { useIntl, useLocale } from './intl/setup';
import { useLocalePreference } from './intl/provider';
import { isLocale } from './intl/locale';

export function LanguageSelect({ showLabel = true }: { showLabel?: boolean }) {
  const t = useIntl();
  const locale = useLocale();
  const { setLocale } = useLocalePreference();

  return (
    <label className="language-select">
      {showLabel ? <span className="caption">{t('language.label')}</span> : null}
      <select
        data-testid="language-select"
        aria-label={t('language.label')}
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        <option value="en">{t('language.name.en')}</option>
        <option value="de">{t('language.name.de')}</option>
      </select>
    </label>
  );
}
