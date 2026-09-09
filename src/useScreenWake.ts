import { useEffect, useState } from 'react';

export function useScreenWake(enabled: boolean) {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let pending = false;
    let lock: WakeLockSentinel | undefined;
    let retry: ReturnType<typeof setTimeout>;
    const acquire = async () => {
      if (
        disposed ||
        pending ||
        (lock && !lock.released) ||
        document.visibilityState !== 'visible' ||
        !navigator.wakeLock
      )
        return;
      pending = true;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (disposed) {
          await next.release();
          return;
        }
        lock = next;
        setAwake(true);
        next.addEventListener('release', () => {
          setAwake(false);
          if (!disposed) retry = setTimeout(() => void acquire(), 1000);
        });
      } catch {
        setAwake(false);
      } finally {
        pending = false;
      }
    };
    const visible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', visible);
    document.addEventListener('pointerdown', visible);
    window.addEventListener('focus', visible);
    void acquire();
    return () => {
      disposed = true;
      clearTimeout(retry);
      document.removeEventListener('visibilitychange', visible);
      document.removeEventListener('pointerdown', visible);
      window.removeEventListener('focus', visible);
      void lock?.release();
      setAwake(false);
    };
  }, [enabled]);
  return awake;
}
