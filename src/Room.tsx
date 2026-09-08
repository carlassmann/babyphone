import { useEffect, useRef, useState } from 'react';
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
  ShieldCheck,
  Smartphone,
  Sun,
  Wifi,
  X,
} from 'lucide-react';
import { RoomConnection, request } from './connection';
import { AudioCalls, BabyAudio } from './media';
import { enableNotifications, usePwa } from './pwa';
import { Modal } from './Modal';
import { message, relative } from './format';
import type { Alert, PublicDevice, Session } from './protocol';
export function Room({
  session,
  save,
  pwa,
}: {
  session: Session;
  save: (value: Session | null) => void;
  pwa: ReturnType<typeof usePwa>;
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
  const [audioStatus, setAudioStatus] = useState('');
  const [listeningTo, setListeningTo] = useState('');
  const [push, setPush] = useState(false);
  const [pushTest, setPushTest] = useState('');
  const [dismissedEvent, setDismissedEvent] = useState('');
  const [sensitivity, setSensitivity] = useState(2);
  const [dim, setDim] = useState(false);
  const [view, setView] = useState('monitor');
  const connectionRef = useRef<RoomConnection>(null);
  const babyRef = useRef<BabyAudio>(null);
  const callsRef = useRef<AudioCalls>(null);
  const stateRef = useRef({ monitoring: false, level: 0 });
  const audioRef = useRef<HTMLAudioElement>(null);
  const isBaby = session.role === 'baby';
  const connected = connection === 'Connected';
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
        setAudioStatus(status);
        setListeningTo(target || '');
      },
    ));
    let signals = Promise.resolve();
    const room = (connectionRef.current = new RoomConnection(
      session,
      (data) => {
        if (data.type === 'state') {
          setDevices(data.devices);
          setEvents(data.events);
        }
        if (data.type === 'error') setError(data.message);
        if (data.type === 'signal')
          signals = signals
            .then(() => calls.receive(data.source, data.payload))
            .catch((error) => {
              calls.stop();
              setError(message(error));
            });
      },
      (status) => {
        setConnection(status);
        if (status !== 'Connected') calls.stop();
        if (status === 'Open in another tab') {
          baby.stop();
          stateRef.current.monitoring = false;
          setActive(false);
        }
      },
      () => stateRef.current,
    ));
    void navigator.serviceWorker?.ready
      .then(async (reg) => {
        const sub = await reg.pushManager?.getSubscription();
        if (sub && !isBaby) {
          await request('subscription', { ...session, subscription: sub.toJSON() });
          setPush(true);
        }
      })
      .catch(() => setPush(false));
    const pageHide = () => {
      baby.stop();
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
  }, [session, isBaby]);
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
      await request('leave', session);
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
    <main className={`room ${dim ? 'dimmed' : ''}`}>
      <audio ref={audioRef} autoPlay playsInline />
      <div className="room-heading">
        <div>
          <div className="eyebrow">{isBaby ? 'BABY DEVICE' : 'PARENT DEVICE'}</div>
          <h1>{session.roomName}</h1>
        </div>
        <div className="room-tools">
          <button className="secondary small" onClick={() => setModal('invite')}>
            <Plus size={17} /> Invite device
          </button>
          <button
            className="icon-button"
            aria-label="Room settings"
            onClick={() => setModal('settings')}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
      <div className="room-status">
        <span className={`status ${connected ? 'green' : 'amber'}`}>
          <i />
          {connection}
        </span>
        <span>
          <Smartphone size={14} />
          {session.name} · {isBaby ? 'Baby device' : 'Parent device'}
        </span>
      </div>
      {!connected && (
        <p role="alert" className="notice">
          <Wifi size={19} />
          {connection === 'Open in another tab'
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
      <nav className="app-navigation" aria-label="Room navigation">
        {(
          [
            ['monitor', 'Monitor', Headphones],
            ['activity', 'Activity', AudioLines],
            ['settings', 'Settings', Settings],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id as string}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id as string)}
          >
            <Icon size={19} />
            {label as string}
          </button>
        ))}
      </nav>
      <div className={`room-grid view-${view}`}>
        <section className="monitor-panel" hidden={view !== 'monitor'}>
          {isBaby ? (
            <>
              <div className="panel-top">
                <span className="eyebrow">BABY’S SIDE</span>
                <button className="quiet small" onClick={() => setDim(!dim)}>
                  {dim ? <Sun size={16} /> : <Moon size={16} />} {dim ? 'Day mode' : 'Night mode'}
                </button>
              </div>
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
                {busy ? 'Opening microphone…' : active ? 'Pause monitoring' : 'Start monitoring'}
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
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSensitivity(value);
                    if (babyRef.current)
                      babyRef.current.threshold = [0.16, 0.08, 0.035][value - 1]!;
                  }}
                />
                <p className="caption">
                  Alerts after 1.5 seconds of sound, with 20 seconds between alerts.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="panel-top">
                <span className="eyebrow">LIVE MONITOR</span>
                <span className="caption">
                  {babies.length} baby {babies.length === 1 ? 'device' : 'devices'}
                </span>
              </div>
              {babies.length === 0 ? (
                <div className="empty-nest">
                  <img src="/pip-sleeping.png" alt="Pip waiting for a baby device" />
                  <h2>
                    A room for two.
                    <br />
                    Or a few.
                  </h2>
                  <p>
                    Add a device to stay with your baby.
                    <br />
                    Their little sounds will show up here.
                  </p>
                  <button className="primary" onClick={() => setModal('invite')}>
                    Invite a baby device <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="parent-intro">
                    <h2>
                      {babies.some((d) => d.monitoring) && connected
                        ? 'Baby monitors'
                        : 'Baby monitors'}
                    </h2>
                    <p>
                      {babies.some((d) => d.monitoring) && connected
                        ? 'Tap Listen for a live moment from their room.'
                        : 'Start monitoring on your baby device.'}
                    </p>
                  </div>
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
                        <div className="device-bottom">
                          <span className="caption">
                            {device.lastNoise
                              ? `Last sound ${relative(device.lastNoise)}`
                              : 'No sounds detected yet'}
                          </span>
                          {listeningTo === device.id &&
                          [
                            'Listening live',
                            'Connecting audio',
                            'Tap Resume audio to hear your baby.',
                          ].includes(audioStatus) ? (
                            <button
                              className="secondary small"
                              onClick={() => callsRef.current?.stop()}
                            >
                              <Pause size={16} /> Stop listening
                            </button>
                          ) : (
                            <button
                              className="primary small"
                              disabled={!connected || !device.monitoring}
                              onClick={() =>
                                void callsRef.current?.listen(device.id).catch((error) => {
                                  callsRef.current?.stop();
                                  setError(message(error));
                                })
                              }
                            >
                              <Headphones size={17} /> Listen
                            </button>
                          )}
                        </div>
                        {listeningTo === device.id && (
                          <div className="audio-status" role="status">
                            <AudioLines size={16} />
                            {audioStatus}
                            {audioStatus.includes('Resume') && (
                              <button
                                onClick={() =>
                                  void audioRef.current
                                    ?.play()
                                    .then(() => setAudioStatus('Listening live'))
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
              <div className="privacy-line">
                <ShieldCheck size={16} /> Live audio is private. Nothing is recorded.
              </div>
            </>
          )}
        </section>
        <aside>
          <section className="side-card connection-card" hidden={view !== 'settings'}>
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
                  Get a notification for sustained noise or a disconnected baby device, even when
                  Pip is in the background.
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
                  On iPhone, install Pip first. Notifications can be delayed by your device or
                  network.
                </p>
              </>
            )}
          </section>
          <section className="side-card activity" hidden={view !== 'activity'}>
            <div className="section-heading">
              <h3>Activity</h3>
              <span className="caption">Today</span>
            </div>
            {events.length ? (
              <div className="event-list">
                {events.slice(0, 6).map((event) => (
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
                <span>﹏</span>
                <p>
                  No activity yet.
                  <br />
                  Sound and connection events appear here.
                </p>
              </div>
            )}
          </section>
          <p className="prototype-note" hidden={view !== 'settings'}>
            An extra pair of ears, not a replacement for checking on your baby.
          </p>
          {view === 'settings' && (
            <button className="secondary full" onClick={() => setModal('settings')}>
              <Smartphone size={18} /> Manage this device
            </button>
          )}
          {pwa.waiting && (
            <button
              className="secondary full small"
              disabled={active || !!listeningTo}
              onClick={pwa.update}
            >
              Update ready{active || listeningTo ? ' · pause first' : ' · reload Pip'}
            </button>
          )}
          {pwa.error && <p className="notice">{pwa.error}</p>}
        </aside>
      </div>
      {modal && (
        <Modal
          title={modal === 'invite' ? 'Invite a device' : 'Device settings'}
          close={() => setModal('')}
        >
          {modal === 'invite' ? (
            <>
              <p>
                Open Pip on your other device and join with this code. Choose Baby for the device
                that stays in the nursery.
              </p>
              <label>
                Private invitation code
                <input readOnly value={session.roomKey} onFocus={(e) => e.target.select()} />
              </label>
              <div className="invite-actions">
                <button
                  className="primary full"
                  onClick={() => void copy(`${location.origin}/#join=${session.roomKey}`, 'link')}
                >
                  {copied === 'link' ? <Check size={17} /> : <Link size={17} />}{' '}
                  {copied === 'link' ? 'Link copied' : 'Copy invite link'}
                </button>
                <button
                  className="secondary full"
                  onClick={() => void copy(session.roomKey, 'code')}
                >
                  <Copy size={16} />
                  {copied === 'code' ? 'Code copied' : 'Copy code'}
                </button>
              </div>
              <p className="caption">Anyone with this invitation can join. Share it privately.</p>
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
              <button className="secondary full" disabled={busy} onClick={() => void changeRole()}>
                Switch to {isBaby ? 'parent' : 'baby'} device
                <ChevronRight size={17} />
              </button>
              <p className="caption">Switching roles pauses monitoring and stops live audio.</p>
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
