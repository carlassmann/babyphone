import { createContext, useContext, type ReactNode } from 'react';
import type { Alert, PublicDevice, Session } from '../../protocol';

export type RoomModel = {
  active: boolean;
  audioStatuses: Record<string, string>;
  awake: boolean;
  babies: PublicDevice[];
  busy: boolean;
  connected: boolean;
  events: Alert[];
  isBaby: boolean;
  level: number;
  parents: PublicDevice[];
  preferences: ReactNode;
  pushEnabled: boolean;
  pushTestMessage: string;
  sensitivity: number;
  session: Session;
  changeSensitivity: (deviceId: string, sensitivity: number) => Promise<void>;
  clearEvents: () => Promise<void>;
  enableNotifications: () => Promise<void>;
  listenTo: (deviceId: string) => void;
  openInvitation: () => void;
  openSettings: () => void;
  resumeAudio: (deviceId: string) => void;
  stopListening: (deviceId: string) => void;
  testNotification: () => Promise<void>;
  toggleMonitoring: () => Promise<void>;
};

const RoomContext = createContext<RoomModel | null>(null);

export const RoomProvider = RoomContext.Provider;

export function useRoom() {
  const room = useContext(RoomContext);
  if (!room) throw new Error('Join a room before opening its pages');
  return room;
}
