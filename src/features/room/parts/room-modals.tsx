import { ArrowRight, Check, ChevronRight, Copy, Link, Smartphone } from 'lucide-react';
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
          className="primary full"
          onClick={() => onCopy(`${location.origin}/app/join#join=${invitation}`, 'link')}
        >
          {copied === 'link' ? <Check size={17} /> : <Link size={17} />}{' '}
          {copied === 'link' ? 'Link copied' : 'Copy invite link'}
        </button>
        <button className="secondary full" onClick={() => onCopy(invitation, 'code')}>
          <Copy size={16} />
          {copied === 'code' ? 'Code copied' : 'Copy code'}
        </button>
      </div>
      <p className="caption">Anyone with this invitation can join. Share it privately.</p>
      {!isBaby && (
        <button className="secondary full" disabled={busy || !connected} onClick={onReset}>
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
  accessNotice,
  busy,
  connected,
  devices,
  session,
  onChangeRole,
  onClose,
  onLeave,
  onRemoveDevice,
}: {
  accessNotice: string;
  busy: boolean;
  connected: boolean;
  devices: PublicDevice[];
  session: Session;
  onChangeRole: () => void;
  onClose: () => void;
  onLeave: () => void;
  onRemoveDevice: (deviceId: string) => void;
}) {
  const isBaby = session.role === 'baby';
  const otherDevices = devices.filter((device) => device.id !== session.deviceId);

  return (
    <Modal title="Device settings" close={onClose}>
      <div className="setting-detail">
        <Smartphone />
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
      <button className="secondary full" disabled={busy} onClick={onChangeRole}>
        Switch to {isBaby ? 'parent' : 'baby'} device
        <ChevronRight size={17} />
      </button>
      <p className="caption">Switching roles pauses monitoring and stops live audio.</p>
      {!isBaby && (
        <>
          <hr />
          <h3>Room access</h3>
          <p className="caption">
            Any parent can remove devices. Removal also resets the invitation link. Existing devices
            stay connected.
          </p>
          {otherDevices.map((device) => (
            <div className="setting-detail" key={device.id}>
              <div>
                <RenameField
                  label={`Name for ${device.name}`}
                  value={device.name}
                  onSave={(name) =>
                    request('rename-device', { ...session, name, target: device.id })
                  }
                />
                <p>
                  {device.role === 'baby' ? 'Baby' : 'Parent'} ·{' '}
                  {device.online ? 'Online' : 'Offline'}
                </p>
              </div>
              <button
                className="quiet danger"
                disabled={busy || !connected}
                onClick={() => onRemoveDevice(device.id)}
                aria-label={`Remove ${device.name}`}
              >
                Remove
              </button>
            </div>
          ))}
          {accessNotice && (
            <p role="status" className="caption">
              {accessNotice}
            </p>
          )}
        </>
      )}
      <hr />
      <button className="quiet danger" disabled={busy} onClick={onLeave}>
        Leave this room <ArrowRight size={16} />
      </button>
      <p className="caption">You’ll need the invitation code to join again.</p>
    </Modal>
  );
}
