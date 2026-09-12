import { request } from '../../../connection';
import type { Session, Signal } from '../../../protocol';

const CALL_TIMEOUT_MS = 15_000;
const EARLY_CANDIDATE_TTL_MS = 30_000;
const MAX_EARLY_CANDIDATES_PER_CALL = 32;
const MAX_PENDING_CALLS = 50;

export type AudioStatus =
  'connecting' | 'live' | 'paused' | 'stopped' | 'disconnected' | 'failed' | '';

type Call = {
  peer: RTCPeerConnection;
  audio?: HTMLAudioElement;
  target: string;
  callId: string;
  pendingCandidates: RTCIceCandidateInit[];
  timeout: ReturnType<typeof setTimeout>;
};

type EarlyCandidates = {
  source: string;
  candidates: RTCIceCandidateInit[];
  receivedAt: number;
};

export class AudioCalls {
  private calls = new Map<string, Call>();
  private iceServers: RTCIceServer[] = [];
  private generation = 0;
  private attempts = new Map<string, number>();
  private earlyCandidates = new Map<string, EarlyCandidates>();

  constructor(
    private send: (target: string, payload: Signal) => void,
    private getStream: () => MediaStream | undefined,
    private audioContainer: HTMLDivElement,
    private onStatus: (status: AudioStatus, target?: string) => void,
    private session: Session,
  ) {}

  async listen(target: string) {
    this.stop(target);
    const generation = this.generation;
    const attempt = this.attempts.get(target);
    this.onStatus('connecting', target);

    await this.configure();
    if (generation !== this.generation || attempt !== this.attempts.get(target)) return;

    const callId = crypto.randomUUID();
    const { peer } = this.createCall(target, callId, true);
    peer.addTransceiver('audio', { direction: 'recvonly' });
    await peer.setLocalDescription(await peer.createOffer());
    if (!this.calls.has(callId)) return;

    this.send(target, { kind: 'offer', callId, description: peer.localDescription!.toJSON() });
  }

  async receive(source: string, signal: Signal) {
    this.discardExpiredCandidates();
    let call = this.calls.get(signal.callId);

    if (signal.kind === 'ice' && signal.candidate && !call) {
      this.rememberEarlyCandidate(source, signal.callId, signal.candidate);
      return;
    }

    if (signal.kind === 'stop') {
      if (call?.target === source) {
        this.endCall(signal.callId, false);
        this.onStatus('stopped', source);
      }
      return;
    }

    if (signal.kind === 'offer') {
      await this.answerOffer(source, signal);
      return;
    }

    if (!call || call.target !== source) return;
    if (signal.kind === 'answer') {
      await call.peer.setRemoteDescription(signal.description!);
      for (const candidate of call.pendingCandidates) await call.peer.addIceCandidate(candidate);
      call.pendingCandidates = [];
    } else if (signal.kind === 'ice' && signal.candidate) {
      if (call.peer.remoteDescription) await call.peer.addIceCandidate(signal.candidate);
      else call.pendingCandidates.push(signal.candidate);
    }
  }

  async resume(target: string) {
    const call = [...this.calls.values()].find(
      ({ audio, target: peer }) => peer === target && audio,
    );
    if (!call?.audio) return;
    await call.audio.play();
    if (this.calls.get(call.callId) === call) this.onStatus('live', target);
  }

  stop(target?: string) {
    if (target) this.attempts.set(target, (this.attempts.get(target) ?? 0) + 1);
    else {
      ++this.generation;
      this.earlyCandidates.clear();
    }

    for (const [callId, call] of this.calls) {
      if (!target || call.target === target) this.endCall(callId);
    }
    this.onStatus('', target);
  }

  private async configure() {
    this.iceServers = (await request('ice', this.session)).iceServers;
  }

  private createCall(target: string, callId: string, listening: boolean) {
    const peer = new RTCPeerConnection({ iceServers: this.iceServers });
    const audio = listening ? this.createAudioElement(target) : undefined;
    const call: Call = {
      audio,
      peer,
      target,
      callId,
      pendingCandidates: [],
      timeout: setTimeout(() => {
        this.endCall(callId);
        this.onStatus('failed', target);
      }, CALL_TIMEOUT_MS),
    };

    this.calls.set(callId, call);
    this.bindAudioEvents(call);
    this.bindPeerEvents(call, listening);
    return call;
  }

