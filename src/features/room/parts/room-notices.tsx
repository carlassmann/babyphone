import { Bell, Sun, Wifi, X } from 'lucide-react';
import type { ConnectionStatus } from '../../../connection';
import type { Alert } from '../../../protocol';

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
  return (
    <div className="connection-summary">
      <span className={`status ${connected ? 'green' : 'amber'}`}>
        <i />
        {connection}
      </span>
      <span>{deviceName}</span>
      {parentAwake && (
        <span className="wake-status">
          <Sun size={15} />
          Screen staying awake
        </span>
      )}
    </div>
  );
}

export function ConnectionNotice({ connection }: { connection: ConnectionStatus }) {
  const message =
    connection === 'Access removed'
      ? 'Your access to this room was removed. Leave this room and ask for a new invitation.'
      : connection === 'Open in another tab'
        ? 'This device is open in another tab. Close this tab or reload to use Pip here.'
        : 'Connection unavailable. Monitoring alerts cannot reach you. Check your baby and your connection; Pip is reconnecting.';

  return (
    <p role="alert" className="notice">
      <Wifi size={19} />
      {message}
    </p>
  );
}

export function ErrorNotice({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <p role="alert" className="notice">
      <span>{error}</span>
      <button className="icon-button" aria-label="Dismiss error" onClick={onDismiss}>
        <X size={16} />
      </button>
    </p>
  );
}

export function EventNotice({ event, onDismiss }: { event: Alert; onDismiss: () => void }) {
  const title =
    event.kind === 'noise'
      ? 'Noise detected'
      : event.kind === 'paused'
        ? 'Monitoring paused'
        : 'Baby device disconnected';
  const detail =
    event.kind === 'offline'
      ? ' lost its connection. Check on your baby.'
      : event.kind === 'noise'
        ? ' picked up a sustained sound.'
        : ' stopped monitoring.';

  return (
    <div className={`notice ${event.kind === 'noise' ? 'sound-notice' : ''}`} role="alert">
      <Bell size={19} />
      <span>
        <strong>{title}</strong>
        <br />
        {event.name}
        {detail}
      </span>
      <button className="icon-button" aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
