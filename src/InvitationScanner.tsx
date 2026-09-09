import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

export function InvitationScanner({
  onScan,
  close,
}: {
  onScan: (code: string) => void;
  close: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    const stop = () => {
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) return stop();
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (cancelled) return stop();
        controls = await new BrowserQRCodeReader().decodeFromStream(
          stream,
          video.current!,
          (result) => {
            if (!result || cancelled) return;
            let code = result.getText().trim();
            try {
              const url = new URL(code);
              code = new URLSearchParams(url.hash.slice(1)).get('join') || '';
            } catch {}
            if (!/^(?:[a-f0-9]{64}\.)?[A-Za-z0-9_-]{20,128}$/.test(code)) {
              setError('This is not a Pip invitation code. Try another QR code.');
              return;
            }
            cancelled = true;
            stop();
            onScan(code);
          },
        );
        if (cancelled) stop();
      } catch {
        stop();
        if (!cancelled)
          setError('Camera unavailable. Allow camera access, or close this and paste the code.');
      }
    }
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [onScan]);
  return (
    <Modal title="Scan invitation" close={close}>
      <video ref={video} autoPlay muted playsInline className="invitation-camera" />
      <p role="status">{error || 'Point your camera at the invitation QR code.'}</p>
    </Modal>
  );
}
