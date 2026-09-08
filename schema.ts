import { schema as s } from 'jazz-tools';
const tables = {
  rooms: s.table({ keyHash: s.string(), name: s.string(), createdAt: s.float() }),
  devices: s.table({
    roomId: s.string(),
    tokenHash: s.string(),
    name: s.string(),
    role: s.enum('baby', 'parent'),
    lastSeen: s.float(),
    monitoring: s.boolean(),
    level: s.float(),
    lastNoise: s.float(),
    subscription: s.string(),
  }),
  events: s.table({
    roomId: s.string(),
    deviceId: s.string(),
    name: s.string(),
    kind: s.enum('noise', 'offline', 'paused'),
    at: s.float(),
  }),
  signals: s.table({
    roomId: s.string(),
    source: s.string(),
    target: s.string(),
    payload: s.string(),
    at: s.float(),
  }),
};
export const app = s.defineApp(tables);
export type Device = s.RowOf<typeof app.devices>;
export type RoomEvent = s.RowOf<typeof app.events>;
