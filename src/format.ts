export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}
export function relative(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
}
