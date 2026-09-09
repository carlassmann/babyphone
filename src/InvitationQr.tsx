import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function InvitationQr({ code }: { code: string }) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(code, { width: 512, margin: 4, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setImage(url);
      })
      .catch(() => {
        if (!cancelled) setError('QR code unavailable. Copy the invitation code below.');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="invitation-qr">
      {image && <img src={image} width="224" height="224" alt="Invitation code QR" />}
      <p>Scan to copy the code, then paste it into Pip’s Join a room screen.</p>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
