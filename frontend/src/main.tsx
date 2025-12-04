//import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SpeechProvider } from './contexts/SpeechContext'

createRoot(document.getElementById('root')!).render(
  //<StrictMode>
    <SpeechProvider>
      <App />
    </SpeechProvider>
  //</StrictMode>,
)
