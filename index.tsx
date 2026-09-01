import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDataStore } from './store/dataStore';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Dev-only: expose the Zustand store on window for browser-console debugging/seeding.
if (import.meta.env.DEV) {
  (window as any).__store = useDataStore;
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// NOTE: the initial HTML loader (#initial-loader) is hidden by App.tsx once it
// has actually rendered (or by ErrorBoundary if a render error is caught). We
// deliberately do NOT hide it on a blind timeout here — doing so would reveal a
// blank white page if React failed to mount.