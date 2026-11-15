import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import GuidedDemo from './components/GuidedDemo.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <GuidedDemo />
  </StrictMode>,
)
