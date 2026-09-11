import { useCallback, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  AlertIcon,
  BabyIcon,
  BackIcon,
  DeviceIcon,
  ForwardIcon,
  InviteLinkIcon,
  MicrophoneIcon,
  ParentIcon,
} from './icons';
import { InvitationScanner } from './InvitationScanner';
import { PipMascot } from './PipMascot';
import { request } from './connection';
import { errorMessage } from './format';
import type { Role, Session } from './protocol';
export function Welcome({
  onJoin,
  appMode = false,
}: {
  onJoin: (value: Session) => void;
  appMode?: boolean;
}) {
  const route = useLocation();
  const navigate = useNavigate();
  const invited = new URLSearchParams(route.hash.replace(/^#/, '')).get('join') || '';
  const legacySetup = new URLSearchParams(route.searchStr).get('setup');
  const mode =
    invited || route.pathname === '/app/join' || legacySetup === 'join'
      ? 'join'
      : route.pathname === '/app/create' || legacySetup === 'create'
        ? 'create'
        : '';
  const [scanning, setScanning] = useState(false);
  const scanned = useCallback((code: string) => {
    setRoomKey(code);
    setScanning(false);
  }, []);
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
      onJoin(session);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={appMode ? 'welcome app-onboarding' : 'welcome'}>
      {!appMode && (
        <section className="welcome-art">
          <h1>
            Close by.
            <br />
            Even from
            <br />
            <em>the next room.</em>
          </h1>
          <div className="mascot-wrap">
            <figure className="landing-mascot-state">
              <PipMascot
                className="landing-mascot"
                state="quiet"
                alt="Pip breathing gently while the room is quiet"
              />
              <figcaption>
                Psst… tap<span className="pip-hover-hint"> or hover</span> to wake Pip.
              </figcaption>
            </figure>
          </div>
        </section>
      )}
      <section className="welcome-content">
        {!mode ? (
          <>
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
                type="button"
                className="primary"
                onClick={() => void navigate({ to: '/app/create' })}
              >
                Create a room <ForwardIcon size={18} />
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void navigate({ to: '/app/join' })}
              >
                Join a room <InviteLinkIcon size={18} />
              </button>
            </div>
            {!appMode && (
              <div className="steps">
                <span>
                  <span className="step-icon">
                    <DeviceIcon size={18} />
                  </span>
                  Two or more devices
                </span>
                <span>
                  <span className="step-icon">
                    <MicrophoneIcon size={18} />
                  </span>
                  Live audio
                </span>
                <span>
                  <span className="step-icon">
                    <AlertIcon size={18} />
                  </span>
                  Gentle alerts
                </span>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={submit} className="setup">
            <button
              type="button"
              className="back quiet"
              onClick={() => void navigate({ to: '/app', hash: '', search: {} })}
            >
              <BackIcon size={16} /> Back
            </button>
            <h2>{mode === 'join' ? 'Join a room' : 'Create a room'}</h2>
            <p>
              {mode === 'join'
                ? 'Use the invitation from your other device.'
                : 'Start here, then invite your other device.'}
            </p>
            {mode === 'join' ? (
              <>
                <label>
                  Invitation code
                  <input
                    required
                    className="invitation-code"
                    value={roomKey}
                    onChange={(e) => setRoomKey(e.target.value)}
                    placeholder="Paste your room code"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </label>
                <button type="button" className="secondary full" onClick={() => setScanning(true)}>
                  Scan QR code
                </button>
                {scanning && (
                  <InvitationScanner onScan={scanned} close={() => setScanning(false)} />
                )}
              </>
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
                  <BabyIcon size={24} />
                  <strong>Baby</strong>
                  <span>Listen for little sounds</span>
                </button>
                <button
                  type="button"
                  aria-pressed={role === 'parent'}
                  onClick={() => setRole('parent')}
                >
                  <ParentIcon size={24} />
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
              type="submit"
              className="primary full"
              disabled={busy || (mode === 'join' && !roomKey.trim())}
            >
              {busy ? 'Getting your room ready…' : mode === 'join' ? 'Join room' : 'Create room'}
              <ForwardIcon size={18} />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
