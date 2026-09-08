import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Headphones,
  Link,
  Mic,
  Moon,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { request } from './connection';
import { message } from './format';
import type { Role, Session } from './protocol';
export function Welcome({
  onJoin,
  appMode = false,
}: {
  onJoin: (value: Session) => void;
  appMode?: boolean;
}) {
  const invited = new URLSearchParams(location.hash.slice(1)).get('join') || '';
  const [mode, setMode] = useState(
    invited
      ? 'join'
      : new URLSearchParams(location.search).get('setup') === 'create'
        ? 'create'
        : new URLSearchParams(location.search).get('setup') === 'join'
          ? 'join'
          : '',
  );
  const [role, setRole] = useState<Role>('parent');
  const [name, setName] = useState('');
  const [roomKey, setRoomKey] = useState(invited);
  const [roomName, setRoomName] = useState('Our little nest');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await request('register', {
        name: name.trim() || (role === 'baby' ? 'Nursery' : 'My phone'),
        role,
        ...(mode === 'join' ? { roomKey } : { roomName }),
      });
      history.replaceState(null, '', '/');
      onJoin(session);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={appMode ? 'welcome app-onboarding' : 'welcome'}>
      {!appMode && (
        <section className="welcome-art">
          <div className="eyebrow">
            <span /> A LITTLE PEACE OF MIND
          </div>
          <h1>
            Close by.
            <br />
            Even from
            <br />
            <em>the next room.</em>
          </h1>
          <div className="mascot-wrap">
            <img
              className="mascot"
              src="/pip-sleeping.png"
              alt="A little yellow bird sleeping on a blue crescent cushion"
            />
          </div>
          <div className="art-note">
            <ShieldCheck size={16} /> No recordings. Just a little reassurance.
          </div>
        </section>
      )}
      <section className="welcome-content">
        {!mode ? (
          <>
            <div className="tiny-moon">
              <Moon size={24} />
            </div>
            <h2>
              {appMode ? (
                'Set up your monitor'
              ) : (
                <>
                  Their room. <br />
                  Your peace of mind.
                </>
              )}
            </h2>
            <p>
              Turn two devices into a cozy little baby monitor. One stays with your baby. One stays
              with you.
            </p>
            <div className="welcome-actions">
              <button
                className="primary"
                onClick={() => (appMode ? setMode('create') : location.assign('/app?setup=create'))}
              >
                Create a room <ArrowRight size={18} />
              </button>
              <button
                className="secondary"
                onClick={() => (appMode ? setMode('join') : location.assign('/app?setup=join'))}
              >
                Join a room <Link size={18} />
              </button>
            </div>
            {!appMode && (
              <div className="steps">
                <span>
                  <span className="step-icon">
                    <Smartphone size={18} />
                  </span>
                  Two devices
                </span>
                <span>
                  <span className="step-icon">
                    <Mic size={18} />
                  </span>
                  Live audio
                </span>
                <span>
                  <span className="step-icon">
                    <Bell size={18} />
                  </span>
                  Gentle alerts
                </span>
              </div>
            )}
            <p className="caption">No account. No camera. Nothing complicated.</p>
          </>
        ) : (
          <form onSubmit={submit} className="setup">
            <button type="button" className="back quiet" onClick={() => setMode('')}>
              <ArrowLeft size={16} /> Back
            </button>
            <h2>{mode === 'join' ? 'Come on in.' : 'Make a little nest.'}</h2>
            <p>
              {mode === 'join'
                ? 'Use the invitation from your other device.'
                : 'Start here, then invite your other device.'}
            </p>
            {mode === 'join' ? (
              <label>
                Invitation code
                <input
                  required
                  value={roomKey}
                  onChange={(e) => setRoomKey(e.target.value)}
                  placeholder="Paste your room code"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
            ) : (
              <label>
                Room name
                <input
                  required
                  maxLength={40}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </label>
            )}
            <fieldset>
              <legend>This device stays with…</legend>
              <div className="role-picker">
                <button
                  type="button"
                  aria-pressed={role === 'baby'}
                  onClick={() => setRole('baby')}
                >
                  <Moon />
                  <strong>Baby</strong>
                  <span>Listen for little sounds</span>
                </button>
                <button
                  type="button"
                  aria-pressed={role === 'parent'}
                  onClick={() => setRole('parent')}
                >
                  <Headphones />
                  <strong>Me</strong>
                  <span>Keep an ear out</span>
                </button>
              </div>
            </fieldset>
            <label>
              Device name
              <input
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === 'baby' ? 'Nursery' : 'My phone'}
              />
            </label>
            {error && (
              <p role="alert" className="notice">
                {error}
              </p>
            )}
            <button
              className="primary full"
              disabled={busy || (mode === 'join' && !roomKey.trim())}
            >
              {busy ? 'Getting your room ready…' : mode === 'join' ? 'Join room' : 'Create room'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
