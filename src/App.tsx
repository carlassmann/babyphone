import { useEffect, useState } from 'react';
import { Check, Download, Heart, Moon, Sun } from 'lucide-react';
import { usePwa } from './pwa';
import { Welcome } from './Welcome';
import { Room } from './Room';
import { Modal } from './Modal';
import type { Session } from './protocol';

function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem('pip-session') || 'null');
    return value?.token &&
      value?.deviceId &&
      /^[a-f0-9]{64}$/.test(value?.roomId || '') &&
      ['baby', 'parent'].includes(value?.role)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [modal, setModal] = useState('');
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
  const appMode = location.pathname.startsWith('/app') || !!session || !!location.hash;
  function save(value: Session | null) {
    if (value) localStorage.setItem('pip-session', JSON.stringify(value));
    else localStorage.removeItem('pip-session');
    history.replaceState(null, '', '/app');
    setSession(value);
  }
  return (
    <div className={appMode ? 'app-shell application' : 'app-shell'}>
      <header className="topbar">
        <a
          className="brand"
          href={appMode ? '/app' : '/'}
          aria-label="Pip home"
          onClick={appMode ? (event) => event.preventDefault() : undefined}
        >
          <img src="/icon.svg" alt="" />
          pip{!appMode && <span>little ears. big love.</span>}
        </a>
        <div className="shell-actions">
          <button
            className="icon-button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          {!appMode && (
            <a className="secondary small" href="/app">
              Open Pip
            </a>
          )}
          {appMode && (
            <button className="quiet small" onClick={() => setModal('about')}>
              Privacy
            </button>
          )}
          <button className="quiet small" onClick={() => setModal('install')}>
            <Download size={17} />
            <span>{pwa.installed ? 'App installed' : 'Get the app'}</span>
          </button>
        </div>
      </header>
      {session ? (
        <Room key={`${session.deviceId}-${session.role}`} session={session} save={save} pwa={pwa} />
      ) : (
        <Welcome onJoin={save} appMode={appMode} />
      )}
      {!appMode && (
        <footer>
          <span>
            <Heart size={13} /> Made for the little moments.
          </span>
          <button onClick={() => setModal('about')}>Privacy & how it works</button>
        </footer>
      )}
      {modal && (
        <Modal
          title={modal === 'install' ? 'A little home for Pip' : 'Just your ears. Just your room.'}
          close={() => setModal('')}
        >
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
                This is a prototype and an extra pair of ears. Keep checking on your baby; browsers,
                networks, and notifications can stop working.
              </p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
