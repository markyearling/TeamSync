import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { testConnection } from './lib/supabase';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

// Test Supabase connection before mounting app
testConnection().then(connected => {
  if (!connected) {
    console.error('Failed to connect to Supabase');
  }
  
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}).catch(error => {
  console.error('Error during initialization:', error);
  root.innerHTML = '<div style="color: red; padding: 20px;">Failed to initialize application. Please check your configuration.</div>';
});