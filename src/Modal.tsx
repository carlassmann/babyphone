import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import { useIntl } from './intl/setup';
export function Modal({
  title,
  close,
  children,
  testId = 'dialog',
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  testId?: string;
}) {
  const t = useIntl();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-content">
        <button
          type="button"
          className="icon-button modal-close"
          data-testid="close-dialog"
          onClick={close}
          aria-label={t('common.closeDialog')}
        >
          <CloseIcon size={19} />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
