// Minimal stand-in for @tauri-apps/plugin-sql (tests never take the Tauri path).
export default {
  load: async () => {
    throw new Error('Tauri SQL is not available in tests');
  },
};
