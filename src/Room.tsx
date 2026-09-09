import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link as RouteLink, Outlet } from '@tanstack/react-router';
import {
  ArrowRight,
  AudioLines,
  Bell,
  Check,
  ChevronRight,
  Copy,
  Headphones,
  Link,
  Mic,
  Moon,
  Pause,
  Plus,
  Settings,
  Smartphone,
  Sun,
  Wifi,
  X,
} from 'lucide-react';
import { RoomConnection, request } from './connection';
import { AudioCalls, BabyAudio } from './media';
import { enableNotifications, usePwa } from './pwa';
import { Modal } from './Modal';
import { InvitationQr } from './InvitationQr';
import { useScreenWake } from './useScreenWake';
import { message, relative } from './format';
import type { Alert, PublicDevice, Session } from './protocol';
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
  const [devices, setDevices] = useState<PublicDevice[]>([]);
  const [events, setEvents] = useState<Alert[]>([]);
  const [connection, setConnection] = useState('Connecting');
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [awake, setAwake] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState('');
  const [copied, setCopied] = useState('');
  const [audioStatuses, setAudioStatuses] = useState<Record<string, string>>({});
  const listeningTo = Object.values(audioStatuses).some((status) =>
    ['Listening live', 'Connecting audio', 'Tap Resume audio to hear your baby.'].includes(status),
  );
  const [push, setPush] = useState(false);
  const [pushTest, setPushTest] = useState('');
  const [dismissedEvent, setDismissedEvent] = useState('');
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
      setAccessNotice(
        target
          ? 'Device removed. Previous invitation links no longer work.'
          : 'Invitation reset. Previous links no longer work.',
      );
    } catch (error) {
      setError(message(error));
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
      setError(message(error));
    }
  }
  async function clearEvents() {
    try {
      await request('clear-events', session);
    } catch (error) {
      setError(message(error));
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
            baby.threshold = [0.16, 0.08, 0.035][own.sensitivity - 1]!;
          }
        }
        if (data.type === 'error') setError(data.message);
        if (data.type === 'signal')
          signals = signals
            .then(() => calls.receive(data.source, data.payload))
            .catch((error) => {
              calls.stop(data.source);
              setError(message(error));
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
          ? 'Microphone access is blocked. Allow it in browser settings, then try again.'
          : message(error),
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
      setError(message(error));
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
      setPushTest('Accepted by the push service. Check this device for the test notification.');
    } catch (error) {
      setPush(false);
      setError(message(error));
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
      setError(message(error));
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
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setError('Copy is unavailable. Select and copy the invitation code below.');
    }
  }
  const latestEvent = events.find(
    (event) => event.id !== dismissedEvent && Date.now() - event.at < 60000,
  );
  const babies = devices.filter((device) => device.role === 'baby');
  const parents = devices.filter((device) => device.role === 'parent' && device.online);
  return (
    <main className="room">
      <div ref={audioRef} hidden />
      <header className="room-header">
        <RouteLink to="/app" className="room-brand" aria-label="Pip home">
          <img src="/icon.svg" alt="" />
        </RouteLink>
        <h1 aria-label={session.roomName}>{roomSwitcher}</h1>
        <nav className="room-navigation" aria-label="Room navigation">
          {(
            [
              ['/app', 'Monitor', Headphones],
              ['/app/activity', 'Activity', AudioLines],
              ['/app/settings', 'Settings', Settings],
            ] as const
          ).map(([to, label, Icon]) => (
            <RouteLink key={to} to={to} activeOptions={{ exact: true }}>
              <Icon size={19} />
              <span>{label}</span>
            </RouteLink>
          ))}
        </nav>
        <div className="room-tools">
          <button
            className="icon-button"
            aria-label={dim ? 'Brighten screen' : 'Dim screen'}
            aria-pressed={dim}
            onClick={() => setDim(!dim)}
          >
            {dim ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="secondary small"
            aria-label="Invite device"
            onClick={() => setModal('invite')}
          >
            <Plus size={17} />
            <span>Invite device</span>
          </button>
        </div>
      </header>
      <div className="room-scroll">
        <div className="connection-summary">
          <span className={`status ${connected ? 'green' : 'amber'}`}>
            <i />
            {connection}
          </span>
          <span>{session.name}</span>
          {!isBaby && parentAwake && (
            <span className="wake-status">
              <Sun size={15} />
              Screen staying awake
            </span>
          )}
        </div>
        {!isBaby && !parentAwake && (
          <p className="notice">
            Screen wake lock unavailable. Keep this screen awake manually while listening.
          </p>
        )}
        {!connected && (
          <p role="alert" className="notice">
            <Wifi size={19} />
            {connection === 'Access removed'
              ? 'Your access to this room was removed. Leave this room and ask for a new invitation.'
              : connection === 'Open in another tab'
                ? 'This device is open in another tab. Close this tab or reload to use Pip here.'
                : 'Connection unavailable. Monitoring alerts cannot reach you. Check your baby and your connection; Pip is reconnecting.'}
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
            <span>{error}</span>
            <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </p>
        )}
        {!isBaby && latestEvent && (
          <div
            className={`notice ${latestEvent.kind === 'noise' ? 'sound-notice' : ''}`}
            role="alert"
          >
            <Bell size={19} />
            <span>
              <strong>
                {latestEvent.kind === 'noise'
                  ? 'Noise detected'
                  : latestEvent.kind === 'paused'
                    ? 'Monitoring paused'
                    : 'Baby device disconnected'}
              </strong>
              <br />
              {latestEvent.name}
              {latestEvent.kind === 'offline'
                ? ' lost its connection. Check on your baby.'
                : latestEvent.kind === 'noise'
                  ? ' picked up a sustained sound.'
                  : ' stopped monitoring.'}
            </span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setDismissedEvent(latestEvent.id)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <RoomViews.Provider
          value={{
            monitor: (
              <section className="monitor-panel">
                {isBaby ? (
                  <>
                    <div className="monitor-hero">
                      <img src="/pip-sleeping.png" alt="Pip sleeping" />
                      <span className={`status ${active && connected ? 'green' : ''}`}>
                        <i />
                        {active
                          ? connected
                            ? 'Monitoring'
                            : 'Monitoring locally only'
                          : 'Ready when you are'}
                      </span>
                      <h2>{active ? 'Monitoring sound' : 'Ready to monitor'}</h2>
                      <p>
                        {active
                          ? 'Listening for sustained sounds in this room.'
                          : 'Place this device near your baby, out of reach.'}
                      </p>
                    </div>
                    <div className="meter-wrap">
                      <div>
                        <span>Room sound</span>
                        <span>
                          {active ? (level > 0.08 ? 'A little sound' : 'Quiet') : 'Microphone off'}
                        </span>
                      </div>
                      <Meter value={active ? level : 0} />
                    </div>
                    <button
                      className={`primary full ${active ? 'stop' : ''}`}
                      disabled={busy || (!active && !connected)}
                      onClick={() => void toggleMonitoring()}
                    >
                      {active ? <Pause size={19} /> : <Mic size={19} />}{' '}
                      {busy
                        ? 'Opening microphone…'
                        : active
                          ? 'Pause monitoring'
                          : 'Start monitoring'}
                    </button>
                    <div className="baby-checks">
                      <span>
                        <Mic size={15} />
                        {active ? 'Microphone on' : 'Microphone off'}
                      </span>
                      <span>
                        <Sun size={15} />
                        {awake ? 'Screen staying awake' : 'Screen wake lock off'}
                      </span>
                      <span>
                        <Headphones size={15} />
                        {parents.length} parent {parents.length === 1 ? 'device' : 'devices'} online
                      </span>
                    </div>
                    {active && !awake && (
                      <p className="notice">
                        Keep the screen awake manually. Automatic screen wake lock is unavailable.
                      </p>
                    )}
                    <div className="sensitivity">
                      <label htmlFor="sensitivity">
                        Sound sensitivity <span>{['Low', 'Medium', 'High'][sensitivity - 1]}</span>
                      </label>
                      <input
                        id="sensitivity"
                        type="range"
                        min="1"
                        max="3"
                        step="1"
                        value={sensitivity}
                        onChange={(e) =>
                          void changeSensitivity(session.deviceId, Number(e.target.value))
                        }
                      />
                      <p className="caption">
                        Alerts after 1.5 seconds of sound, with 20 seconds between alerts.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {babies.length === 0 ? (
                      <div className="empty-nest">
                        <img src="/pip-sleeping.png" alt="Pip waiting for a baby device" />
                        <h2>Add your baby device</h2>
                        <p>
                          Add a device to stay with your baby.
                          <br />
                          Open the invitation on the phone that stays in the nursery.
                        </p>
                        <button className="primary" onClick={() => setModal('invite')}>
                          Invite a baby device <ArrowRight size={18} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="device-list">
                          {babies.map((device) => (
                            <article className="device-card" key={device.id}>
                              <div className="device-heading">
                                <div className="device-icon">
                                  <Moon size={25} />
                                </div>
                                <div>
                                  <h3>{device.name}</h3>
                                  <span
                                    className={`status ${device.monitoring && connected ? 'green' : 'amber'}`}
                                  >
                                    <i />
                                    {!connected
                                      ? 'Connection unknown'
                                      : !device.online
                                        ? 'Offline · check device'
                                        : device.monitoring
                                          ? 'Monitoring'
                                          : 'Monitoring paused'}
                                  </span>
                                </div>
                              </div>
                              <Meter value={device.monitoring && connected ? device.level : 0} />
                              <div className="sensitivity">
                                <label htmlFor={'sensitivity-' + device.id}>
                                  Sound sensitivity{' '}
                                  <span>{['Low', 'Medium', 'High'][device.sensitivity - 1]}</span>
                                </label>
                                <input
                                  id={'sensitivity-' + device.id}
                                  aria-label={device.name + ' sound sensitivity'}
                                  type="range"
                                  min="1"
                                  max="3"
                                  step="1"
                                  disabled={!connected}
                                  value={device.sensitivity}
                                  onChange={(event) =>
                                    void changeSensitivity(device.id, Number(event.target.value))
                                  }
                                />
                              </div>
                              <div className="device-bottom">
                                <span className="caption">
                                  {device.lastNoise
                                    ? `Last sound ${relative(device.lastNoise)}`
                                    : 'No sounds detected yet'}
                                </span>
                                {audioStatuses[device.id] &&
                                [
                                  'Listening live',
                                  'Connecting audio',
                                  'Tap Resume audio to hear your baby.',
                                ].includes(audioStatuses[device.id] || '') ? (
                                  <button
                                    className="secondary small"
                                    onClick={() => callsRef.current?.stop(device.id)}
                                  >
                                    <Pause size={16} /> Stop listening
                                  </button>
                                ) : (
                                  <button
                                    className="primary small"
                                    disabled={!connected || !device.monitoring}
                                    onClick={() =>
                                      void callsRef.current?.listen(device.id).catch((error) => {
                                        callsRef.current?.stop(device.id);
                                        setError(message(error));
                                      })
                                    }
                                  >
                                    <Headphones size={17} /> Listen
                                  </button>
                                )}
                              </div>
                              {audioStatuses[device.id] && (
                                <div className="audio-status" role="status">
                                  <AudioLines size={16} />
                                  {audioStatuses[device.id]}
                                  {audioStatuses[device.id]?.includes('Resume') && (
                                    <button
                                      onClick={() =>
                                        void callsRef.current
                                          ?.resume(device.id)
                                          .catch((error) => setError(message(error)))
                                      }
                                    >
                                      Resume audio
                                    </button>
                                  )}
                                </div>
                              )}
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            ),
            activity: (
              <section className="side-card activity">
                <div className="section-heading">
                  <h3>Activity</h3>
                  <span className="caption">Last 24 hours</span>
                  {!isBaby && events.length > 0 && (
                    <button className="quiet small" onClick={() => void clearEvents()}>
                      Clear activity
                    </button>
                  )}
                </div>
                {events.length ? (
                  <div className="event-list">
                    {events.map((event) => (
                      <div className="event" key={event.id}>
                        <span className={`event-icon ${event.kind !== 'noise' ? 'warning' : ''}`}>
                          {event.kind === 'noise' ? <AudioLines size={16} /> : <Wifi size={16} />}
                        </span>
                        <div>
                          <strong>
                            {event.kind === 'noise'
                              ? 'A little sound'
                              : event.kind === 'paused'
                                ? 'Monitoring paused'
                                : 'Device disconnected'}
                          </strong>
                          <span>{event.name}</span>
                        </div>
                        <time>
                          {new Date(event.at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-events">
                    <p>
                      No activity yet.
                      <br />
                      Sound and connection events appear here.
                    </p>
                  </div>
                )}
              </section>
            ),
            settings: (
              <>
                {!isBaby && (
                  <section className="side-card">
                    <h3>Room</h3>
                    <RenameField
                      label="Room name"
                      value={session.roomName}
                      save={(name) => request('rename-room', { ...session, name })}
                    />
                  </section>
                )}
                <section className="side-card connection-card">
                  <div className="section-icon">
                    <Bell size={21} />
                  </div>
                  <h3>{isBaby ? 'Device setup' : 'Notifications'}</h3>
                  {isBaby ? (
                    <>
                      <p>Keep this device plugged in, with Pip open in the foreground.</p>
                      <div className="check-row">
                        <Check size={16} /> Volume is analyzed here
                      </div>
                      <div className="check-row">
                        <Check size={16} /> No audio is saved
                      </div>
                      <div className="check-row">
                        <Check size={16} /> Parents can listen anytime
                      </div>
                    </>
                  ) : (
                    <>
                      <p>
                        Get a notification for sustained noise or a disconnected baby device, even
                        when Pip is in the background.
                      </p>
                      <button
                        className={push ? 'secondary full small' : 'primary full small'}
                        disabled={busy || push || !connected}
                        onClick={() => void notify()}
                      >
                        {push ? <Check size={16} /> : <Bell size={16} />}{' '}
                        {push ? 'Notifications enabled' : 'Enable notifications'}
                      </button>
                      {push && (
                        <button
                          className="quiet full small"
                          disabled={busy}
                          onClick={() => void testNotification()}
                        >
                          Test notification <ArrowRight size={15} />
                        </button>
                      )}
                      {pushTest && (
                        <p className="caption" role="status">
                          {pushTest}
                        </p>
                      )}
                      <p className="caption">
                        Allow notifications in your device settings too. On iPhone, install Pip
                        first. Notifications can be delayed by your device or network.
                      </p>
                    </>
                  )}
                </section>

                <button className="secondary full" onClick={() => setModal('settings')}>
                  <Smartphone size={18} /> Manage this device
                </button>
                {preferences}
              </>
            ),
          }}
        >
          <div className="room-grid">
            <Outlet />
          </div>
        </RoomViews.Provider>
        {pwa.error && <p className="notice">{pwa.error}</p>}
      </div>
      {modal && (
        <Modal
          title={modal === 'invite' ? 'Invite a device' : 'Device settings'}
          close={() => setModal('')}
        >
          {modal === 'invite' ? (
            <>
              <p>
                Choose Me on the joining device to listen, or Baby for the device that stays in the
                nursery.
              </p>
              <InvitationQr key={invitation} code={invitation} />
              <label>
                Private invitation code
                <input
                  className="invitation-code"
                  readOnly
                  value={invitation}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <div className="invite-actions">
                <button
                  className="primary full"
                  onClick={() =>
                    void copy(`${location.origin}/app/join#join=${invitation}`, 'link')
                  }
                >
                  {copied === 'link' ? <Check size={17} /> : <Link size={17} />}{' '}
                  {copied === 'link' ? 'Link copied' : 'Copy invite link'}
                </button>
                <button className="secondary full" onClick={() => void copy(invitation, 'code')}>
                  <Copy size={16} />
                  {copied === 'code' ? 'Code copied' : 'Copy code'}
                </button>
              </div>
              <p className="caption">Anyone with this invitation can join. Share it privately.</p>
              {!isBaby && (
                <button
                  className="secondary full"
                  disabled={busy || !connected}
                  onClick={() => void manageAccess()}
                >
                  Reset invitation link
                </button>
              )}
              {accessNotice && (
                <p role="status" className="caption">
                  {accessNotice}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="setting-detail">
                <Smartphone />
                <div>
                  <strong>{session.name}</strong>
                  <p>{isBaby ? 'Baby device' : 'Parent device'}</p>
                </div>
              </div>
              <RenameField
                label="Device name"
                value={session.name}
                save={(name) => request('rename-device', { ...session, name })}
              />
              <button className="secondary full" disabled={busy} onClick={() => void changeRole()}>
                Switch to {isBaby ? 'parent' : 'baby'} device
                <ChevronRight size={17} />
              </button>
              <p className="caption">Switching roles pauses monitoring and stops live audio.</p>
              {!isBaby && (
                <>
                  <hr />
                  <h3>Room access</h3>
                  <p className="caption">
                    Any parent can remove devices. Removal also resets the invitation link. Existing
                    devices stay connected.
                  </p>
                  {devices
                    .filter((device) => device.id !== session.deviceId)
                    .map((device) => (
                      <div className="setting-detail" key={device.id}>
                        <div>
                          <RenameField
                            label={'Name for ' + device.name}
                            value={device.name}
                            save={(name) =>
                              request('rename-device', { ...session, name, target: device.id })
                            }
                          />
                          <p>
                            {device.role === 'baby' ? 'Baby' : 'Parent'} ·{' '}
                            {device.online ? 'Online' : 'Offline'}
                          </p>
                        </div>
                        <button
                          className="quiet danger"
                          disabled={busy || !connected}
                          onClick={() => void manageAccess(device.id)}
                          aria-label={`Remove ${device.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  {accessNotice && (
                    <p role="status" className="caption">
                      {accessNotice}
                    </p>
                  )}
                </>
              )}
              <hr />
              <button className="quiet danger" disabled={busy} onClick={() => void leave()}>
                Leave this room <ArrowRight size={16} />
              </button>
              <p className="caption">You’ll need the invitation code to join again.</p>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}
function Meter({ value }: { value: number }) {
  return (
    <div
      className="meter"
      role="meter"
      aria-label="Audio level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(value * 400, 100))}
    >
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className={i < value * 144 ? 'lit' : ''}
          style={{ height: `${10 + Math.sin(i * 0.65) ** 2 * 17}px` }}
        />
      ))}
    </div>
  );
}

const RoomViews = createContext<Record<'monitor' | 'activity' | 'settings', ReactNode> | null>(
  null,
);
function useRoomView(view: 'monitor' | 'activity' | 'settings') {
  const views = useContext(RoomViews);
  if (!views) throw new Error('Join a room before opening its pages');
  return views[view];
}
export function MonitorPage() {
  return useRoomView('monitor');
}
export function ActivityPage() {
  return useRoomView('activity');
}
export function SettingsPage() {
  return useRoomView('settings');
}

function RenameField({
  label,
  value,
  save,
}: {
  label: string;
  value: string;
  save: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setName(value), [value]);
  return (
    <form
      className="rename-field"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          await save(name.trim());
        } catch (error) {
          setError(message(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {label}
        <input
          required
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button className="secondary small" disabled={busy || !name.trim() || name.trim() === value}>
        Save
      </button>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
    </form>
  );
}
