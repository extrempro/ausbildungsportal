import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// Farbschema des letzten Besuchs sofort setzen; das Konto bestätigt oder korrigiert es gleich danach
try {
  const theme = localStorage.getItem('theme');
  if (theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch {
  // kein Zugriff auf den Speicher – dann bleibt es bis zum Laden des Kontos hell
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
