import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { SocketProvider } from './context/SocketContext';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
// StrictMode removed: it intentionally fires every useEffect twice in dev,
// which was doubling all /users/me calls and flooding the server logs.
root.render(
  <SocketProvider>
    <App />
  </SocketProvider>
);

reportWebVitals();
