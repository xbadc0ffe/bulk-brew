import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';
import { isNative, startNative } from './native.ts';
import { BUNDLED_PACK, nativePackSource, type PackSource } from './packUpdates.ts';

startNative();

function render(packSource: PackSource) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App packSource={packSource} />
    </StrictMode>,
  );
}

// The iOS app first picks between its bundled pack and a downloaded one, from local
// files only; the web app renders at once with the pack it was deployed with.
if (isNative) void nativePackSource().then(render);
else render(BUNDLED_PACK);

// Offline support ships only in production builds; the dev server has no cache to manage.
// The iOS app bundles everything, so it needs none.
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js?v=${__BUILD_ID__}`)
      .catch((err: unknown) => console.error('service worker registration failed', err));
  });
}
