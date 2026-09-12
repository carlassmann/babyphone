import {
  AlertIcon,
  AlertMutedIcon,
  BabyIcon,
  BrightIcon,
  DimIcon,
  ForwardIcon,
  MicrophoneIcon,
  ParentIcon,
  PauseIcon,
  SoundIcon,
} from '../../../icons';
import { relativeTime } from '../../../format';
import type { PublicDevice } from '../../../protocol';
import { AudioMeter } from '../parts/room-components';
import { useRoom } from '../room-context';
import { SENSITIVITY_THRESHOLDS } from '../../../noise';
import { PipMascot } from '../../../PipMascot';
import { T, useIntl } from '../../../intl/setup';
import type { MessageKey } from '../../../intl/messages';
import type { AudioStatus } from '../lib/audio-calls';

const AUDIO_ACTIVE_STATUSES: AudioStatus[] = ['connecting', 'live', 'paused'];
const AUDIO_STATUS_KEYS = {
  connecting: 'audio.connecting',
  live: 'audio.live',
  paused: 'audio.paused',
  stopped: 'audio.stopped',
  disconnected: 'audio.disconnected',
  failed: 'audio.failed',
} as const satisfies Record<Exclude<AudioStatus, ''>, MessageKey>;
const SENSITIVITY_KEYS = ['sensitivity.low', 'sensitivity.medium', 'sensitivity.high'] as const;

export function MonitorScreen() {
  const room = useRoom();

  return (
    <section className="monitor-panel">
      {room.isBaby ? <BabyMonitor room={room} /> : <ParentMonitor room={room} />}
    </section>
  );
}

function BabyMonitor({ room }: { room: ReturnType<typeof useRoom> }) {
  const t = useIntl();
  const soundDetected = room.active && room.level >= SENSITIVITY_THRESHOLDS[room.sensitivity - 1]!;

  return (
    <>
      <div className="monitor-hero">
        <PipMascot
          state={!room.active ? 'paused' : soundDetected ? 'sound' : 'quiet'}
          alt={t('monitor.mascotAlt')}
        />
        <span
          className={`status ${room.active && room.connected ? 'green' : ''}`}
          data-testid="monitor-status"
          data-state={!room.active ? 'ready' : room.connected ? 'monitoring' : 'local'}
        >
          <i />
          {room.active
            ? room.connected
              ? t('monitor.statusMonitoring')
              : t('monitor.statusLocal')
            : t('monitor.statusReady')}
        </span>
        <h2>{room.active ? t('monitor.titleMonitoring') : t('monitor.titleReady')}</h2>
        <p>{room.active ? t('monitor.subtitleMonitoring') : t('monitor.subtitleReady')}</p>
      </div>
      <div className="meter-wrap">
        <div>
          <span>{t('monitor.roomSound')}</span>
          <span>
            {soundDetected
              ? t('monitor.levelLittle')
              : room.active
                ? t('monitor.levelQuiet')
                : t('monitor.levelOff')}
          </span>
        </div>
        <AudioMeter value={room.active ? room.level : 0} />
      </div>
      <button
        type="button"
        className={`primary full ${room.active ? 'stop' : ''}`}
        data-testid="monitor-toggle"
        data-active={room.active}
        disabled={room.busy || (!room.active && !room.connected)}
        onClick={() => void room.toggleMonitoring()}
      >
        {room.active ? (
          <PauseIcon size={19} weight="fill" />
        ) : (
          <MicrophoneIcon size={19} weight="fill" />
        )}{' '}
        {room.busy ? t('monitor.opening') : room.active ? t('monitor.pause') : t('monitor.start')}
      </button>
      <div className="baby-checks">
        <span>
          <MicrophoneIcon size={16} />
          {room.active ? t('monitor.micOn') : t('monitor.micOff')}
        </span>
        <span>
          <BrightIcon size={16} />
          {room.awake ? t('monitor.awakeOn') : t('monitor.awakeOff')}
        </span>
        <span>
          <ParentIcon size={16} />
          {t('monitor.parentsOnline', { count: room.parents.length })}
        </span>
      </div>
      {(room.active || room.dimmed) && <DimControl room={room} />}
      {room.active && !room.awake && <p className="notice">{t('monitor.keepAwake')}</p>}
      <Sensitivity
        id="sensitivity"
        testId="baby-sensitivity"
        value={room.sensitivity}
        onChange={(value) => void room.changeSensitivity(room.session.deviceId, value)}
      />
    </>
  );
}

