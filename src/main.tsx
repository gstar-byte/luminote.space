import {StrictMode} from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { HelmetProvider } from 'react-helmet-async';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Cleanup legacy cache from manually written sw.js to resolve conflicts and deadlocks
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key === 'lumi-note-v1') {
        caches.delete(key).then(() => {
          console.log('[PWA] Successfully cleared legacy cache:', key);
        });
      }
    });
  });
}

// Register the service worker after the page is fully loaded to prevent bandwidth/CPU competition
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    registerSW({
      onNeedRefresh() {
        console.log('[PWA] New content available, please refresh.');
      },
      onOfflineReady() {
        console.log('[PWA] App is ready to work offline.');
      },
    });
  });
}
