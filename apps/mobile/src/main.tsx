import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';

/**
 * Follow the iOS text size. Sizes in this app are in rem, designed at a 16px
 * root; -apple-system-body is 17px at the default text size, so the root
 * scales by its ratio. Browsers without the font keyword keep 16px.
 */
function followSystemTextSize() {
  const probe = document.createElement('span');
  probe.style.font = '-apple-system-body';
  if (!probe.style.font) return;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const body = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  if (body > 0) document.documentElement.style.fontSize = `${(16 * body) / 17}px`;
}
followSystemTextSize();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') followSystemTextSize();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
