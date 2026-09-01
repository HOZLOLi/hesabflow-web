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
