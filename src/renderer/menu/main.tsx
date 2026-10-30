import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './menu.css'
import { Menu } from './Menu'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Menu />
  </StrictMode>
)
