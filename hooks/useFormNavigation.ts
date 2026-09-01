import { useEffect } from 'react';

interface UseFormNavigationOptions {
  onSubmit?: () => void;
  onClose?: () => void;
  enabled?: boolean;
}

/**
 * Hook for keyboard navigation in forms
 * - Arrow Down / Enter: Move to next input field
 * - Arrow Up: Move to previous input field
 * - Escape: Close form
 * - Ctrl+S / Cmd+S: Submit form
 */
export const useFormNavigation = (options: UseFormNavigationOptions = {}) => {
  const { onSubmit, onClose, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      
      // Only handle navigation for input elements (not textarea)
      const isNavigableInput = target instanceof HTMLInputElement || target instanceof HTMLSelectElement;
      
      // ESC to close
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      // Arrow Down or Enter to move to next input
      if ((e.key === 'ArrowDown' || (e.key === 'Enter' && isNavigableInput)) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const form = (target as HTMLElement).closest('form') || document;
        const inputs = Array.from(
          form.querySelectorAll('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea:not([disabled]), select:not([disabled])')
        ) as HTMLElement[];
        const currentIndex = inputs.indexOf(target as HTMLElement);

        if (currentIndex > -1 && currentIndex < inputs.length - 1) {
          inputs[currentIndex + 1].focus();
        }
        return;
      }

      // Arrow Up to move to previous input
      if (e.key === 'ArrowUp' && isNavigableInput) {
        e.preventDefault();
        const form = (target as HTMLElement).closest('form') || document;
        const inputs = Array.from(
          form.querySelectorAll('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea:not([disabled]), select:not([disabled])')
        ) as HTMLElement[];
        const currentIndex = inputs.indexOf(target as HTMLElement);

        if (currentIndex > 0) {
          inputs[currentIndex - 1].focus();
        }
        return;
      }

      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && onSubmit) {
        e.preventDefault();
        onSubmit();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSubmit, onClose, enabled]);
};
