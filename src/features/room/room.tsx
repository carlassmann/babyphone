import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet } from '@tanstack/react-router';
import { RoomConnection, request, type ConnectionStatus } from '../../connection';
import { AudioCalls, type AudioStatus } from './lib/audio-calls';
import { BabyAudio } from './lib/baby-audio';
import { enableNotifications, usePwa } from '../../pwa';
import { useScreenWake } from '../../useScreenWake';
import { errorMessage } from '../../format';
import type { Alert, PublicDevice, Session } from '../../protocol';
import { RoomHeader } from './parts/room-header';
import {
  ConnectionNotice,
  ConnectionSummary,
  ErrorNotice,
  EventNotice,
} from './parts/room-notices';
import { DeviceSettingsModal, InvitationModal } from './parts/room-modals';
import { RoomProvider } from './room-context';
import { SENSITIVITY_THRESHOLDS } from '../../noise';
import { recentEvent } from './lib/recent-event';
import { useIntl } from '../../intl/setup';

const AUDIO_ACTIVE_STATUSES: AudioStatus[] = ['connecting', 'live', 'paused'];
const RECENT_EVENT_MS = 60_000;
export function Room({
  session,
  save,
  pwa,
  preferences,
  roomSwitcher,
  updateSession,
}: {
  session: Session;
  save: (value: Session | null) => void;
  pwa: ReturnType<typeof usePwa>;
  preferences: ReactNode;
  roomSwitcher: ReactNode;
  updateSession: (session: Session) => void;
}) {
  const t = useIntl();
  const [devices, setDevices] = useState<PublicDevice[]>([]);
  const [events, setEvents] = useState<Alert[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>('Connecting');
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [awake, setAwake] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState('');
  const [copied, setCopied] = useState('');
  const [audioStatuses, setAudioStatuses] = useState<Record<string, AudioStatus>>({});
  const listeningTo = Object.values(audioStatuses).some((status) =>
    AUDIO_ACTIVE_STATUSES.includes(status),
  );
  const [push, setPush] = useState(false);
  const [pushTest, setPushTest] = useState('');
  const [dismissedEventsThrough, setDismissedEventsThrough] = useState(0);
  const [sensitivity, setSensitivity] = useState(2);
  const [dim, setDim] = useState(() => localStorage.getItem('pip-dim') === 'true');
  useEffect(() => {
    pwa.setUpdateBlocked(active || listeningTo);
    return () => pwa.setUpdateBlocked(false);
  }, [active, listeningTo, pwa.setUpdateBlocked]);
  const connectionRef = useRef<RoomConnection>(null);
  const babyRef = useRef<BabyAudio>(null);
  const callsRef = useRef<AudioCalls>(null);
  const stateRef = useRef({ monitoring: false, level: 0 });
  const audioRef = useRef<HTMLDivElement>(null);
  const isBaby = session.role === 'baby';
  const connected = connection === 'Connected';
  const [invitation, setInvitation] = useState(session.roomKey);
  const [accessNotice, setAccessNotice] = useState('');
  async function manageAccess(target?: string) {
    setBusy(true);
    setError('');
    try {
      await request(target ? 'remove-device' : 'reset-invitation', {
        ...session,
        target,
      });
      setCopied('');
      setAccessNotice(target ? t('room.deviceRemoved') : t('room.invitationReset'));
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const parentAwake = useScreenWake(!isBaby);
  useEffect(() => {
    document.documentElement.dataset.dim = String(dim);
    localStorage.setItem('pip-dim', String(dim));
    return () => {
      delete document.documentElement.dataset.dim;
    };
  }, [dim]);
  async function changeSensitivity(target: string, value: number) {
    try {
      await request('sensitivity', { ...session, target, sensitivity: value });
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  async function toggleMute(target: string) {
    const device = devices.find(({ id }) => id === target);
    try {
      await request('mute', {
        ...session,
        target,
        muted: !device?.mutedBy.includes(session.deviceId),
      });
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  async function clearEvents() {
    try {
      await request('clear-events', session);
    } catch (error) {
      setError(errorMessage(error));
    }
  }

  useEffect(() => {
    const baby = (babyRef.current = new BabyAudio(
      (value) => {
        stateRef.current.level = value;
        setLevel(value);
      },
      () => connectionRef.current?.send({ type: 'noise' }),
      (text) => {
        stateRef.current.monitoring = false;
        setActive(false);
        setError(text);
        callsRef.current?.stop();
        connectionRef.current?.send({ type: 'heartbeat', monitoring: false, level: 0 });
      },
      setAwake,
    ));
    const calls = (callsRef.current = new AudioCalls(
      (target, payload) => connectionRef.current?.send({ type: 'signal', target, payload }),
      () => baby.stream,
      audioRef.current!,
      (status, target) => {
        setAudioStatuses((current) => (target ? { ...current, [target]: status } : {}));
      },
      session,
    ));
    let signals = Promise.resolve();
    let knownDevices: string[] = [];
    const room = (connectionRef.current = new RoomConnection(
      session,
      (data) => {
        if (data.type === 'state') {
          const ids = data.devices.map((device) => device.id);
          for (const id of knownDevices) if (!ids.includes(id)) calls.stop(id);
          knownDevices = ids;
          if (data.roomKey) setInvitation(data.roomKey);

          setDevices(data.devices);
          setEvents(data.events);
          const own = data.devices.find((device) => device.id === session.deviceId);
          if (own) {
            updateSession({
              ...session,
              name: own.name,
              roomName: data.roomName || session.roomName,
              roomKey: data.roomKey || session.roomKey,
            });
            setSensitivity(own.sensitivity);
            baby.threshold = SENSITIVITY_THRESHOLDS[own.sensitivity - 1]!;
          }
        }
        if (data.type === 'error') setError(data.message);
        if (data.type === 'signal')
          signals = signals
            .then(() => calls.receive(data.source, data.payload))
            .catch((error) => {
              calls.stop(data.source);
              setError(errorMessage(error));
            });
      },
      (status) => {
        setConnection(status);
        if (status !== 'Connected') calls.stop();
        if (
          status === 'Open in another tab' ||
          status === 'Access removed' ||
          status === 'Room inactive'
        ) {
          baby.stop();
          stateRef.current.monitoring = false;
          setActive(false);
        }
      },
      () => stateRef.current,
    ));
    const pageHide = () => {
      baby.stop();
      calls.stop();
      setActive(false);
      stateRef.current.monitoring = false;
      room.send({ type: 'heartbeat', monitoring: false, level: 0 });
    };
    window.addEventListener('pagehide', pageHide);
    return () => {
      pageHide();
      calls.stop();
      room.close();
      window.removeEventListener('pagehide', pageHide);
    };
  }, [session.deviceId, isBaby, updateSession]);
  useEffect(() => {
    if (!connected || isBaby) return;
    let cancelled = false;
    void navigator.serviceWorker?.ready
      .then(async (reg) => {
        const sub = await reg.pushManager?.getSubscription();
        if (cancelled || !sub) return;
        await request('subscription', { ...session, subscription: sub.toJSON() });
        if (!cancelled) setPush(true);
      })
      .catch(() => {
        if (!cancelled) setPush(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, isBaby, session.deviceId]);
  async function toggleMonitoring() {
    setError('');
    if (active) {
      babyRef.current?.stop();
      callsRef.current?.stop();
      stateRef.current.monitoring = false;
      setActive(false);
      connectionRef.current?.send({ type: 'heartbeat', monitoring: false, level: 0 });
      return;
    }
    setBusy(true);
    try {
      await babyRef.current?.start();
      if (babyRef.current?.stream) {
        stateRef.current.monitoring = true;
        setActive(true);
        connectionRef.current?.send({ type: 'heartbeat', monitoring: true, level: 0 });
      }
    } catch (error) {
      babyRef.current?.stop();
      setError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? t('room.micBlocked')
          : errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }
  async function notify() {
    setError('');
    setBusy(true);
    try {
      await enableNotifications(session);
      setPush(true);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function testNotification() {
    setBusy(true);
    setError('');
    setPushTest('');
    try {
      await request('test-push', session);
      setPushTest(t('settings.notificationsAccepted'));
    } catch (error) {
      setPush(false);
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function changeRole() {
    setBusy(true);
    try {
      await request('role', { ...session, role: isBaby ? 'parent' : 'baby' });
      save({ ...session, role: isBaby ? 'parent' : 'baby' });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    try {
      if (connection !== 'Access removed') await request('leave', session);
      save(null);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setError(t('common.copyUnavailable'));
    }
  }

  function listenTo(deviceId: string) {
    void callsRef.current?.listen(deviceId).catch((error) => {
      callsRef.current?.stop(deviceId);
      setError(errorMessage(error));
    });
  }

  function resumeAudio(deviceId: string) {
    void callsRef.current?.resume(deviceId).catch((error) => setError(errorMessage(error)));
  }
  const babies = devices.filter((device) => device.role === 'baby');
  const mutedBabies = babies
    .filter((device) => device.mutedBy.includes(session.deviceId))
    .map((device) => device.id);
  const latestEvent = recentEvent(
    events.filter((event) => !mutedBabies.includes(event.deviceId)),
    dismissedEventsThrough,
    Date.now(),
    RECENT_EVENT_MS,
  );
  const parents = devices.filter((device) => device.role === 'parent' && device.online);
  return (
    <main className="room">
      <div ref={audioRef} hidden />
      <RoomHeader
        roomName={session.roomName}
        roomSwitcher={roomSwitcher}
        onInvite={() => setModal('invite')}
      />
      <div className="room-scroll">
        <div className="room-content">
          <ConnectionSummary
            connected={connected}
            connection={connection}
            deviceName={session.name}
            parentAwake={!isBaby && parentAwake}
          />
          <div className="room-alerts">
            {!isBaby && connected && !parentAwake && (
              <p className="notice" data-testid="wake-lock-notice">
                {t('room.screenWakeUnavailable')}
              </p>
            )}
            {!connected && <ConnectionNotice connection={connection} />}
            {error && <ErrorNotice error={error} onDismiss={() => setError('')} />}
            {!isBaby && connected && latestEvent && (
              <EventNotice
                event={latestEvent}
                onDismiss={() => setDismissedEventsThrough(latestEvent.at)}
              />
            )}
          </div>
          <RoomProvider
            value={{
              accessNotice,
              active,
              audioStatuses,
              awake,
              babies,
              busy,
              connected,
              devices,
              dimmed: dim,
              events,
              isBaby,
              level,
              mutedBabies,
              parents,
              preferences,
              pushEnabled: push,
              pushTestMessage: pushTest,
              sensitivity,
              session,
              changeSensitivity,
              clearEvents,
              enableNotifications: notify,
              listenTo,
              openInvitation: () => setModal('invite'),
              openSettings: () => setModal('settings'),
              removeDevice: (deviceId) => void manageAccess(deviceId),
              resumeAudio,
              stopListening: (deviceId) => callsRef.current?.stop(deviceId),
              testNotification,
              toggleDim: () => setDim(!dim),
              toggleMute,
              toggleMonitoring,
            }}
          >
            <div className="room-grid">
              <Outlet />
            </div>
          </RoomProvider>
          {pwa.error && <p className="notice">{pwa.error}</p>}
        </div>
      </div>
      {modal === 'invite' && (
        <InvitationModal
          accessNotice={accessNotice}
          busy={busy}
          connected={connected}
          copied={copied}
          invitation={invitation}
          isBaby={isBaby}
          onClose={() => setModal('')}
          onCopy={(value, label) => void copy(value, label)}
          onReset={() => void manageAccess()}
        />
      )}
      {modal === 'settings' && (
        <DeviceSettingsModal
          busy={busy}
          session={session}
          onChangeRole={() => void changeRole()}
          onClose={() => setModal('')}
          onLeave={() => void leave()}
        />
      )}
    </main>
  );
}
