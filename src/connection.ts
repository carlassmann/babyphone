import { HEARTBEAT_MS, OFFLINE_MS, type ServerMessage, type Session } from './protocol';
import { readLocale } from './intl/locale';
import { translate } from './intl/standalone';

export type ConnectionStatus =
  | 'Connecting'
  | 'Connected'
  | 'Connection lost'
  | 'Access removed'
  | 'Room inactive'
  | 'Open in another tab';

const TERMINAL_CLOSE_STATUSES: Partial<Record<number, ConnectionStatus>> = {
  4001: 'Access removed',
  4008: 'Room inactive',
  4009: 'Open in another tab',
};

const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

export class RoomConnection {
  private socket?: WebSocket;
  private stopped = false;
  private retry?: ReturnType<typeof setTimeout>;
  private ticker?: ReturnType<typeof setInterval>;
  private lastState = 0;
  private openedAt = 0;
  private attempt = 0;
  private ready = false;
  constructor(
    private session: Session,
    private onMessage: (message: ServerMessage) => void,
    private onStatus: (status: ConnectionStatus) => void,
    private heartbeat: () => { monitoring: boolean; level: number },
  ) {
    this.connect();
  }
  private connect() {
    if (this.stopped) return;
    this.onStatus('Connecting');
    this.openedAt = Date.now();
    const socket = (this.socket = new WebSocket(
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws?roomId=${encodeURIComponent(this.session.roomId)}`,
    ));
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: 'hello',
          deviceId: this.session.deviceId,
          token: this.session.token,
        }),
      );
    socket.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      if (message.type === 'ready') {
        this.ready = true;
        this.attempt = 0;
        this.lastState = Date.now();
        this.onStatus('Connected');
        this.send({ type: 'heartbeat', ...this.heartbeat() });
      }
      if (message.type === 'state') {
        this.lastState = Date.now();
        this.onStatus('Connected');
      }
      this.onMessage(message);
    };
    socket.onclose = (event) => {
      this.ready = false;
      clearInterval(this.ticker);
      if (this.stopped) return;
      const terminalStatus = TERMINAL_CLOSE_STATUSES[event.code];
      if (terminalStatus) {
        this.onStatus(terminalStatus);
        this.stopped = true;
        return;
      }
      this.onStatus('Connection lost');
      const retryDelay = Math.min(INITIAL_RETRY_MS * 2 ** this.attempt++, MAX_RETRY_MS);
      this.retry = setTimeout(() => this.connect(), retryDelay);
    };
    socket.onerror = () => socket.close();
    this.ticker = setInterval(() => {
      if (
        (!this.ready && Date.now() - this.openedAt > OFFLINE_MS) ||
        (this.ready && Date.now() - this.lastState > OFFLINE_MS)
      ) {
        this.ready = false;
        clearInterval(this.ticker);
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
        this.onStatus('Connection lost');
        this.retry = setTimeout(() => this.connect(), INITIAL_RETRY_MS);
      } else this.send({ type: 'heartbeat', ...this.heartbeat() });
    }, HEARTBEAT_MS);
  }
  send(message: object) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ ...message, token: this.session.token }));
    return true;
  }
  close() {
    this.stopped = true;
    clearTimeout(this.retry);
    clearInterval(this.ticker);
    if (this.socket) {
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
    }
  }
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export async function request(path: string, body: object) {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, locale: readLocale() }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(result.error || translate()('common.error.connection'), response.status);
  return result;
}
