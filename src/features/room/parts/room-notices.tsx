import { AlertActiveIcon, BrightIcon, CloseIcon, ConnectionIcon } from '../../../icons';
import type { ConnectionStatus } from '../../../connection';
import type { Alert } from '../../../protocol';
import { useIntl } from '../../../intl/setup';
import type { MessageKey } from '../../../intl/messages';

const CONNECTION_KEYS = {
  Connecting: 'status.connecting',
  Connected: 'status.connected',
  'Connection lost': 'status.lost',
  'Access removed': 'status.accessRemoved',
  'Room inactive': 'status.inactive',
  'Open in another tab': 'status.openElsewhere',
} as const satisfies Record<ConnectionStatus, MessageKey>;

const CONNECTION_CODES = {
  Connecting: 'connecting',
  Connected: 'connected',
  'Connection lost': 'lost',
  'Access removed': 'accessRemoved',
  'Room inactive': 'inactive',
  'Open in another tab': 'openElsewhere',
} as const satisfies Record<ConnectionStatus, string>;

export function ConnectionSummary({
  connected,
  connection,
  deviceName,
  parentAwake,
}: {
  connected: boolean;
  connection: ConnectionStatus;
  deviceName: string;
  parentAwake: boolean;
}) {
  const t = useIntl();
  return (
    <div className="connection-summary">
      <span
        className={`status ${connected ? 'green' : 'amber'}`}
        data-testid="connection-status"
        data-status={CONNECTION_CODES[connection]}
      >
        <i />
        {t(CONNECTION_KEYS[connection])}
      </span>
      <span>{deviceName}</span>
      {parentAwake && (
        <span className="wake-status" data-testid="wake-status">
          <BrightIcon size={16} />
          {t('room.screenAwake')}
        </span>
      )}
    </div>
  );
}

export function ConnectionNotice({ connection }: { connection: ConnectionStatus }) {
  const t = useIntl();
  const message =
    connection === 'Access removed'
      ? t('notice.accessRemoved')
      : connection === 'Open in another tab'
        ? t('notice.openElsewhere')
        : t('notice.connectionUnavailable');

  return (
    <p
      role="alert"
      className="notice"
      data-testid="connection-notice"
      data-status={CONNECTION_CODES[connection]}
    >
      <ConnectionIcon size={20} />
      {message}
    </p>
  );
}

export function ErrorNotice({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  const t = useIntl();
  return (
    <p role="alert" className="notice" data-testid="error-notice">
      <span>{error}</span>
      <button
        type="button"
        className="icon-button"
        data-testid="dismiss-error"
        aria-label={t('common.dismissError')}
        onClick={onDismiss}
      >
        <CloseIcon size={17} />
      </button>
    </p>
  );
}

export function EventNotice({ event, onDismiss }: { event: Alert; onDismiss: () => void }) {
  const t = useIntl();
  const title =
    event.kind === 'noise'
      ? t('event.noise.title')
      : event.kind === 'paused'
        ? t('event.paused.title')
        : t('event.offline.title');
  const detail =
    event.kind === 'offline'
      ? t('event.offline.detail', { name: event.name })
      : event.kind === 'noise'
        ? t('event.noise.detail', { name: event.name })
        : t('event.paused.detail', { name: event.name });

  return (
    <div
      className={`notice ${event.kind === 'noise' ? 'sound-notice' : ''}`}
      role="alert"
      data-testid="event-notice"
      data-kind={event.kind}
    >
      <AlertActiveIcon size={20} />
      <span>
        <strong>{title}</strong>
        <br />
        {detail}
      </span>
      <button
        type="button"
        className="icon-button"
        data-testid="dismiss-notice"
        aria-label={t('notice.dismiss')}
        onClick={onDismiss}
      >
        <CloseIcon size={17} />
      </button>
    </div>
  );
}
