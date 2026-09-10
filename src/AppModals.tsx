import { Check, Download } from 'lucide-react';
import type { Session } from './protocol';
import type { usePwa } from './pwa';
import { Modal } from './Modal';

export function InvitationModal({
  currentRoom,
  error,
  joining,
  onConfirm,
  onDismiss,
}: {
  currentRoom: string;
  error: string;
  joining: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal title="Open this invitation?" close={() => !joining && onDismiss()}>
      <p>
        Switch from {currentRoom}? Monitoring and notifications follow the active room. You can
        return to your saved rooms anytime.
      </p>
      <button type="button" className="primary full" disabled={joining} onClick={onConfirm}>
        {joining ? 'Switching room…' : 'Switch room and join'}
      </button>
      <button type="button" className="secondary full" disabled={joining} onClick={onDismiss}>
        Keep current room
      </button>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
    </Modal>
  );
}

export function RoomsModal({
  activeDeviceId,
  error,
  rooms,
  switching,
  onActivate,
  onAdd,
  onClose,
  onForget,
}: {
  activeDeviceId?: string;
  error: string;
  rooms: Session[];
  switching: boolean;
  onActivate: (room: Session) => void;
  onAdd: (path: '/app/create' | '/app/join') => void;
  onClose: () => void;
  onForget: (room: Session) => void;
}) {
  return (
    <Modal title="Your rooms" close={() => !switching && onClose()}>
      <p>
        Only the active room monitors or sends notifications to this device. Switching stops live
        audio.
      </p>
      <div className="saved-rooms">
        {rooms.map((room) => (
          <div className="saved-room" key={room.roomId}>
            <button
              type="button"
              className="secondary full"
              disabled={switching}
              onClick={() => onActivate(room)}
            >
              <span>
                {room.roomName}
                <small>
                  {room.name} · {room.role === 'baby' ? 'Baby' : 'Parent'}
                </small>
              </span>
              {room.deviceId === activeDeviceId && <Check size={18} />}
            </button>
            {room.deviceId !== activeDeviceId && (
              <button
                type="button"
                className="quiet small"
                disabled={switching}
                aria-label={`Forget ${room.roomName}`}
                onClick={() => onForget(room)}
              >
                Forget
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="primary full"
        disabled={switching}
        onClick={() => onAdd('/app/create')}
      >
        Create a room
      </button>
      <button
        type="button"
        className="secondary full"
        disabled={switching}
        onClick={() => onAdd('/app/join')}
      >
        Join a room
      </button>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
    </Modal>
  );
}

export function AppInfoModal({
  kind,
  pwa,
  onClose,
}: {
  kind: 'install' | 'privacy';
  pwa: ReturnType<typeof usePwa>;
  onClose: () => void;
}) {
  return (
    <Modal title={kind === 'install' ? 'Install Pip' : 'Privacy'} close={onClose}>
      {kind === 'install' ? <InstallContent pwa={pwa} /> : <PrivacyContent />}
    </Modal>
  );
}

function InstallContent({ pwa }: { pwa: ReturnType<typeof usePwa> }) {
  return (
    <>
      <div className="install-icon">
        <img src="/icon.svg" alt="Pip" />
      </div>
      <p>Keep Pip a tap away. Install it on both devices for the best experience.</p>
      {pwa.installed ? (
        <p className="notice success">
          <Check />
          Pip is installed on this device.
        </p>
      ) : pwa.canInstall ? (
        <button type="button" className="primary full" onClick={() => void pwa.install()}>
          Install Pip <Download size={18} />
        </button>
      ) : (
        <div className="instructions">
          <p>
            <strong>iPhone / iPad</strong>
            <br />
            In Safari, tap Share → Add to Home Screen. Open Pip from its new icon before enabling
            notifications.
          </p>
          <p>
            <strong>Android / desktop</strong>
            <br />
            Use your browser menu → Install app or Add to Home Screen. In Safari on Mac, choose File
            → Add to Dock.
          </p>
        </div>
      )}
      <p className="caption">
        The baby device must stay plugged in, with Pip open and its screen awake.
      </p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <p>
        Sound is analyzed on the baby device. Pip never records it. Live listening uses an encrypted
        audio connection between your devices, with a relay only when needed.
      </p>
      <p>Your invitation code is the key to your room. Share it only with people you trust.</p>
      <p className="notice">
        This is a prototype and an extra pair of ears. Keep checking on your baby; browsers,
        networks, and notifications can stop working.
      </p>
    </>
  );
}
