import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { Toaster, toast } from 'sonner';
import { usePwa } from './pwa';
import { Welcome } from './Welcome';
import { Room } from './features/room';
import { ApiError, request } from './connection';
import type { Session } from './protocol';
import { readSession, readRooms, sessionsEqual, storeActive, storeRooms } from './sessions';
import { InvitationModal, PrivacyModal, RoomsPopover } from './AppModals';
import { DisclosureIcon, PrivacyIcon } from './icons';

type AppModal = '' | 'privacy';

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
  const appMode = route.pathname.startsWith('/app') || !!incoming;
  useEffect(() => {
    if (appMode || pwa.installed || sessionStorage.getItem('pip-install-tip-seen')) return;
    const timer = setTimeout(
      () => {
        sessionStorage.setItem('pip-install-tip-seen', 'true');
        toast('Install Pip', {
          id: 'pip-install',
          description: 'Keep it one tap away on this device.',
          duration: 7000,
          action: pwa.canInstall
            ? { label: 'Install', onClick: () => void pwa.install() }
            : undefined,
        });
      },
      pwa.canInstall ? 400 : 1800,
    );
    return () => clearTimeout(timer);
  }, [appMode, pwa.canInstall, pwa.install, pwa.installed]);
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
    <RoomsPopover
      activeDeviceId={session?.deviceId}
      align={appMode ? 'start' : 'end'}
      error={switchError}
      rooms={rooms}
      switching={switching}
      onActivate={activate}
      onAdd={addRoom}
      onOpen={() => setSwitchError('')}
      onForget={(room) =>
        setRooms((current) =>
          storeRooms(current.filter((saved) => saved.deviceId !== room.deviceId)),
        )
      }
    />
  );
  return (
    <AppContext.Provider
      value={{
        session,
        saveSession,
        pwa,
        setModal,
        incoming,
        roomSwitcher,
        updateSession,
      }}
    >
      <div className={appMode ? 'app-shell application' : 'app-shell'}>
        {!(session && appMode) && (
          <header className="topbar">
            <Link className="brand" to={appMode ? '/app' : '/'} aria-label="Pip homepage">
              <img src="/icon.svg" alt="" />
              pip
            </Link>
            {(rooms.length > 0 || appMode) && (
              <div className="shell-actions">
                {rooms.length > 0 && roomSwitcher}
                {appMode && rooms.length === 0 && (
                  <button type="button" className="quiet small" onClick={() => setModal('privacy')}>
                    Privacy
                  </button>
                )}
              </div>
            )}
          </header>
        )}
        <Outlet />
        <Toaster
          theme="system"
          position="bottom-right"
          offset={{ bottom: 96, right: 24 }}
          mobileOffset={{ bottom: session ? 104 : 16, left: 16, right: 16 }}
          closeButton
        />
        {!appMode && (
          <footer>
            <button type="button" onClick={() => setModal('privacy')}>
              Privacy
            </button>
            <nav aria-label="Project links">
              <a href="https://github.com/carlassmann/babyphone" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href="https://carlassmann.com" target="_blank" rel="noreferrer">
                carlassmann.com
              </a>
            </nav>
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
        {modal === 'privacy' && <PrivacyModal onClose={() => setModal('')} />}
      </div>
    </AppContext.Provider>
  );
}

type AppContextValue = {
  session: Session | null;
  saveSession: (session: Session | null) => void;
  pwa: ReturnType<typeof usePwa>;
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
  const { session, saveSession, pwa, incoming, setModal, roomSwitcher, updateSession } = useApp();
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
          <button type="button" className="settings-link" onClick={() => setModal('privacy')}>
            <span className="card-icon">
              <PrivacyIcon size={19} />
            </span>
            <span>Privacy</span>
            <DisclosureIcon size={18} />
          </button>
        }
      />
    );
  return <Welcome key={incoming} onJoin={saveSession} appMode />;
}
