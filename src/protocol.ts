export type Role = 'baby' | 'parent';
export type Session = {
  roomId: string;
  roomName: string;
  deviceId: string;
  token: string;
  name: string;
  role: Role;
  roomKey: string;
};
export type PublicDevice = {
  id: string;
  name: string;
  role: Role;
  online: boolean;
  monitoring: boolean;
  level: number;
  lastNoise: number;
  sensitivity: number;
  lastSeen: number;
};
export type Alert = {
  id: string;
  deviceId: string;
  name: string;
  kind: 'noise' | 'offline' | 'paused';
  at: number;
};
export type ServerMessage =
  | { type: 'state'; roomKey?: string; devices: PublicDevice[]; events: Alert[]; at: number }
  | { type: 'signal'; source: string; payload: Signal }
  | { type: 'error'; message: string }
  | { type: 'ready' };
export type Signal = {
  callId: string;
  kind: 'offer' | 'answer' | 'ice' | 'stop';
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};
export const HEARTBEAT_MS = 3000;
export const OFFLINE_MS = 12000;
