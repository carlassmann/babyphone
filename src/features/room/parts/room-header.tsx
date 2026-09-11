import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { AudioLines, Headphones, Plus, Settings, Sun, SunDim } from 'lucide-react';

const ROOM_NAVIGATION = [
  ['/app', 'Monitor', Headphones],
  ['/app/activity', 'Activity', AudioLines],
  ['/app/settings', 'Settings', Settings],
] as const;

export function RoomHeader({
  dimmed,
  roomName,
  roomSwitcher,
  onInvite,
  onToggleDim,
}: {
  dimmed: boolean;
  roomName: string;
  roomSwitcher: ReactNode;
  onInvite: () => void;
  onToggleDim: () => void;
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
          className="secondary small dim-control"
          aria-label={dimmed ? 'Restore brightness' : 'Dim screen'}
          aria-pressed={dimmed}
          title={dimmed ? 'Restore screen brightness' : 'Reduce screen brightness'}
          onClick={onToggleDim}
        >
          {dimmed ? <Sun size={18} /> : <SunDim size={18} />}
          <span>{dimmed ? 'Restore brightness' : 'Dim screen'}</span>
        </button>
        <button
          type="button"
          className="secondary small invite-device-button"
          aria-label="Invite device"
          onClick={onInvite}
        >
          <Plus size={17} />
          <span className="invite-device-label">Invite device</span>
        </button>
      </div>
    </header>
  );
}
