import { AlertIcon, CheckIcon, DeviceIcon, ForwardIcon } from '../../../icons';
import { request } from '../../../connection';
import { RenameField } from '../parts/room-components';
import { useRoom } from '../room-context';

export function SettingsScreen() {
  const room = useRoom();

  return (
    <>
      {!room.isBaby && (
        <section className="side-card">
          <h3>Room</h3>
          <RenameField
            label="Room name"
            value={room.session.roomName}
            onSave={(name) => request('rename-room', { ...room.session, name })}
          />
        </section>
      )}
      <section className="side-card connection-card">
        <div className="section-icon">
          <AlertIcon size={22} />
        </div>
        <h3>{room.isBaby ? 'Device setup' : 'Notifications'}</h3>
        {room.isBaby ? <BabySetup /> : <NotificationSetup room={room} />}
      </section>
      <button type="button" className="secondary full" onClick={room.openSettings}>
        <DeviceIcon size={19} /> Manage this device
      </button>
      {room.preferences}
    </>
  );
}

function BabySetup() {
  return (
    <>
      <p>Keep this device plugged in, with Pip open in the foreground.</p>
      <div className="check-row">
        <CheckIcon size={17} weight="bold" /> Volume is analyzed here
      </div>
      <div className="check-row">
        <CheckIcon size={17} weight="bold" /> No audio is saved
      </div>
      <div className="check-row">
        <CheckIcon size={17} weight="bold" /> Parents can listen anytime
      </div>
    </>
  );
}

function NotificationSetup({ room }: { room: ReturnType<typeof useRoom> }) {
  return (
    <>
      <p>
        Get a notification for sustained noise or a disconnected baby device, even when Pip is in
        the background.
      </p>
      <button
        type="button"
        className={room.pushEnabled ? 'secondary full small' : 'primary full small'}
        disabled={room.busy || room.pushEnabled || !room.connected}
        onClick={() => void room.enableNotifications()}
      >
        {room.pushEnabled ? <CheckIcon size={17} weight="bold" /> : <AlertIcon size={17} />}{' '}
        {room.pushEnabled ? 'Notifications enabled' : 'Enable notifications'}
      </button>
      {room.pushEnabled && (
        <button
          type="button"
          className="quiet full small"
          disabled={room.busy}
          onClick={() => void room.testNotification()}
        >
          Test notification <ForwardIcon size={16} />
        </button>
      )}
      {room.pushTestMessage && (
        <p className="caption" role="status">
          {room.pushTestMessage}
        </p>
      )}
      <p className="caption">
        Allow notifications in your device settings too. Delivery can be delayed by your device or
        network.
      </p>
    </>
  );
}
