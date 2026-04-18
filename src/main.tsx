import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import './i18n';
import './styles/theme.css';
import './styles/layout.css';
import './styles/components.css';

// Expose the Tauri window label synchronously so App() can pick its root
// component (main app vs mini player) on first render without flicker.
try {
  (window as any).__PSY_WINDOW_LABEL__ = getCurrentWindow().label;
} catch {
  (window as any).__PSY_WINDOW_LABEL__ = 'main';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
