import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startDomTranslationObserver } from './utils/i18n'
import { applyDisplayMode } from './utils/displayMode'

// Apply persisted Mobile / Web appearance before first paint (default: mobile)
applyDisplayMode();
startDomTranslationObserver();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
