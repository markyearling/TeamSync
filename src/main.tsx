import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Verify environment variables are loaded
if (
  !import.meta.env.VITE_SUPABASE_URL ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY
) {
  console.error('Required environment variables are missing');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);