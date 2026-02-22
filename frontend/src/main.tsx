import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#fff',
          color: '#111',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          fontFamily: 'Inter, sans-serif',
        },
        success: { iconTheme: { primary: '#f97415', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}
    />
  </StrictMode>,
)
