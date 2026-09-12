import { expect, test } from 'bun:test';
import { createIntl } from '@ccssmnn/intl';
import { messagesDe, messagesEn } from '../src/intl/messages';
import { errorMessagesFor, pushMessagesFor } from '../src/intl/server-messages';

test('every English UI key has a German translation', () => {
  expect(Object.keys(messagesDe).sort()).toEqual(Object.keys(messagesEn).sort());
  for (const value of Object.values(messagesEn)) expect(value.length).toBeGreaterThan(0);
  for (const value of Object.values(messagesDe)) expect(value.length).toBeGreaterThan(0);
});

test('server catalogs cover every key in both locales', () => {
  for (const locale of ['en', 'de'] as const) {
    expect(Object.keys(errorMessagesFor(locale)).sort()).toEqual(
      Object.keys(errorMessagesFor('en')).sort(),
    );
    expect(Object.keys(pushMessagesFor(locale)).sort()).toEqual(
      Object.keys(pushMessagesFor('en')).sort(),
    );
  }
});

test('client messages format without falling back to error keys', () => {
  for (const [locale, catalog] of [
    ['en', messagesEn],
    ['de', messagesDe],
  ] as const) {
    const messages = catalog as unknown as Record<string, string>;
    const t = createIntl(messages as typeof messagesEn, locale) as unknown as (
      key: string,
    ) => string;
    for (const key of Object.keys(messages)) {
      if (messages[key]!.includes('{$')) continue;
      expect(t(key)).not.toContain('❌');
    }
  }
});

test('plural and push messages localize', () => {
  const en = createIntl(messagesEn, 'en') as unknown as (
    key: string,
    params: Record<string, unknown>,
  ) => string;
  const de = createIntl(messagesDe, 'de') as unknown as (
    key: string,
    params: Record<string, unknown>,
  ) => string;
  expect(en('monitor.parentsOnline', { count: 1 })).toBe('one parent device online');
  expect(en('monitor.parentsOnline', { count: 2 })).toBe('2 parent devices online');
  expect(de('monitor.parentsOnline', { count: 1 })).toBe('ein Elterngerät online');
  expect(pushBody('de', 'Nursery')).toBe('Nursery hat ein Geräusch erkannt.');
  expect(pushBody('en', 'Nursery')).toBe('Nursery detected noise.');
});

function pushBody(locale: 'en' | 'de', name: string) {
  const t = createIntl(pushMessagesFor(locale), locale) as unknown as (
    key: string,
    params: Record<string, unknown>,
  ) => string;
  return t('push.noise.body', { name });
}
