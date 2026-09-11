import { useState } from 'react';
import {
  CheckIcon,
  CopyIcon,
  DeviceIcon,
  DisclosureIcon,
  ForwardIcon,
  InviteLinkIcon,
} from '../../../icons';
import { request } from '../../../connection';
import { InvitationQr } from '../../../InvitationQr';
import { Modal } from '../../../Modal';
import type { PublicDevice, Session } from '../../../protocol';
import { RenameField } from './room-components';

export function InvitationModal({
  accessNotice,
  busy,
  connected,
  copied,
  invitation,
  isBaby,
  onClose,
  onCopy,
  onReset,
}: {
  accessNotice: string;
  busy: boolean;
  connected: boolean;
  copied: string;
  invitation: string;
  isBaby: boolean;
  onClose: () => void;
  onCopy: (value: string, label: string) => void;
  onReset: () => void;
}) {
  return (
    <Modal title="Invite a device" close={onClose}>
      <p>
        Choose Me on the joining device to listen, or Baby for the device that stays in the nursery.
      </p>
      <InvitationQr key={invitation} code={invitation} />
      <label>
        Private invitation code
        <input
          className="invitation-code"
          readOnly
          value={invitation}
          onFocus={(event) => event.target.select()}
        />
      </label>
      <div className="invite-actions">
        <button
          type="button"
          className="primary full"
          onClick={() => onCopy(`${location.origin}/app/join#join=${invitation}`, 'link')}
        >
          {copied === 'link' ? <CheckIcon size={18} weight="bold" /> : <InviteLinkIcon size={18} />}{' '}
          {copied === 'link' ? 'Link copied' : 'Copy invite link'}
        </button>
        <button type="button" className="secondary full" onClick={() => onCopy(invitation, 'code')}>
          <CopyIcon size={17} />
          {copied === 'code' ? 'Code copied' : 'Copy code'}
        </button>
      </div>
      <p className="caption">Anyone with this invitation can join. Share it privately.</p>
      {!isBaby && (
        <button
          type="button"
          className="secondary full"
          disabled={busy || !connected}
          onClick={onReset}
        >
          Reset invitation link
        </button>
      )}
      {accessNotice && (
        <p role="status" className="caption">
          {accessNotice}
        </p>
      )}
    </Modal>
  );
}

export function DeviceSettingsModal({
  busy,
  session,
  onChangeRole,
  onClose,
  onLeave,
}: {
  busy: boolean;
  session: Session;
  onChangeRole: () => void;
  onClose: () => void;
  onLeave: () => void;
}) {
  const isBaby = session.role === 'baby';

  return (
    <Modal title="Device settings" close={onClose}>
      <div className="setting-detail">
        <DeviceIcon size={24} />
        <div>
          <strong>{session.name}</strong>
          <p>{isBaby ? 'Baby device' : 'Parent device'}</p>
        </div>
      </div>
      <RenameField
        label="Device name"
        value={session.name}
        onSave={(name) => request('rename-device', { ...session, name })}
      />
      <button type="button" className="secondary full" disabled={busy} onClick={onChangeRole}>
        Switch to {isBaby ? 'parent' : 'baby'} device
        <DisclosureIcon size={17} />
      </button>
      <p className="caption">Switching roles pauses monitoring and stops live audio.</p>
      <hr />
      <button type="button" className="quiet danger" disabled={busy} onClick={onLeave}>
        Leave this room <ForwardIcon size={16} />
      </button>
      <p className="caption">You’ll need the invitation code to join again.</p>
    </Modal>
  );
}

export function RemoveDeviceConfirmation({
  device,
  busy,
  onCancel,
  onConfirm,
}: {
  device: PublicDevice;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={`Remove ${device.name}?`} close={onCancel}>
      <p>
        {device.name} loses access to this room right away. The invitation link is reset, so it can
        only rejoin with a new invitation.
      </p>
      <button type="button" className="primary full danger" disabled={busy} onClick={onConfirm}>
        Remove {device.name}
      </button>
      <button type="button" className="secondary full" onClick={onCancel}>
        Keep this device
      </button>
    </Modal>
  );
}
