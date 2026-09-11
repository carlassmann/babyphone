import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { request } from './connection';
import type { Session } from './protocol';
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

const SERVICE_WORKER_READY_TIMEOUT_MS = 8_000;
const PUSH_CONFIG_TIMEOUT_MS = 8_000;
const PUSH_SUBSCRIPTION_TIMEOUT_MS = 12_000;

export function usePwa() {
  const [prompt, setPrompt] = useState<InstallPrompt>();
  const [waiting, setWaiting] = useState<ServiceWorker>();
  const [installed, setInstalled] = useState(
    matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [error, setError] = useState('');
  const [updateBlocked, setUpdateBlocked] = useState(false);
  const blockedRef = useRef(false);
  blockedRef.current = updateBlocked;
  const update = useCallback(() => {
    if (!waiting || blockedRef.current) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
      once: true,
    });
    waiting.postMessage({ type: 'ACTIVATE' });
  }, [waiting]);
  useEffect(() => {
    if (!waiting) return;
    toast('Pip update available', {
      id: 'pip-update',
      duration: Infinity,
      description: updateBlocked ? 'Pause monitoring and listening before updating.' : undefined,
      action: updateBlocked ? undefined : { label: 'Update', onClick: update },
    });
    return () => {
      toast.dismiss('pip-update');
    };
  }, [waiting, updateBlocked, update]);
  useEffect(() => {
    const install = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(undefined);
    };
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', complete);
    let registration: ServiceWorkerRegistration | undefined;
    let cancelled = false;
    const check = () => {
      if (document.visibilityState === 'visible') void registration?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (cancelled) return;
          registration = reg;
          if (reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (!cancelled && worker.state === 'installed' && navigator.serviceWorker.controller)
                setWaiting(worker);
            });
          });
          check();
        })
        .catch(() => setError('Offline installation is unavailable. Reload while connected.'));
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);
  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      toast.dismiss('pip-install');
    }
    setPrompt(undefined);
  }, [prompt]);
  return {
    installed,
    waiting,
    error,
    canInstall: !!prompt,
    install,
    update,
    setUpdateBlocked,
  };
}
export async function enableNotifications(session: Session) {
  if (!('Notification' in window) || !('PushManager' in window))
    throw new Error(
      'On iPhone or iPad, add Pip to your Home Screen, then open it there to enable alerts.',
    );
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error(
      'Notifications are blocked. Allow them in your browser or device settings, then try again.',
    );
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Installation is still getting ready. Reload and try again.')),
        SERVICE_WORKER_READY_TIMEOUT_MS,
      ),
    ),
  ]);
  const response = await fetch('/api/config', {
    signal: AbortSignal.timeout(PUSH_CONFIG_TIMEOUT_MS),
  });
  const { pushKey } = await response.json();
  if (!pushKey) throw new Error('Push notifications are not configured on this server.');
  const existing = await registration.pushManager.getSubscription();
  const existingKey = existing?.options.applicationServerKey;
  const key = Uint8Array.from(atob(pushKey.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
    char.charCodeAt(0),
  );
  const reusable =
    existingKey &&
    existingKey.byteLength === key.length &&
    new Uint8Array(existingKey).every((byte, index) => byte === key[index]);
  if (existing && !reusable) await existing.unsubscribe();
  const subscription =
    existing && reusable
      ? existing
      : await withTimeout(
          registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }),
          PUSH_SUBSCRIPTION_TIMEOUT_MS,
        );
  await request('subscription', { ...session, subscription: subscription.toJSON() });
}

async function withTimeout<T>(operation: Promise<T>, duration: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error('Notification setup timed out. Check your connection and try again.')),
          duration,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