function DimControl({ room }: { room: ReturnType<typeof useRoom> }) {
  const t = useIntl();
  return (
    <button
      type="button"
      className="secondary small dim-control"
      data-testid="dim-toggle"
      data-on={room.dimmed}
      aria-pressed={room.dimmed}
      title={room.dimmed ? t('monitor.restoreTitle') : t('monitor.dimTitle')}
      onClick={room.toggleDim}
    >
      {room.dimmed ? <BrightIcon size={18} /> : <DimIcon size={18} />}
      {room.dimmed ? t('monitor.restoreBrightness') : t('monitor.dim')}
    </button>
  );
}

function ParentMonitor({ room }: { room: ReturnType<typeof useRoom> }) {
  const t = useIntl();
  if (room.babies.length === 0) {
    return (
      <div className="empty-nest" data-testid="empty-nest">
        <PipMascot className="empty-nest-mascot" state="quiet" alt={t('parent.emptyAlt')} />
        <h2>{t('parent.emptyTitle')}</h2>
        <p>
          <T k="parent.emptyBody" components={{ br: () => <br /> }} />
        </p>
        <button
          type="button"
          className="primary"
          data-testid="empty-nest-invite"
          onClick={room.openInvitation}
        >
          {t('parent.emptyInvite')} <ForwardIcon size={18} />
        </button>
        {room.dimmed && <DimControl room={room} />}
      </div>
    );
  }

  const listening = room.babies.some((device) => isListening(room.audioStatuses[device.id]));

  return (
    <div className="device-list">
      <NestSummary room={room} />
      {room.babies.map((device) => (
        <article
          className="device-card"
          key={device.id}
          data-testid="device-card"
          data-device-id={device.id}
          data-device-name={device.name}
        >
          <div className="device-heading">
            <div className="device-icon">
              <BabyIcon size={26} />
            </div>
            <div>
              <h3>{device.name}</h3>
              <span
                className={`status ${device.monitoring && room.connected ? 'green' : 'amber'}`}
                data-testid="device-status"
                data-state={
                  !room.connected
                    ? 'unknown'
                    : !device.online
                      ? 'offline'
                      : device.monitoring
                        ? 'monitoring'
                        : 'paused'
                }
              >
                <i />
                {!room.connected
                  ? t('parent.deviceUnknown')
                  : !device.online
                    ? t('parent.deviceOffline')
                    : device.monitoring
                      ? t('parent.deviceMonitoring')
                      : t('parent.devicePaused')}
              </span>
            </div>
          </div>
          <AudioMeter value={device.monitoring && room.connected ? device.level : 0} />
          <Sensitivity
            id={`sensitivity-${device.id}`}
            testId="device-sensitivity"
            label={t('parent.deviceSensitivity', { name: device.name })}
            value={device.sensitivity}
            disabled={!room.connected}
            onChange={(value) => void room.changeSensitivity(device.id, value)}
          />
          <div className="device-bottom">
            <span className="caption">
              {device.lastNoise
                ? t('parent.deviceLastSound', { time: relativeTime(device.lastNoise) })
                : t('parent.deviceNoSounds')}
            </span>
            <div className="device-actions">
              <MuteToggle room={room} device={device} />
              {isListening(room.audioStatuses[device.id]) ? (
                <button
                  type="button"
                  className="secondary small"
                  data-testid="listen-toggle"
                  data-listening="true"
                  onClick={() => room.stopListening(device.id)}
                >
                  <PauseIcon size={17} weight="fill" /> {t('parent.stopListening')}
                </button>
              ) : (
                <button
                  type="button"
                  className="primary small"
                  data-testid="listen-toggle"
                  data-listening="false"
                  disabled={!room.connected || !device.monitoring}
                  onClick={() => room.listenTo(device.id)}
                >
                  <ParentIcon size={18} /> {t('parent.listen')}
                </button>
              )}
            </div>
          </div>
          {room.audioStatuses[device.id] && (
            <div
              className="audio-status"
              role="status"
              data-testid="audio-status"
              data-status={room.audioStatuses[device.id]}
            >
              <SoundIcon size={17} />
              {audioStatusLabel(room.audioStatuses[device.id], t)}
              {room.audioStatuses[device.id] === 'paused' && (
                <button
                  type="button"
                  data-testid="resume-audio"
                  onClick={() => room.resumeAudio(device.id)}
                >
                  {t('parent.resumeAudio')}
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {(listening || room.dimmed) && <DimControl room={room} />}
    </div>
  );
}

function NestSummary({ room }: { room: ReturnType<typeof useRoom> }) {
  const t = useIntl();
  const watched = room.connected
    ? room.babies.filter((device) => device.online && device.monitoring)
    : [];
  const noisy = watched.filter(
    (device) => device.level >= SENSITIVITY_THRESHOLDS[device.sensitivity - 1]!,
  );
  const state = watched.length === 0 ? 'paused' : noisy.length > 0 ? 'sound' : 'quiet';
  const nest = watched.length === 1 ? watched[0]!.name : t('nest.theNest');

  return (
    <section className="nest-summary" data-testid="nest-summary" data-state={state}>
      <PipMascot state={state} alt={t('nest.alt')} />
      <h2>
        {state === 'sound'
          ? t('nest.titleSound')
          : state === 'quiet'
            ? t('nest.titleQuiet')
            : t('nest.titlePaused')}
      </h2>
      <p>
        {state === 'sound'
          ? t('nest.soundDetail', {
              name: noisy.length === 1 ? noisy[0]!.name : t('nest.fallbackBaby'),
            })
          : state === 'quiet'
            ? t('nest.quietDetail', { name: nest })
            : t('nest.pausedDetail')}
      </p>
    </section>
  );
}

function MuteToggle({ room, device }: { room: ReturnType<typeof useRoom>; device: PublicDevice }) {
  const t = useIntl();
  const muted = room.mutedBabies.includes(device.id);

  return (
    <button
      type="button"
      className="quiet small mute-toggle"
      data-testid="mute-toggle"
      data-muted={muted}
      aria-pressed={muted}
      disabled={!room.connected}
      onClick={() => void room.toggleMute(device.id)}
    >
      {muted ? <AlertMutedIcon size={17} /> : <AlertIcon size={17} />}
      {muted ? t('mute.muted') : t('mute.mute')}
    </button>
  );
}

function Sensitivity({
  disabled,
  id,
  label,
  testId,
  value,
  onChange,
}: {
  disabled?: boolean;
  id: string;
  label?: string;
  testId: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const t = useIntl();
  return (
    <div className="sensitivity">
      <label htmlFor={id}>
        {t('sensitivity.label')} <span>{t(SENSITIVITY_KEYS[value - 1]!)}</span>
      </label>
      <input
        id={id}
        data-testid={testId}
        aria-label={label}
        type="range"
        min="1"
        max="3"
        step="1"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {id === 'sensitivity' && <p className="caption">{t('sensitivity.hint')}</p>}
    </div>
  );
}

function isListening(status?: AudioStatus) {
  return Boolean(status && AUDIO_ACTIVE_STATUSES.includes(status));
}

function audioStatusLabel(status: AudioStatus, translate: ReturnType<typeof useIntl>) {
  return status ? translate(AUDIO_STATUS_KEYS[status]) : '';
}
