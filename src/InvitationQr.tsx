import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useIntl } from './intl/setup';

export function InvitationQr({ code }: { code: string }) {
  const t = useIntl();
  const [image, setImage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(code, { width: 512, margin: 4, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setImage(url);
      })
      .catch(() => {
        if (!cancelled) setError(t('qr.unavailable'));
      });
    return () => {
      cancelled = true;
    };
  }, [code, t]);

  return (
    <div className="invitation-qr">
      {image && <img src={image} width="224" height="224" alt={t('qr.alt')} />}
      <p>{t('qr.hint')}</p>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
