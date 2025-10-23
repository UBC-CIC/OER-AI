import { BrowserRouter, Routes, Route } from 'react-router'
import AIChatPage from './pages/ChatInterface/ChatInterface'
import HomePage from './pages/HomePage'
import { ModeProvider } from '@/components/ModeContext'

function App() {
  return (
    <ModeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/textbook/:id/chat" element={<AIChatPage />} />
        </Routes>
      </BrowserRouter>
    </ModeProvider>
  )
}

export default App
