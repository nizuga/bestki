import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// Apply saved theme before first paint to avoid flash
(function applyTheme() {
  const saved = localStorage.getItem('theme') ?? 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = saved === 'dark' || (saved === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', useDark);
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
