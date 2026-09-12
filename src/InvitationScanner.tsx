import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { useIntl } from './intl/setup';

export function InvitationScanner({
  onScan,
  close,
}: {
  onScan: (code: string) => void;
  close: () => void;
}) {
  const t = useIntl();
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
              setError(t('scanner.invalid'));
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
        if (!cancelled) setError(t('scanner.cameraUnavailable'));
      }
    }
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [onScan]);
  return (
    <Modal title={t('scanner.title')} testId="scanner-dialog" close={close}>
      <video ref={video} autoPlay muted playsInline className="invitation-camera" />
      <p role="status" data-testid="scanner-status" data-state={error ? 'error' : 'scanning'}>
        {error || t('scanner.prompt')}
      </p>
    </Modal>
  );
}
