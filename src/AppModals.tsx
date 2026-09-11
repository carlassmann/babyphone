import { useId, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import type { Session } from './protocol';
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

export function RoomsPopover({
  activeDeviceId,
  align,
  error,
  rooms,
  switching,
  onActivate,
  onAdd,
  onForget,
  onOpen,
}: {
  activeDeviceId?: string;
  align: 'start' | 'end';
  error: string;
  rooms: Session[];
  switching: boolean;
  onActivate: (room: Session) => Promise<void>;
  onAdd: (path: '/app/create' | '/app/join') => Promise<void>;
  onForget: (room: Session) => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  async function activate(room: Session) {
    try {
      await onActivate(room);
      setOpen(false);
    } catch {}
  }

  async function add(path: '/app/create' | '/app/join') {
    try {
      await onAdd(path);
      setOpen(false);
    } catch {}
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (switching) return;
        if (nextOpen) onOpen();
        setOpen(nextOpen);
      }}
    >
      <Popover.Trigger asChild>
        <button type="button" className="room-switcher" aria-label="Switch room">
          <span>
            {rooms.find((room) => room.deviceId === activeDeviceId)?.roomName || 'Saved rooms'}
          </span>
          <ChevronDown size={18} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="rooms-popover"
          align={align}
          sideOffset={8}
          collisionPadding={16}
          aria-labelledby={titleId}
        >
          <h2 id={titleId}>Your rooms</h2>
          <p>Switching rooms stops live audio.</p>
          <div className="saved-rooms">
            {rooms.map((room) => (
              <div className="saved-room" key={room.roomId}>
                <button
                  type="button"
                  className="secondary full"
                  disabled={switching}
                  onClick={() => void activate(room)}
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
          <div className="rooms-popover-actions">
            <button
              type="button"
              className="primary"
              disabled={switching}
              onClick={() => void add('/app/create')}
            >
              Create a room
            </button>
            <button
              type="button"
              className="secondary"
              disabled={switching}
              onClick={() => void add('/app/join')}
            >
              Join a room
            </button>
          </div>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Privacy" close={onClose}>
      <PrivacyContent />
    </Modal>
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
      <div className="project-links">
        <a href="https://github.com/carlassmann/babyphone" target="_blank" rel="noreferrer">
          Source code
        </a>
        <a href="https://carlassmann.com" target="_blank" rel="noreferrer">
          carlassmann.com
        </a>
      </div>
    </>
  );
}
