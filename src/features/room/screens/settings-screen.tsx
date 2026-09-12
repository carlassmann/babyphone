import {
  AlertIcon,
  BabyIcon,
  CheckIcon,
  DeviceIcon,
  DisclosureIcon,
  ParentIcon,
  type IconComponent,
} from '../../../icons';
import { useState, type ReactNode } from 'react';
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
    <div className="settings">
      {!room.isBaby && (
        <SettingsGroup title={t('settings.room')}>
          <li className="settings-row settings-row-field">
            <RenameField
              label={t('settings.roomName')}
              testId="rename-room"
              value={room.session.roomName}
              onSave={(name) => request('rename-room', { ...room.session, name })}
            />
          </li>
        </SettingsGroup>
      )}
      <RoomDevices room={room} />
      {room.isBaby ? <BabySetup /> : <NotificationSetup room={room} />}
      <SettingsGroup title={t('language.title')}>
        <li className="settings-row">
          <span className="settings-row-label">{t('language.label')}</span>
          <LanguageSelect showLabel={false} />
        </li>
      </SettingsGroup>
      <SettingsGroup title={t('settings.thisDevice')}>
        <SettingsLinkRow
          icon={DeviceIcon}
          label={t('settings.manageDevice')}
          testId="manage-device"
          onClick={room.openSettings}
        />
        {room.preferences}
      </SettingsGroup>
    </div>
  );
}

function SettingsGroup({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="settings-group">
      <h3 className="settings-group-title">{title}</h3>
      <ul className="settings-list">{children}</ul>
      {footer && <p className="settings-group-footer">{footer}</p>}
    </section>
  );
}

export function SettingsLinkRow({
  icon: Icon,
  label,
  testId,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" className="settings-link" data-testid={testId} onClick={onClick}>
        <span className="card-icon">
          <Icon size={19} />
        </span>
        <span>{label}</span>
        <DisclosureIcon size={18} />
      </button>
    </li>
  );
}

function RoomDevices({ room }: { room: ReturnType<typeof useRoom> }) {
  const t = useIntl();
  const [pendingRemoval, setPendingRemoval] = useState<PublicDevice | null>(null);
  const otherDevices = room.devices.filter((device) => device.id !== room.session.deviceId);

  if (otherDevices.length === 0 && !room.accessNotice) return null;

  return (
    <SettingsGroup
      title={t('settings.devicesTitle')}
      footer={
        room.accessNotice ? (
          <span role="status">{room.accessNotice}</span>
        ) : (
          t('settings.devicesHint')
        )
      }
    >
      {otherDevices.map((device) => (
        <DeviceRow
          key={device.id}
          device={device}
          room={room}
          onRemove={() => setPendingRemoval(device)}
        />
      ))}
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
    </SettingsGroup>
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
      <li className="settings-row settings-row-field">
        <RenameField
          label={t('settings.deviceNameFor', { name: device.name })}
          testId="rename-device"
          value={device.name}
          onSave={async (name) => {
            await request('rename-device', { ...room.session, name, target: device.id });
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      </li>
    );
  }

  return (
    <li
      className="settings-row device-row"
      data-testid="device-row"
      data-device-id={device.id}
      data-device-name={device.name}
    >
      <span className="card-icon">
        {device.role === 'baby' ? <BabyIcon size={19} /> : <ParentIcon size={19} />}
      </span>
      <div className="settings-row-text">
        <strong>{device.name}</strong>
        <span>
          {device.role === 'baby' ? t('role.baby') : t('role.parent')} ·{' '}
          {device.online ? t('settings.deviceOnline') : t('settings.deviceOffline')}
        </span>
      </div>
      <div className="device-row-actions">
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
      </div>
    </li>
  );
}

function BabySetup() {
  const t = useIntl();
  return (
    <SettingsGroup title={t('settings.deviceSetup')} footer={t('settings.babyKeepPlugged')}>
      <li className="settings-row">
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
      </li>
    </SettingsGroup>
  );
}

function NotificationSetup({ room }: { room: ReturnType<typeof useRoom> }) {
  const t = useIntl();
  return (
    <SettingsGroup
      title={t('settings.notifications')}
      footer={
        room.pushTestMessage ? (
          <span role="status">{room.pushTestMessage}</span>
        ) : (
          t('settings.notificationsHint')
        )
      }
    >
      {room.pushEnabled ? (
        <li className="settings-row">
          <span className="card-icon">
            <AlertIcon size={19} />
          </span>
          <div className="settings-row-text">
            <strong>{t('settings.notificationsEnabled')}</strong>
            <span>{t('settings.notificationsBody')}</span>
          </div>
          <CheckIcon size={20} weight="bold" className="settings-row-check" />
        </li>
      ) : (
        <li className="settings-row settings-row-stack">
          <p>{t('settings.notificationsBody')}</p>
          <button
            type="button"
            className="primary full small"
            data-testid="enable-notifications"
            disabled={room.busy || !room.connected}
            onClick={() => void room.enableNotifications()}
          >
            <AlertIcon size={17} /> {t('settings.notificationsEnable')}
          </button>
        </li>
      )}
      {room.pushEnabled && (
        <li>
          <button
            type="button"
            className="settings-link"
            data-testid="test-notification"
            disabled={room.busy}
            onClick={() => void room.testNotification()}
          >
            <span>{t('settings.notificationsTest')}</span>
            <DisclosureIcon size={18} />
          </button>
        </li>
      )}
    </SettingsGroup>
  );
}
