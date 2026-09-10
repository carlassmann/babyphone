import type { Alert } from '../../../protocol';

export function recentEvent(
  events: Alert[],
  dismissedThrough: number,
  now: number,
  lifetime: number,
) {
  return events.find((event) => event.at > dismissedThrough && now - event.at < lifetime);
}
