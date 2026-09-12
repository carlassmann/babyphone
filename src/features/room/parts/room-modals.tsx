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
import { useIntl } from '../../../intl/setup';
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
  const t = useIntl();
  return (
    <Modal title={t('roomInvite.title')} testId="invite-dialog" close={onClose}>
      <p>{t('roomInvite.body')}</p>
      <InvitationQr key={invitation} code={invitation} />
      <label>
        {t('roomInvite.codeLabel')}
        <input
          className="invitation-code"
          data-testid="invite-code"
          readOnly
          value={invitation}
          onFocus={(event) => event.target.select()}
        />
      </label>
      <div className="invite-actions">
        <button
          type="button"
          className="primary full"
          data-testid="copy-invite-link"
          onClick={() => onCopy(`${location.origin}/app/join#join=${invitation}`, 'link')}
        >
          {copied === 'link' ? <CheckIcon size={18} weight="bold" /> : <InviteLinkIcon size={18} />}{' '}
          {copied === 'link' ? t('roomInvite.linkCopied') : t('roomInvite.copyLink')}
        </button>
        <button
          type="button"
          className="secondary full"
          data-testid="copy-invite-code"
          onClick={() => onCopy(invitation, 'code')}
        >
          <CopyIcon size={17} />
          {copied === 'code' ? t('roomInvite.codeCopied') : t('roomInvite.copyCode')}
        </button>
      </div>
      <p className="caption">{t('roomInvite.shareHint')}</p>
      {!isBaby && (
        <button
          type="button"
          className="secondary full"
          data-testid="reset-invitation"
          disabled={busy || !connected}
          onClick={onReset}
        >
          {t('roomInvite.reset')}
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
  const t = useIntl();
  const isBaby = session.role === 'baby';

  return (
    <Modal title={t('deviceSettings.title')} testId="device-settings-dialog" close={onClose}>
      <div className="setting-detail">
        <DeviceIcon size={24} />
        <div>
          <strong>{session.name}</strong>
          <p>{isBaby ? t('settings.deviceTypeBaby') : t('settings.deviceTypeParent')}</p>
        </div>
      </div>
      <RenameField
        label={t('deviceSettings.name')}
        testId="rename-own-device"
        value={session.name}
        onSave={(name) => request('rename-device', { ...session, name })}
      />
      <button
        type="button"
        className="secondary full"
        data-testid="switch-role"
        disabled={busy}
        onClick={onChangeRole}
      >
        {isBaby ? t('deviceSettings.switchToParent') : t('deviceSettings.switchToBaby')}
        <DisclosureIcon size={17} />
      </button>
      <p className="caption">{t('deviceSettings.switchHint')}</p>
      <hr />
      <button
        type="button"
        className="quiet danger"
        data-testid="leave-room"
        disabled={busy}
        onClick={onLeave}
      >
        {t('deviceSettings.leave')} <ForwardIcon size={16} />
      </button>
      <p className="caption">{t('deviceSettings.leaveHint')}</p>
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
  const t = useIntl();
  return (
    <Modal
      title={t('removeDevice.title', { name: device.name })}
      testId="remove-device-dialog"
      close={onCancel}
    >
      <p>{t('removeDevice.body', { name: device.name })}</p>
      <button
        type="button"
        className="primary full danger"
        data-testid="confirm-remove-device"
        disabled={busy}
        onClick={onConfirm}
      >
        {t('removeDevice.confirm', { name: device.name })}
      </button>
      <button type="button" className="secondary full" data-testid="keep-device" onClick={onCancel}>
        {t('removeDevice.keep')}
      </button>
    </Modal>
  );
}
