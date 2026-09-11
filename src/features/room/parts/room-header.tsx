import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { AddIcon, ParentIcon, SettingsIcon, SoundIcon } from '../../../icons';

const ROOM_NAVIGATION = [
  ['/app', 'Monitor', ParentIcon],
  ['/app/activity', 'Activity', SoundIcon],
  ['/app/settings', 'Settings', SettingsIcon],
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
  return (
    <header className="room-header">
      <Link to="/app" className="room-brand" aria-label="Pip home">
        <img src="/icon.svg" alt="" />
      </Link>
      <h1 aria-label={roomName}>{roomSwitcher}</h1>
      <nav className="room-navigation" aria-label="Room navigation">
        {ROOM_NAVIGATION.map(([to, label, Icon]) => (
          <Link key={to} to={to} activeOptions={{ exact: true }}>
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="room-tools">
        <button
          type="button"
          className="secondary small invite-device-button"
          aria-label="Invite device"
          onClick={onInvite}
        >
          <AddIcon size={18} weight="bold" />
          <span className="invite-device-label">Invite device</span>
        </button>
      </div>
    </header>
  );
}
