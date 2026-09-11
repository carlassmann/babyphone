import {
  ArrowRight,
  AudioLines,
  Headphones,
  Mic,
  Moon,
  Pause,
  Sun,
  SunDim,
} from 'lucide-react';
import { relativeTime } from '../../../format';
import { AudioMeter } from '../parts/room-components';
import { useRoom } from '../room-context';
import { SENSITIVITY_THRESHOLDS } from '../../../noise';
import { PipMascot } from '../../../PipMascot';

const AUDIO_ACTIVE_STATUSES = [
  'Listening live',
  'Connecting audio',
  'Tap Resume audio to hear your baby.',
];
const SENSITIVITY_LABELS = ['Low', 'Medium', 'High'];

export function MonitorScreen() {
  const room = useRoom();

  return (
    <section className="monitor-panel">
      {room.isBaby ? <BabyMonitor room={room} /> : <ParentMonitor room={room} />}
    </section>
  );
}

function BabyMonitor({ room }: { room: ReturnType<typeof useRoom> }) {
  const soundDetected = room.active && room.level >= SENSITIVITY_THRESHOLDS[room.sensitivity - 1]!;

  return (
    <>
      <div className="monitor-hero">
        <PipMascot
          state={!room.active ? 'paused' : soundDetected ? 'sound' : 'quiet'}
          alt="Pip sleeping"
        />
        <span className={`status ${room.active && room.connected ? 'green' : ''}`}>
          <i />
          {room.active
            ? room.connected
              ? 'Monitoring'
              : 'Monitoring locally only'
            : 'Ready when you are'}
        </span>
        <h2>{room.active ? 'Monitoring sound' : 'Ready to monitor'}</h2>
        <p>
          {room.active
            ? 'Listening for sustained sounds in this room.'
            : 'Place this device near your baby, out of reach.'}
        </p>
      </div>
      <div className="meter-wrap">
        <div>
          <span>Room sound</span>
          <span>{soundDetected ? 'A little sound' : room.active ? 'Quiet' : 'Microphone off'}</span>
        </div>
        <AudioMeter value={room.active ? room.level : 0} />
      </div>
      <button
        type="button"
        className={`primary full ${room.active ? 'stop' : ''}`}
        disabled={room.busy || (!room.active && !room.connected)}
        onClick={() => void room.toggleMonitoring()}
      >
        {room.active ? <Pause size={19} /> : <Mic size={19} />}{' '}
        {room.busy ? 'Opening microphone…' : room.active ? 'Pause monitoring' : 'Start monitoring'}
      </button>
      <div className="baby-checks">
        <span>
          <Mic size={15} />
          {room.active ? 'Microphone on' : 'Microphone off'}
        </span>
        <span>
          <Sun size={15} />
          {room.awake ? 'Screen staying awake' : 'Screen wake lock off'}
        </span>
        <span>
          <Headphones size={15} />
          {room.parents.length} parent {room.parents.length === 1 ? 'device' : 'devices'} online
        </span>
      </div>
      {room.active && <DimControl room={room} />}
      {room.active && !room.awake && (
        <p className="notice">
          Keep the screen awake manually. Automatic screen wake lock is unavailable.
        </p>
      )}
      <Sensitivity
        id="sensitivity"
        value={room.sensitivity}
        onChange={(value) => void room.changeSensitivity(room.session.deviceId, value)}
      />
    </>
  );
}

function DimControl({ room }: { room: ReturnType<typeof useRoom> }) {
  return (
    <button
      type="button"
      className="secondary small dim-control"
      aria-pressed={room.dimmed}
      title={room.dimmed ? 'Restore screen brightness' : 'Reduce screen brightness'}
      onClick={room.toggleDim}
    >
      {room.dimmed ? <Sun size={18} /> : <SunDim size={18} />}
      {room.dimmed ? 'Restore brightness' : 'Dim screen'}
    </button>
  );
}

function ParentMonitor({ room }: { room: ReturnType<typeof useRoom> }) {
  if (room.babies.length === 0) {
    return (
      <div className="empty-nest">
        <PipMascot
          className="empty-nest-mascot"
          state="quiet"
          alt="Pip waiting for a baby device"
        />
        <h2>Add your baby device</h2>
        <p>
          Add a device to stay with your baby.
          <br />
          Open the invitation on the phone that stays in the nursery.
        </p>
        <button type="button" className="primary" onClick={room.openInvitation}>
          Invite a baby device <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  const listening = room.babies.some((device) => isListening(room.audioStatuses[device.id]));

  return (
    <div className="device-list">
      {room.babies.map((device) => (
        <article className="device-card" key={device.id}>
          <div className="device-heading">
            <div className="device-icon">
              <Moon size={25} />
            </div>
            <div>
              <h3>{device.name}</h3>
              <span className={`status ${device.monitoring && room.connected ? 'green' : 'amber'}`}>
                <i />
                {!room.connected
                  ? 'Connection unknown'
                  : !device.online
                    ? 'Offline · check device'
                    : device.monitoring
                      ? 'Monitoring'
                      : 'Monitoring paused'}
              </span>
            </div>
          </div>
          <AudioMeter value={device.monitoring && room.connected ? device.level : 0} />
          <Sensitivity
            id={`sensitivity-${device.id}`}
            label={`${device.name} sound sensitivity`}
            value={device.sensitivity}
            disabled={!room.connected}
            onChange={(value) => void room.changeSensitivity(device.id, value)}
          />
          <div className="device-bottom">
            <span className="caption">
              {device.lastNoise
                ? `Last sound ${relativeTime(device.lastNoise)}`
                : 'No sounds detected yet'}
            </span>
            {isListening(room.audioStatuses[device.id]) ? (
              <button
                type="button"
                className="secondary small"
                onClick={() => room.stopListening(device.id)}
              >
                <Pause size={16} /> Stop listening
              </button>
            ) : (
              <button
                type="button"
                className="primary small"
                disabled={!room.connected || !device.monitoring}
                onClick={() => room.listenTo(device.id)}
              >
                <Headphones size={17} /> Listen
              </button>
            )}
          </div>
          {room.audioStatuses[device.id] && (
            <div className="audio-status" role="status">
              <AudioLines size={16} />
              {room.audioStatuses[device.id]}
              {room.audioStatuses[device.id]?.includes('Resume') && (
                <button type="button" onClick={() => room.resumeAudio(device.id)}>
                  Resume audio
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {listening && <DimControl room={room} />}
    </div>
  );
}

function Sensitivity({
  disabled,
  id,
  label,
  value,
  onChange,
}: {
  disabled?: boolean;
  id: string;
  label?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="sensitivity">
      <label htmlFor={id}>
        Sound sensitivity <span>{SENSITIVITY_LABELS[value - 1]}</span>
      </label>
      <input
        id={id}
        aria-label={label}
        type="range"
        min="1"
        max="3"
        step="1"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {id === 'sensitivity' && (
        <p className="caption">
          Alerts after 1.5 seconds of sound, with 20 seconds between alerts.
        </p>
      )}
    </div>
  );
}

function isListening(status?: string) {
  return Boolean(status && AUDIO_ACTIVE_STATUSES.includes(status));
}
