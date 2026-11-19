import { useEffect, useRef } from 'react';

let activeDialog: string | null = null;

export function isDialogBackPending(): boolean {
  return activeDialog !== null;
}

/** Give an open dialog a browser history entry so Back dismisses it first. */
export function useDialogBack(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = `dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activeDialog = id;
    window.history.pushState({ ...window.history.state, daymarkDialog: id }, '');
    const onPop = (event: PopStateEvent) => {
      if (activeDialog !== id || window.history.state?.daymarkDialog === id) return;
      (event as PopStateEvent & { daymarkDialogHandled?: boolean }).daymarkDialogHandled = true;
      activeDialog = null;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (activeDialog === id && window.history.state?.daymarkDialog === id) {
        // Keep the flag until popstate so app navigation ignores this history step.
        const finish = () => { if (activeDialog === id) activeDialog = null; };
        window.addEventListener('popstate', finish, { once: true });
        window.history.back();
      } else if (activeDialog === id) {
        activeDialog = null;
      }
    };
  }, [open]);
}
