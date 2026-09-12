import { useId, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CheckIcon, ExpandIcon } from './icons';
import type { Session } from './protocol';
import { Modal } from './Modal';
import { useIntl } from './intl/setup';

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
  const t = useIntl();
  return (
    <Modal
      title={t('invite.openTitle')}
      testId="invitation-modal"
      close={() => !joining && onDismiss()}
    >
      <p>{t('invite.switchBody', { room: currentRoom })}</p>
      <button
        type="button"
        className="primary full"
        data-testid="invitation-confirm"
        data-busy={joining}
        disabled={joining}
        onClick={onConfirm}
      >
        {joining ? t('invite.switching') : t('invite.switchAndJoin')}
      </button>
      <button
        type="button"
        className="secondary full"
        data-testid="invitation-keep"
        disabled={joining}
        onClick={onDismiss}
      >
        {t('invite.keep')}
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
  const t = useIntl();
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
        <button
          type="button"
          className="room-switcher"
          data-testid="room-switcher"
          aria-label={t('rooms.switchLabel')}
        >
          <span>
            {rooms.find((room) => room.deviceId === activeDeviceId)?.roomName || t('rooms.saved')}
          </span>
          <ExpandIcon size={18} />
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
          <h2 id={titleId}>{t('rooms.title')}</h2>
          <p>{t('rooms.subtitle')}</p>
          <div className="saved-rooms">
            {rooms.map((room) => (
              <div className="saved-room" key={room.roomId}>
                <button
                  type="button"
                  className="secondary full"
                  data-testid="room-option"
                  data-room-id={room.roomId}
                  data-room-name={room.roomName}
                  data-device-id={room.deviceId}
                  data-device-name={room.name}
                  data-active={room.deviceId === activeDeviceId}
                  disabled={switching}
                  onClick={() => void activate(room)}
                >
                  <span>
                    {room.roomName}
                    <small>
                      {room.name} · {room.role === 'baby' ? t('role.baby') : t('role.parent')}
                    </small>
                  </span>
                  {room.deviceId === activeDeviceId && <CheckIcon size={18} weight="bold" />}
                </button>
                {room.deviceId !== activeDeviceId && (
                  <button
                    type="button"
                    className="quiet small"
                    data-testid="forget-room"
                    data-room-name={room.roomName}
                    disabled={switching}
                    aria-label={t('rooms.forgetLabel', { room: room.roomName })}
                    onClick={() => onForget(room)}
                  >
                    {t('rooms.forget')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="rooms-popover-actions">
            <button
              type="button"
              className="primary"
              data-testid="create-room-popover"
              disabled={switching}
              onClick={() => void add('/app/create')}
            >
              {t('welcome.createRoom')}
            </button>
            <button
              type="button"
              className="secondary"
              data-testid="join-room-popover"
              disabled={switching}
              onClick={() => void add('/app/join')}
            >
              {t('welcome.joinRoom')}
            </button>
          </div>
          {error && (
            <p role="alert" className="notice" data-testid="rooms-error">
              {error}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function PrivacyModal({ onClose }: { onClose: () => void }) {
  const t = useIntl();
  return (
    <Modal title={t('privacy.title')} testId="privacy-modal" close={onClose}>
      <PrivacyContent />
    </Modal>
  );
}

function PrivacyContent() {
  const t = useIntl();
  return (
    <>
      <p>{t('privacy.paragraph1')}</p>
      <p>{t('privacy.paragraph2')}</p>
      <div className="project-links">
        <a
          href="https://github.com/carlassmann/babyphone"
          target="_blank"
          rel="noreferrer"
          data-testid="source-code"
        >
          {t('privacy.source')}
        </a>
        <a href="https://carlassmann.com" target="_blank" rel="noreferrer">
          carlassmann.com
        </a>
      </div>
    </>
  );
}
