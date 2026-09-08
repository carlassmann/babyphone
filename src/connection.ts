import { HEARTBEAT_MS, OFFLINE_MS, type ServerMessage, type Session } from './protocol';
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
    private onStatus: (state: string) => void,
    private heartbeat: () => { monitoring: boolean; level: number },
  ) {
    this.connect();
  }
  private connect() {
    if (this.stopped) return;
    this.onStatus('Connecting');
    this.openedAt = Date.now();
    const socket = (this.socket = new WebSocket(
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws`,
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
      if (event.code === 4009) {
        this.onStatus('Open in another tab');
        this.stopped = true;
        return;
      }
      this.onStatus('Connection lost');
      this.retry = setTimeout(() => this.connect(), Math.min(500 * 2 ** this.attempt++, 5000));
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
        this.retry = setTimeout(() => this.connect(), 500);
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
    this.socket?.close();
  }
}
export async function request(path: string, body: object) {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Connection problem. Try again.');
  return result;
}