  private createAudioElement(target: string) {
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.dataset.deviceId = target;
    this.audioContainer.append(audio);
    return audio;
  }

  private bindAudioEvents(call: Call) {
    if (!call.audio) return;
    call.audio.onpause = () => {
      if (this.calls.has(call.callId)) {
        this.onStatus('paused', call.target);
      }
    };
    call.audio.onended = () => {
      if (!this.calls.has(call.callId)) return;
      this.endCall(call.callId);
      this.onStatus('disconnected', call.target);
    };
  }

  private bindPeerEvents(call: Call, listening: boolean) {
    const { peer, callId, target } = call;
    peer.onicecandidate = ({ candidate }) => {
      if (candidate) this.send(target, { kind: 'ice', callId, candidate: candidate.toJSON() });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        clearTimeout(call.timeout);
        if (listening) {
          this.onStatus(call.audio?.paused ? 'paused' : 'live', target);
        }
      }
      if (['failed', 'disconnected'].includes(peer.connectionState)) {
        this.endCall(callId);
        if (listening) this.onStatus('disconnected', target);
      }
    };
    peer.ontrack = ({ streams, track }) => {
      if (!call.audio) return;
      call.audio.srcObject = streams[0] ?? new MediaStream([track]);
      void call.audio
        .play()
        .then(() => {
          if (this.calls.has(callId)) this.onStatus('live', target);
        })
        .catch(() => {
          if (this.calls.has(callId)) this.onStatus('paused', target);
        });
    };
  }

  private async answerOffer(source: string, signal: Signal) {
    const stream = this.getStream();
    if (!stream) {
      this.send(source, { kind: 'stop', callId: signal.callId });
      return;
    }

    for (const call of this.calls.values()) {
      if (call.target === source) this.endCall(call.callId);
    }

    const generation = this.generation;
    const attempt = this.attempts.get(source);
    await this.configure();
    if (
      generation !== this.generation ||
      attempt !== this.attempts.get(source) ||
      this.getStream() !== stream
    ) {
      return;
    }

    const call = this.createCall(source, signal.callId, false);
    stream.getTracks().forEach((track) => call.peer.addTrack(track, stream));
    await call.peer.setRemoteDescription(signal.description!);

    const earlyCandidates = this.earlyCandidates.get(signal.callId);
    if (earlyCandidates?.source === source) {
      for (const candidate of earlyCandidates.candidates)
        await call.peer.addIceCandidate(candidate);
    }
    this.earlyCandidates.delete(signal.callId);

    await call.peer.setLocalDescription(await call.peer.createAnswer());
    this.send(source, {
      kind: 'answer',
      callId: signal.callId,
      description: call.peer.localDescription!.toJSON(),
    });
  }

  private rememberEarlyCandidate(source: string, callId: string, candidate: RTCIceCandidateInit) {
    const entry = this.earlyCandidates.get(callId) ?? {
      source,
      candidates: [],
      receivedAt: Date.now(),
    };
    if (
      entry.source !== source ||
      entry.candidates.length >= MAX_EARLY_CANDIDATES_PER_CALL ||
      this.earlyCandidates.size >= MAX_PENDING_CALLS
    ) {
      return;
    }
    entry.candidates.push(candidate);
    this.earlyCandidates.set(callId, entry);
  }

  private discardExpiredCandidates() {
    for (const [callId, entry] of this.earlyCandidates) {
      if (Date.now() - entry.receivedAt > EARLY_CANDIDATE_TTL_MS) {
        this.earlyCandidates.delete(callId);
      }
    }
  }

  private endCall(callId: string, notifyPeer = true) {
    const call = this.calls.get(callId);
    if (!call) return;

    this.calls.delete(callId);
    clearTimeout(call.timeout);
    call.peer.close();
    if (notifyPeer) this.send(call.target, { kind: 'stop', callId });
    if (call.audio) {
      call.audio.pause();
      call.audio.srcObject = null;
      call.audio.remove();
      this.onStatus('', call.target);
    }
  }
}
