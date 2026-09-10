import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { AudioLines, Headphones, Moon, Plus, Settings, Sun } from 'lucide-react';

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
          className="icon-button"
          aria-label={dimmed ? 'Brighten screen' : 'Dim screen'}
          aria-pressed={dimmed}
          onClick={onToggleDim}
        >
          {dimmed ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button
          type="button"
          className="secondary small"
          aria-label="Invite device"
          onClick={onInvite}
        >
          <Plus size={17} />
          <span>Invite device</span>
        </button>
      </div>
    </header>
  );
}
