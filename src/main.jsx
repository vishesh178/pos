import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/layout/ErrorBoundary';
import './index.css';

// Automatically route relative API calls to the local ERP server when loaded via file:// protocol
if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
  const originalFetch = window.fetch;
  window.fetch = (url, options) => {
    if (typeof url === 'string' && (url.startsWith('/api') || url.startsWith('/uploads'))) {
      url = `http://127.0.0.1:5001${url}`;
    }
    return originalFetch(url, options);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

