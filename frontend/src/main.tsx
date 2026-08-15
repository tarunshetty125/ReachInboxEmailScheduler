import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { App } from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><AuthProvider><BrowserRouter><App /><Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px' } }} /></BrowserRouter></AuthProvider></ThemeProvider></StrictMode>);
