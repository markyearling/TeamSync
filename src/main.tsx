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
  
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    // Delete any existing auth data
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('sb-refresh-token');
    localStorage.removeItem('sb-access-token');
  }
  
  // Log if this is a password recovery flow
  if (event === 'PASSWORD_RECOVERY') {
    console.log('[main.tsx] Password recovery flow detected');
    // Clear any existing session data
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('sb-refresh-token');
    localStorage.removeItem('sb-access-token');
  }
});

// Check URL for password reset parameters
const url = new URL(window.location.href);
const type = url.searchParams.get('type');
const accessToken = url.searchParams.get('access_token');
const refreshToken = url.searchParams.get('refresh_token');

// If this is a password reset link, clear any existing session immediately
if (type === 'recovery' || (accessToken && refreshToken)) {
  console.log('[main.tsx] Password reset parameters detected in URL, clearing session');
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('sb-refresh-token');
  localStorage.removeItem('sb-access-token');
}

reactRoot.render(
  <StrictMode>
    <App />
  </StrictMode>
);