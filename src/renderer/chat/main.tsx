import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../ui/base.css'
import './chat.css'
import { Chat } from './Chat'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Chat />
  </StrictMode>
)
