import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Detect if running in Tauri
    const isTauri = process.env.TAURI_PLATFORM !== undefined;
    
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        strictPort: true,
      },
      // Tauri serves the frontend from a custom protocol; always use a
      // relative base so assets resolve correctly inside WebView2. (Tauri's
      // CI env doesn't always set TAURI_PLATFORM during `tauri build`, so
      // we no longer gate on it.)
      base: './',
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Tauri uses Chromium-based webview which supports all modern features
        target: 'esnext',
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
        // Optimize chunk size for faster loading
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
          output: {
            // NOTE: do NOT manually split react/react-dom into their own chunk.
            // Under React 19 that produced an empty `react-vendor` chunk and a
            // chunk init-order hazard that can blank the WebView. Let Rollup keep
            // React in the entry chunk; only split the heavy, lazy-ish libs.
            manualChunks: {
              'icons': ['lucide-react'],
              'charts': ['recharts'],
            }
          }
        }
      },
    };
});
