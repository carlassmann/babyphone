import {
  AlertIcon,
  BabyIcon,
  CheckIcon,
  DeviceIcon,
  DisclosureIcon,
  ForwardIcon,
  LanguageIcon,
  ParentIcon,
  RoomIcon,
  type IconComponent,
} from '../../../icons';
import { useState } from 'react';
import { request } from '../../../connection';
import type { PublicDevice } from '../../../protocol';
import { RenameField } from '../parts/room-components';
import { RemoveDeviceConfirmation } from '../parts/room-modals';
import { useRoom } from '../room-context';
import { useIntl } from '../../../intl/setup';
import { LanguageSelect } from '../../../LanguageSelect';

export function SettingsScreen() {
  const t = useIntl();
  const room = useRoom();

  return (
    <>
      {!room.isBaby && (
        <SettingsCard icon={RoomIcon} title={t('settings.room')}>
          <RenameField
            label={t('settings.roomName')}
            testId="rename-room"
            value={room.session.roomName}
            onSave={(name) => request('rename-room', { ...room.session, name })}
          />
        </SettingsCard>
      )}
      <RoomDevices room={room} />
      {room.isBaby ? (
        <SettingsCard icon={BabyIcon} title={t('settings.deviceSetup')}>
          <BabySetup />
        </SettingsCard>
      ) : (
        <SettingsCard icon={AlertIcon} title={t('settings.notifications')}>
          <NotificationSetup room={room} />
        </SettingsCard>
      )}
      <SettingsCard icon={LanguageIcon} title={t('language.title')}>
        <p>{t('language.description')}</p>
        <LanguageSelect />
      </SettingsCard>
      <section className="side-card settings-links">
        <button
          type="button"
          className="settings-link"
          data-testid="manage-device"
          onClick={room.openSettings}
        >
          <span className="card-icon">
            <DeviceIcon size={19} />
          </span>
          <span>{t('settings.manageDevice')}</span>
          <DisclosureIcon size={18} />
        </button>
        {room.preferences}
      </section>
    </>
  );
}

function RoomDevices({ room }: { room: ReturnType<typeof useRoom> }) {
  const t = useIntl();
  const [pendingRemoval, setPendingRemoval] = useState<PublicDevice | null>(null);
  const otherDevices = room.devices.filter((device) => device.id !== room.session.deviceId);

  if (otherDevices.length === 0 && !room.accessNotice) return null;

  return (
    <SettingsCard icon={ParentIcon} title={t('settings.devicesTitle')}>
      <ul className="device-rows">
        {otherDevices.map((device) => (
          <DeviceRow
            key={device.id}
            device={device}
            room={room}
            onRemove={() => setPendingRemoval(device)}
          />
        ))}
      </ul>
      {room.accessNotice ? (
        <p className="caption" role="status">
          {room.accessNotice}
        </p>
      ) : (
        <p className="caption">{t('settings.devicesHint')}</p>
      )}
      {pendingRemoval && (
        <RemoveDeviceConfirmation
          device={pendingRemoval}
          busy={room.busy}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            room.removeDevice(pendingRemoval.id);
            setPendingRemoval(null);
          }}
        />
      )}
    </SettingsCard>
  );
}

function DeviceRow({
  device,
  room,
  onRemove,
}: {
  device: PublicDevice;
  room: ReturnType<typeof useRoom>;
  onRemove: () => void;
}) {
  const t = useIntl();
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    return (
      <li className="renaming">
        <RenameField
          label={t('settings.deviceNameFor', { name: device.name })}
          testId="rename-device"
          value={device.name}
          onSave={async (name) => {
            await request('rename-device', { ...room.session, name, target: device.id });
            setRenaming(false);
          }}
        />
        <button type="button" className="quiet small" onClick={() => setRenaming(false)}>
          {t('common.cancel')}
        </button>
      </li>
    );
  }

  return (
    <li data-testid="device-row" data-device-id={device.id} data-device-name={device.name}>
      <span className="card-icon">
        {device.role === 'baby' ? <BabyIcon size={19} /> : <ParentIcon size={19} />}
      </span>
      <div>
        <strong>{device.name}</strong>
        <span>
          {device.role === 'baby' ? t('role.baby') : t('role.parent')} ·{' '}
          {device.online ? t('settings.deviceOnline') : t('settings.deviceOffline')}
        </span>
      </div>
      <button
        type="button"
        className="quiet small"
        data-testid="device-rename"
        disabled={!room.connected}
        onClick={() => setRenaming(true)}
        aria-label={t('settings.renameLabel', { name: device.name })}
      >
        {t('settings.rename')}
      </button>
      <button
        type="button"
        className="quiet small danger"
        data-testid="device-remove"
        disabled={room.busy || !room.connected}
        onClick={onRemove}
        aria-label={t('settings.removeLabel', { name: device.name })}
      >
        {t('settings.remove')}
      </button>
    </li>
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
  const t = useIntl();
  return (
    <>
      <p>{t('settings.babyKeepPlugged')}</p>
      <ul className="check-list">
        <li>
          <CheckIcon size={17} weight="bold" /> {t('settings.babyCheckAnalyzed')}
        </li>
        <li>
          <CheckIcon size={17} weight="bold" /> {t('settings.babyCheckNoSave')}
        </li>
        <li>
          <CheckIcon size={17} weight="bold" /> {t('settings.babyCheckListen')}
        </li>
      </ul>
    </>
  );
}

function NotificationSetup({ room }: { room: ReturnType<typeof useRoom> }) {
  const t = useIntl();
  return (
    <>
      <p>{t('settings.notificationsBody')}</p>
      <button
        type="button"
        className={room.pushEnabled ? 'secondary full small' : 'primary full small'}
        data-testid="enable-notifications"
        disabled={room.busy || room.pushEnabled || !room.connected}
        onClick={() => void room.enableNotifications()}
      >
        {room.pushEnabled ? <CheckIcon size={17} weight="bold" /> : <AlertIcon size={17} />}{' '}
        {room.pushEnabled ? t('settings.notificationsEnabled') : t('settings.notificationsEnable')}
      </button>
      {room.pushEnabled && (
        <button
          type="button"
          className="quiet full small"
          data-testid="test-notification"
          disabled={room.busy}
          onClick={() => void room.testNotification()}
        >
          {t('settings.notificationsTest')} <ForwardIcon size={16} />
        </button>
      )}
      {room.pushTestMessage && (
        <p className="caption" role="status">
          {room.pushTestMessage}
        </p>
      )}
      <p className="caption">{t('settings.notificationsHint')}</p>
    </>
  );
}
