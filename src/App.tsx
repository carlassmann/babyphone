import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { ChevronDown, Download, Moon, Sun } from 'lucide-react';
import { usePwa } from './pwa';
import { Welcome } from './Welcome';
import { Room } from './features/room';
import { ApiError, request } from './connection';
import type { Session } from './protocol';
import { readSession, readRooms, sessionsEqual, storeActive, storeRooms } from './sessions';
import { AppInfoModal, InvitationModal, RoomsModal } from './AppModals';

type Theme = 'dark' | 'light';
type AppModal = '' | 'rooms' | 'install' | 'privacy';

export function App() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateViewport = () => {
      document.documentElement.style.setProperty(
        '--visual-viewport-top',
        `${viewport.offsetTop}px`,
      );
      document.documentElement.style.setProperty(
        '--visual-viewport-height',
        `${viewport.height}px`,
      );
    };
    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
      document.documentElement.style.removeProperty('--visual-viewport-top');
      document.documentElement.style.removeProperty('--visual-viewport-height');
    };
  }, []);
  const [session, setSession] = useState<Session | null>(readSession);
  const [rooms, setRooms] = useState(readRooms);
  const [modal, setModal] = useState<AppModal>('');
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
      saveSession({
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
      if (old && sessionsEqual(old, value)) return current;
      return storeRooms([...current.filter((room) => room.roomId !== value.roomId), value]);
    });
    setSession((current) => {
      if (current?.deviceId !== value.deviceId || sessionsEqual(current, value)) return current;
      storeActive(value);
      return value;
    });
  }, []);

  const pwa = usePwa();
  const [theme, setTheme] = useState<Theme>(
    () =>
      (localStorage.getItem('pip-theme') as Theme | null) ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pip-theme', theme);
  }, [theme]);
  const appMode = route.pathname.startsWith('/app') || !!session || !!incoming;
  function saveSession(value: Session | null) {
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
      type="button"
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
        saveSession,
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
                type="button"
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
                <button type="button" className="quiet small" onClick={() => setModal('privacy')}>
                  Privacy
                </button>
              )}
              {!pwa.installed && (rooms.length === 0 || !appMode) && (
                <button type="button" className="quiet small" onClick={() => setModal('install')}>
                  <Download size={17} />
                  <span>Get the app</span>
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
          mobileOffset={{ bottom: session ? 104 : 16, left: 16, right: 16 }}
          closeButton
        />
        {!appMode && (
          <footer>
            <button type="button" onClick={() => setModal('privacy')}>
              Privacy & how it works
            </button>
          </footer>
        )}
        {session &&
          incoming &&
          incoming !== session.roomKey &&
          !incoming.startsWith(session.roomId + '.') && (
            <InvitationModal
              currentRoom={session.roomName}
              error={joinError}
              joining={joining}
              onConfirm={() => void openInvitation()}
              onDismiss={dismissInvitation}
            />
          )}
        {modal === 'rooms' && (
          <RoomsModal
            activeDeviceId={session?.deviceId}
            error={switchError}
            rooms={rooms}
            switching={switching}
            onActivate={(room) => void activate(room).catch(() => {})}
            onAdd={(path) => void addRoom(path).catch(() => {})}
            onClose={() => setModal('')}
            onForget={(room) =>
              setRooms((current) =>
                storeRooms(current.filter((saved) => saved.deviceId !== room.deviceId)),
              )
            }
          />
        )}
        {(modal === 'install' || modal === 'privacy') && (
          <AppInfoModal kind={modal} pwa={pwa} onClose={() => setModal('')} />
        )}
      </div>
    </AppContext.Provider>
  );
}

type AppContextValue = {
  session: Session | null;
  saveSession: (session: Session | null) => void;
  pwa: ReturnType<typeof usePwa>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setModal: (modal: AppModal) => void;
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
  const { saveSession } = useApp();
  return <Welcome onJoin={saveSession} />;
}
export function AppScreen() {
  const {
    session,
    saveSession,
    pwa,
    incoming,
    theme,
    setTheme,
    setModal,
    roomSwitcher,
    updateSession,
  } = useApp();
  if (session)
    return (
      <Room
        key={`${session.deviceId}-${session.role}`}
        session={session}
        save={saveSession}
        pwa={pwa}
        roomSwitcher={roomSwitcher}
        updateSession={updateSession}
        preferences={
          <section className="side-card preferences">
            <h3>This app</h3>
            <button
              type="button"
              className="quiet full"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
            <button type="button" className="quiet full" onClick={() => setModal('install')}>
              <Download size={18} />
              {pwa.installed ? 'App installed' : 'Install Pip'}
            </button>
            <button type="button" className="quiet full" onClick={() => setModal('privacy')}>
              Privacy
            </button>
          </section>
        }
      />
    );
  return <Welcome key={incoming} onJoin={saveSession} appMode />;
}
