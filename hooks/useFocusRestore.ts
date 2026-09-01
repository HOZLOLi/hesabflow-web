import { useRef, useEffect } from 'react';

/**
 * Saves the focused element on mount and restores it on unmount.
 * Drop this into any modal component to prevent focus falling to <body>.
 */
export function useFocusRestore() {
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    return () => {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, []);
}
