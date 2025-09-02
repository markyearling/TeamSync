import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { supabase } from './lib/supabase';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

const reactRoot = createRoot(root);

// Initialize Supabase auth state
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[main.tsx] Auth state changed:', event, session ? 'Session exists' : 'No session');
});

reactRoot.render(
  <StrictMode>
    <App />
  </StrictMode>
);