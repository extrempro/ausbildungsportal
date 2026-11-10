import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { merkeBrowserFehler } from './fehler';
import './index.css';

// Farbschema des letzten Besuchs sofort setzen; das Konto bestätigt oder korrigiert es gleich danach
try {
  const theme = localStorage.getItem('theme');
  if (theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch {
  // kein Zugriff auf den Speicher – dann bleibt es bis zum Laden des Kontos hell
}

// Service Worker: zeigt ohne Verbindung eine verständliche Seite und macht das Portal als App installierbar.
// Er speichert keine Inhalte der Anwendung. Browser erlauben ihn nur über HTTPS (oder auf localhost).
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ohne Service Worker läuft das Portal normal weiter
    });
  });
}

merkeBrowserFehler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
