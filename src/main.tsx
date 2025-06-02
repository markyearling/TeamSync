import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

// Create root outside of async function to ensure immediate mounting
const reactRoot = createRoot(root);

// Initialize app with error boundary
reactRoot.render(
  <StrictMode>
    <App />
  </StrictMode>
);