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
import { T, useIntl } from './intl/setup';
import type { Role, Session } from './protocol';
export function Welcome({
  onJoin,
  appMode = false,
}: {
  onJoin: (value: Session) => void;
  appMode?: boolean;
}) {
  const t = useIntl();
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
  const [roomName, setRoomName] = useState(() => t('welcome.defaultRoomName'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await request('register', {
        name:
          name.trim() ||
          (role === 'baby' ? t('welcome.defaultBabyName') : t('welcome.defaultParentName')),
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
            <T
              k="welcome.hero"
              components={{
                br: () => <br />,
                em: ({ children }) => <em>{children}</em>,
              }}
            />
          </h1>
          <div className="mascot-wrap">
            <figure className="landing-mascot-state">
              <PipMascot className="landing-mascot" state="quiet" alt={t('welcome.mascotAlt')} />
              <figcaption>
                <T
                  k="welcome.mascotHint"
                  components={{
                    hint: ({ children }) => <span className="pip-hover-hint">{children}</span>,
                  }}
                />
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
                t('welcome.setupTitle')
              ) : (
                <T k="welcome.title" components={{ br: () => <br /> }} />
              )}
            </h2>
            <p>{t('welcome.intro')}</p>
            <div className="welcome-actions">
              <button
                type="button"
                className="primary"
                data-testid="create-room"
                onClick={() => void navigate({ to: '/app/create' })}
              >
                {t('welcome.createRoom')} <ForwardIcon size={18} />
              </button>
              <button
                type="button"
                className="secondary"
                data-testid="join-room"
                onClick={() => void navigate({ to: '/app/join' })}
              >
                {t('welcome.joinRoom')} <InviteLinkIcon size={18} />
              </button>
            </div>
            {!appMode && (
              <div className="steps">
                <span>
                  <span className="step-icon">
                    <DeviceIcon size={18} />
                  </span>
                  {t('welcome.stepDevices')}
                </span>
                <span>
                  <span className="step-icon">
                    <MicrophoneIcon size={18} />
                  </span>
                  {t('welcome.stepAudio')}
                </span>
                <span>
                  <span className="step-icon">
                    <AlertIcon size={18} />
                  </span>
                  {t('welcome.stepAlerts')}
                </span>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={submit} className="setup">
            <button
              type="button"
              className="back quiet"
              data-testid="back"
              onClick={() => void navigate({ to: '/app', hash: '', search: {} })}
            >
              <BackIcon size={16} /> {t('welcome.back')}
            </button>
            <h2>{mode === 'join' ? t('welcome.joinRoom') : t('welcome.createRoom')}</h2>
            <p>{mode === 'join' ? t('welcome.joinIntro') : t('welcome.createIntro')}</p>
            {mode === 'join' ? (
              <>
                <label>
                  {t('welcome.invitationCode')}
                  <input
                    required
                    data-testid="invitation-code"
                    className="invitation-code"
                    value={roomKey}
                    onChange={(e) => setRoomKey(e.target.value)}
                    placeholder={t('welcome.invitationPlaceholder')}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </label>
                <button
                  type="button"
                  className="secondary full"
                  data-testid="scan-qr"
                  onClick={() => setScanning(true)}
                >
                  {t('welcome.scanQr')}
                </button>
                {scanning && (
                  <InvitationScanner onScan={scanned} close={() => setScanning(false)} />
                )}
              </>
            ) : (
              <label>
                {t('welcome.roomName')}
                <input
                  required
                  maxLength={40}
                  data-testid="room-name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </label>
            )}
            <fieldset>
              <legend>{t('welcome.roleLegend')}</legend>
              <div className="role-picker">
                <button
                  type="button"
                  data-testid="role-baby"
                  aria-pressed={role === 'baby'}
                  onClick={() => setRole('baby')}
                >
                  <BabyIcon size={24} />
                  <strong>{t('welcome.roleBaby')}</strong>
                  <span>{t('welcome.roleBabyDetail')}</span>
                </button>
                <button
                  type="button"
                  data-testid="role-parent"
                  aria-pressed={role === 'parent'}
                  onClick={() => setRole('parent')}
                >
                  <ParentIcon size={24} />
                  <strong>{t('welcome.roleParent')}</strong>
                  <span>{t('welcome.roleParentDetail')}</span>
                </button>
              </div>
            </fieldset>
            <label>
              {t('welcome.deviceName')}
              <input
                maxLength={40}
                data-testid="device-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  role === 'baby' ? t('welcome.deviceNameBaby') : t('welcome.deviceNameParent')
                }
              />
            </label>
            {error && (
              <p role="alert" className="notice" data-testid="form-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="primary full"
              data-testid="submit-room"
              disabled={busy || (mode === 'join' && !roomKey.trim())}
            >
              {busy
                ? t('welcome.submitting')
                : mode === 'join'
                  ? t('welcome.submitJoin')
                  : t('welcome.submitCreate')}
              <ForwardIcon size={18} />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
