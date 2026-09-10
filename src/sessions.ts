import type { Session } from './protocol';

const ACTIVE_SESSION_KEY = 'pip-session';
const SAVED_ROOMS_KEY = 'pip-rooms';

function isSession(value: unknown): value is Session {
  const session = value as Session | null;
  return (
    !!session?.token &&
    !!session.deviceId &&
    /^[a-f0-9]{64}$/.test(session.roomId || '') &&
    ['baby', 'parent'].includes(session.role)
  );
}

function readStoredJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function readSession(): Session | null {
  const value = readStoredJson(ACTIVE_SESSION_KEY);
  return isSession(value) ? value : null;
}

export function readRooms(): Session[] {
  const value = readStoredJson(SAVED_ROOMS_KEY);
  let rooms = Array.isArray(value) ? value.filter(isSession) : [];
  const active = readSession();
  if (active) rooms = [...rooms.filter((room) => room.roomId !== active.roomId), active];
  return rooms;
}

export function storeActive(session: Session | null) {
  if (session) localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(ACTIVE_SESSION_KEY);
}

export function storeRooms(rooms: Session[]) {
  localStorage.setItem(SAVED_ROOMS_KEY, JSON.stringify(rooms));
  return rooms;
}

export function sessionsEqual(left: Session, right: Session) {
  return (
    left.roomId === right.roomId &&
    left.roomName === right.roomName &&
    left.roomKey === right.roomKey &&
    left.deviceId === right.deviceId &&
    left.token === right.token &&
    left.name === right.name &&
    left.role === right.role
  );
}
