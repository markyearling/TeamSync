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
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    // Delete any existing auth data
    window.localStorage.removeItem('supabase.auth.token');
  }
});

reactRoot.render(
  <StrictMode>
    <App />
  </StrictMode>
);