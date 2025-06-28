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
  
  // Don't manually clear tokens - let Supabase handle this
  // This is important for PKCE flows like password reset
});

// Check URL for password reset parameters
const url = new URL(window.location.href);
const type = url.searchParams.get('type');
const accessToken = url.searchParams.get('access_token');
const refreshToken = url.searchParams.get('refresh_token');

// Log if this is a password recovery flow
if (type === 'recovery' || (accessToken && refreshToken)) {
  console.log('[main.tsx] Password reset parameters detected in URL');
}

reactRoot.render(
  <StrictMode>
    <App />
  </StrictMode>
);