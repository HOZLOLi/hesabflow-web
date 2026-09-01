// store/windowDraftStore.ts
type Draft = Record<string, any>;

interface State {
  minimized: string[];          // لیست id پنجره‌های minimze شده
  drafts: Record<string, Draft>;// id → داده فرم موقت
}

const state: State = {
  minimized: [],
  drafts: {},
};

/* ----- توابع کمکی ----- */
export function minimizeWindow(id: string): void {
  if (!state.minimized.includes(id)) state.minimized.push(id);
}
export function restoreWindow(id: string): void {
  state.minimized = state.minimized.filter(i => i !== id);
}
export function setDraft(id: string, data: Draft): void {
  state.drafts[id] = { ...state.drafts[id] ?? {}, ...data };
}
export function getDraft(id: string): Draft {
  return state.drafts[id] ?? {};
}
export function clearDraft(id: string): void {
  delete state.drafts[id];
}

/* ----- شیء واحد برای import آسان ----- */
export const windowDraftStore = {
  minimizeWindow,
  restoreWindow,
  setDraft,
  getDraft,
  clearDraft,
  getState: () => ({
    minimized: [...state.minimized],
    drafts: { ...state.drafts }
  })
};