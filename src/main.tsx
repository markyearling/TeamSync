import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { testConnection } from './lib/supabase';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

// Initialize app with error handling
async function initializeApp() {
  try {
    const connected = await testConnection();
    
    if (!connected) {
      root.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f9fafb; color: #ef4444; padding: 20px; text-align: center;">
          <div>
            <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">Connection Error</h1>
            <p style="color: #6b7280;">Failed to connect to the database. Please check your configuration.</p>
          </div>
        </div>
      `;
      return;
    }

    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error('Error during initialization:', error);
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f9fafb; color: #ef4444; padding: 20px; text-align: center;">
        <div>
          <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">Initialization Error</h1>
          <p style="color: #6b7280;">Failed to initialize application. Please check your configuration.</p>
        </div>
      </div>
    `;
  }
}

initializeApp();