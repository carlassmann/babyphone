import { createIntlForReact } from '@ccssmnn/intl/react';
import { messagesEn } from './messages';

export const { IntlProvider, useIntl, T, useLocale } = createIntlForReact(messagesEn, 'en');
