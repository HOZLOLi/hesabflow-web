// Global type declarations for Tauri

interface Window {
  __TAURI__?: any;
  __TAURI_INTERNALS__?: any;
}

interface ImportMetaEnv {
  DEV: boolean;
  PROD: boolean;
  MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Vite asset imports: ?url returns the resolved URL of any file
// (used by SqliteFileReader to load sql.js WASM in the browser).
declare module '*?url' {
  const src: string;
  export default src;
}
