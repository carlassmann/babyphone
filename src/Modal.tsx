import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
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
          onClick={close}
          aria-label="Close dialog"
        >
          <CloseIcon size={19} />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
