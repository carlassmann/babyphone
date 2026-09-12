import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { AddIcon, ParentIcon, SettingsIcon, SoundIcon } from '../../../icons';
import { useIntl } from '../../../intl/setup';

const ROOM_NAVIGATION = [
  ['/app', 'nav-monitor', 'nav.monitor', ParentIcon],
  ['/app/activity', 'nav-activity', 'nav.activity', SoundIcon],
  ['/app/settings', 'nav-settings', 'nav.settings', SettingsIcon],
] as const;

export function RoomHeader({
  roomName,
  roomSwitcher,
  onInvite,
}: {
  roomName: string;
  roomSwitcher: ReactNode;
  onInvite: () => void;
}) {
  const t = useIntl();
  return (
    <header className="room-header">
      <Link to="/app" className="room-brand" aria-label={t('app.roomHomeLabel')}>
        <img src="/icon.svg" alt="" />
      </Link>
      <h1 data-testid="room-title" data-room-name={roomName} aria-label={roomName}>
        {roomSwitcher}
      </h1>
      <nav className="room-navigation" aria-label={t('nav.roomLabel')}>
        {ROOM_NAVIGATION.map(([to, testId, label, Icon]) => (
          <Link key={to} to={to} activeOptions={{ exact: true }} data-testid={testId}>
            <Icon size={19} />
            <span>{t(label)}</span>
          </Link>
        ))}
      </nav>
      <div className="room-tools">
        <button
          type="button"
          className="secondary small invite-device-button"
          data-testid="invite-device"
          aria-label={t('room.inviteDevice')}
          onClick={onInvite}
        >
          <AddIcon size={18} weight="bold" />
          <span className="invite-device-label">{t('room.inviteDevice')}</span>
        </button>
      </div>
    </header>
  );
}
