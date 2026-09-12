import { translate } from './intl/standalone';

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : translate()('common.error.generic');
}
export function relativeTime(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  return seconds < 60
    ? translate()('common.relative.seconds', { seconds })
    : translate()('common.relative.minutes', { minutes: Math.floor(seconds / 60) });
}
