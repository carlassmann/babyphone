import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Check, ChevronDown, Download, Moon, Sun } from 'lucide-react';
import { usePwa } from './pwa';
import { Welcome } from './Welcome';
import { Room } from './Room';
import { Modal } from './Modal';
import { ApiError, request } from './connection';
import type { Session } from './protocol';
import { readSession, readRooms, storeActive, storeRooms } from './sessions';

export function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [rooms, setRooms] = useState(readRooms);
  const [modal, setModal] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const route = useLocation();
  const navigate = useNavigate();
  const incoming = new URLSearchParams(route.hash.replace(/^#/, '')).get('join') || '';
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  useEffect(() => setJoinError(''), [incoming]);
  function dismissInvitation() {
    void navigate({ to: '/app', replace: true, hash: '' });
    setJoinError('');
  }
  async function deactivateCurrent() {
    if (!session) return;
    try {
      await request('deactivate', session);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    storeActive(null);
    setSession(null);
  }
  async function activate(room: Session) {
    if (switching) return;
    setSwitching(true);
    setSwitchError('');
    try {
      const state = await request('state', room);
      const own = state.devices.find((device: { id: string }) => device.id === room.deviceId);
      if (!own) throw new Error('Your access to this room was removed.');
      if (room.deviceId !== session?.deviceId) await deactivateCurrent();
      save({
        ...room,
        roomName: state.roomName || room.roomName,
        roomKey: state.roomKey || room.roomKey,
        name: own.name,
      });
      setModal('');
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Could not switch rooms.');
      throw error;
    } finally {
      setSwitching(false);
    }
  }
  async function addRoom(to: '/app/create' | '/app/join', hash = '') {
    if (switching) return;
    setSwitching(true);
    setSwitchError('');
    try {
      await deactivateCurrent();
      setModal('');
      await navigate({ to, hash });
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Connect before switching rooms.');
      throw error;
    } finally {
      setSwitching(false);
    }
  }
  async function openInvitation() {
    if (!session || joining) return;
    setJoining(true);
    setJoinError('');
    try {
      const existing = rooms.find(
        (room) => incoming === room.roomKey || incoming.startsWith(room.roomId + '.'),
      );
      if (existing) await activate(existing);
      else await addRoom('/app/join', 'join=' + encodeURIComponent(incoming));
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Could not switch rooms.');
    } finally {
      setJoining(false);
    }
  }
  const updateSession = useCallback((value: Session) => {
    setRooms((current) => {
      const old = current.find((room) => room.deviceId === value.deviceId);
      if (old && JSON.stringify(old) === JSON.stringify(value)) return current;
      return storeRooms([...current.filter((room) => room.roomId !== value.roomId), value]);
    });
    setSession((current) => {
      if (current?.deviceId !== value.deviceId || JSON.stringify(current) === JSON.stringify(value))
        return current;
      storeActive(value);
      return value;
    });
  }, []);

  const pwa = usePwa();
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem('pip-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pip-theme', theme);
  }, [theme]);
  const appMode = route.pathname.startsWith('/app') || !!session || !!incoming;
  function save(value: Session | null) {
    setRooms((current) =>
      storeRooms(
        value
          ? [...current.filter((room) => room.roomId !== value.roomId), value]
          : current.filter((room) => room.deviceId !== session?.deviceId),
      ),
    );
    storeActive(value);
    void navigate({ to: '/app', replace: true, hash: '' });
    setSession(value);
  }
  const roomSwitcher = (
    <button
      className="room-switcher"
      onClick={() => {
        setSwitchError('');
        setModal('rooms');
      }}
      aria-label="Switch room"
    >
      <span>{session?.roomName || 'Saved rooms'}</span>
      <ChevronDown size={18} />
    </button>
  );
  return (
    <AppContext.Provider
      value={{
        session,
        save,
        pwa,
        theme,
        setTheme,
        setModal,
        incoming,
        roomSwitcher,
        updateSession,
      }}
    >
      <div className={appMode ? 'app-shell application' : 'app-shell'}>
        {!(session && appMode) && (
          <header className="topbar">
            <Link className="brand" to={appMode ? '/app' : '/'} aria-label="Pip home">
              <img src="/icon.svg" alt="" />
              pip
            </Link>
            <div className="shell-actions">
              {rooms.length > 0 && roomSwitcher}
              <button
                className="icon-button"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              {!appMode && (
                <Link className="secondary small" to="/app">
                  Open Pip
                </Link>
              )}
              {appMode && rooms.length === 0 && (
                <button className="quiet small" onClick={() => setModal('about')}>
                  Privacy
                </button>
              )}
              {(rooms.length === 0 || !appMode) && (
                <button className="quiet small" onClick={() => setModal('install')}>
                  <Download size={17} />
                  <span>{pwa.installed ? 'App installed' : 'Get the app'}</span>
                </button>
              )}
            </div>
          </header>
        )}
        <Outlet />
        <Toaster
          theme={theme === 'dark' ? 'dark' : 'light'}
          position="bottom-right"
          offset={{ bottom: 96, right: 24 }}
          mobileOffset={{ bottom: 104, left: 16, right: 16 }}
          closeButton
        />
        {!appMode && (
          <footer>
            <button onClick={() => setModal('about')}>Privacy & how it works</button>
          </footer>
        )}
        {session &&
          incoming &&
          incoming !== session.roomKey &&
          !incoming.startsWith(session.roomId + '.') && (
            <Modal
              title="Open this invitation?"
              close={() => {
                if (!joining) dismissInvitation();
              }}
            >
              <p>
                Switch from {session.roomName}? Monitoring and notifications follow the active room.
                You can return to your saved rooms anytime.
              </p>
              <button
                className="primary full"
                disabled={joining}
                onClick={() => void openInvitation()}
              >
                {joining ? 'Switching room…' : 'Switch room and join'}
              </button>
              <button className="secondary full" disabled={joining} onClick={dismissInvitation}>
                Keep current room
              </button>
              {joinError && (
                <p role="alert" className="notice">
                  {joinError}
                </p>
              )}
            </Modal>
          )}
        {modal === 'rooms' && (
          <Modal
            title="Your rooms"
            close={() => {
              if (!switching) setModal('');
            }}
          >
            <p>
              Only the active room monitors or sends notifications to this device. Switching stops
              live audio.
            </p>
            <div className="saved-rooms">
              {rooms.map((room) => (
                <div className="saved-room" key={room.roomId}>
                  <button
                    className="secondary full"
                    disabled={switching}
                    onClick={() => void activate(room).catch(() => {})}
                  >
                    <span>
                      {room.roomName}
                      <small>
                        {room.name} · {room.role === 'baby' ? 'Baby' : 'Parent'}
                      </small>
                    </span>
                    {room.deviceId === session?.deviceId && <Check size={18} />}
                  </button>
                  {room.deviceId !== session?.deviceId && (
                    <button
                      className="quiet small"
                      disabled={switching}
                      aria-label={'Forget ' + room.roomName}
                      onClick={() =>
                        setRooms((current) =>
                          storeRooms(current.filter((saved) => saved.deviceId !== room.deviceId)),
                        )
                      }
                    >
                      Forget
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="primary full"
              disabled={switching}
              onClick={() => void addRoom('/app/create').catch(() => {})}
            >
              Create a room
            </button>
            <button
              className="secondary full"
              disabled={switching}
              onClick={() => void addRoom('/app/join').catch(() => {})}
            >
              Join a room
            </button>
            {switchError && (
              <p role="alert" className="notice">
                {switchError}
              </p>
            )}
          </Modal>
        )}
        {modal && modal !== 'rooms' && (
          <Modal title={modal === 'install' ? 'Install Pip' : 'Privacy'} close={() => setModal('')}>
            {modal === 'install' ? (
              <>
                <div className="install-icon">
                  <img src="/icon.svg" alt="Pip" />
                </div>
                <p>Keep Pip a tap away. Install it on both devices for the best experience.</p>
                {pwa.installed ? (
                  <p className="notice success">
                    <Check />
                    Pip is installed on this device.
                  </p>
                ) : pwa.canInstall ? (
                  <button className="primary full" onClick={() => void pwa.install()}>
                    Install Pip <Download size={18} />
                  </button>
                ) : (
                  <div className="instructions">
                    <p>
                      <strong>iPhone / iPad</strong>
                      <br />
                      In Safari, tap Share → Add to Home Screen. Open Pip from its new icon before
                      enabling notifications.
                    </p>
                    <p>
                      <strong>Android / desktop</strong>
                      <br />
                      Use your browser menu → Install app or Add to Home Screen. In Safari on Mac,
                      choose File → Add to Dock.
                    </p>
                  </div>
                )}
                <p className="caption">
                  The baby device must stay plugged in, with Pip open and its screen awake.
                </p>
              </>
            ) : (
              <>
                <p>
                  Sound is analyzed on the baby device. Pip never records it. Live listening uses an
                  encrypted audio connection between your devices, with a relay only when needed.
                </p>
                <p>
                  Your invitation code is the key to your room. Share it only with people you trust.
                </p>
                <p className="notice">
                  This is a prototype and an extra pair of ears. Keep checking on your baby;
                  browsers, networks, and notifications can stop working.
                </p>
              </>
            )}
          </Modal>
        )}
      </div>
    </AppContext.Provider>
  );
}

type AppContextValue = {
  session: Session | null;
  save: (session: Session | null) => void;
  pwa: ReturnType<typeof usePwa>;
  theme: string;
  setTheme: (theme: string) => void;
  setModal: (modal: string) => void;
  incoming: string;
  roomSwitcher: React.ReactNode;
  updateSession: (session: Session) => void;
};
const AppContext = createContext<AppContextValue | null>(null);
function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('App context unavailable');
  return value;
}
export function LandingScreen() {
  const { save } = useApp();
  return <Welcome onJoin={save} />;
}
export function AppScreen() {
  const { session, save, pwa, incoming, theme, setTheme, setModal, roomSwitcher, updateSession } =
    useApp();
  if (session)
    return (
      <Room
        key={`${session.deviceId}-${session.role}`}
        session={session}
        save={save}
        pwa={pwa}
        roomSwitcher={roomSwitcher}
        updateSession={updateSession}
        preferences={
          <section className="side-card preferences">
            <h3>This app</h3>
            <button
              className="quiet full"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
            <button className="quiet full" onClick={() => setModal('install')}>
              <Download size={18} />
              {pwa.installed ? 'App installed' : 'Install Pip'}
            </button>
            <button className="quiet full" onClick={() => setModal('about')}>
              Privacy
            </button>
          </section>
        }
      />
    );
  return <Welcome key={incoming} onJoin={save} appMode />;
}
