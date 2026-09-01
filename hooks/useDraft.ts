import { useState, useCallback } from 'react';

export function useDraft<T>(windowId: string, initialState: T) {
  const draftKey = `draft-${windowId}`;

  // Lazy initial state: read localStorage once at mount rather than in an effect,
  // so draft values are available before the first render (no race with initialData).
  const [state, setState] = useState<T>(() => {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft) as T;
      } catch {
        // corrupted draft — fall back to initialState
      }
    }
    return initialState;
  });

  // Save draft on change
  const setDraftState = useCallback((newState: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof newState === 'function' ? (newState as any)(prev) : newState;

      try {
        // Create a shallow copy to remove large fields (like base64 images) before saving to localStorage
        const draftToSave = { ...next } as any;
        if (draftToSave.images) delete draftToSave.images;
        if (draftToSave.photos) delete draftToSave.photos;
        if (draftToSave.logo) delete draftToSave.logo;

        localStorage.setItem(draftKey, JSON.stringify(draftToSave));
      } catch (e) {
        // If we still hit quota limits or other errors, warn but don't crash the app
        console.warn("Failed to save draft to localStorage:", e);
      }

      return next;
    });
  }, [draftKey]);

  // Clear draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
  }, [draftKey]);

  return [state, setDraftState, clearDraft] as const;
}