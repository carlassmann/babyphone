import type { Session } from './protocol';

function valid(value: unknown): value is Session {
  const session = value as Session | null;
  return (
    !!session?.token &&
    !!session.deviceId &&
    /^[a-f0-9]{64}$/.test(session.roomId || '') &&
    ['baby', 'parent'].includes(session.role)
  );
}
export function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem('pip-session') || 'null');
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}
export function readRooms(): Session[] {
  let rooms: Session[] = [];
  try {
    const value = JSON.parse(localStorage.getItem('pip-rooms') || '[]');
    if (Array.isArray(value)) rooms = value.filter(valid);
  } catch {}
  const active = readSession();
  if (active) rooms = [...rooms.filter((room) => room.roomId !== active.roomId), active];
  return rooms;
}
export function storeActive(session: Session | null) {
  if (session) localStorage.setItem('pip-session', JSON.stringify(session));
  else localStorage.removeItem('pip-session');
}
export function storeRooms(rooms: Session[]) {
  localStorage.setItem('pip-rooms', JSON.stringify(rooms));
  return rooms;
}
