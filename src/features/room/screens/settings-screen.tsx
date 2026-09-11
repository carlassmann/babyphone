import {
  AlertIcon,
  BabyIcon,
  CheckIcon,
  DeviceIcon,
  DisclosureIcon,
  ForwardIcon,
  RoomIcon,
  type IconComponent,
} from '../../../icons';
import { request } from '../../../connection';
import { RenameField } from '../parts/room-components';
import { useRoom } from '../room-context';

export function SettingsScreen() {
  const room = useRoom();

  return (
    <>
      {!room.isBaby && (
        <SettingsCard icon={RoomIcon} title="Room">
          <RenameField
            label="Room name"
            value={room.session.roomName}
            onSave={(name) => request('rename-room', { ...room.session, name })}
          />
        </SettingsCard>
      )}
      {room.isBaby ? (
        <SettingsCard icon={BabyIcon} title="Device setup">
          <BabySetup />
        </SettingsCard>
      ) : (
        <SettingsCard icon={AlertIcon} title="Notifications">
          <NotificationSetup room={room} />
        </SettingsCard>
      )}
      <section className="side-card settings-links">
        <button type="button" className="settings-link" onClick={room.openSettings}>
          <span className="card-icon">
            <DeviceIcon size={19} />
          </span>
          <span>Manage this device</span>
          <DisclosureIcon size={18} />
        </button>
        {room.preferences}
      </section>
    </>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  children,
}: {
  icon: IconComponent;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="side-card settings-card">
      <header className="card-heading">
        <span className="card-icon">
          <Icon size={19} />
        </span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function BabySetup() {
  return (
    <>
      <p>Keep this device plugged in, with Pip open in the foreground.</p>
      <ul className="check-list">
        <li>
          <CheckIcon size={17} weight="bold" /> Volume is analyzed here
        </li>
        <li>
          <CheckIcon size={17} weight="bold" /> No audio is saved
        </li>
        <li>
          <CheckIcon size={17} weight="bold" /> Parents can listen anytime
        </li>
      </ul>
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
