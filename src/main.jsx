import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { FuelProvider } from './hooks/useFuelContext.jsx'
import { ThemeProvider } from './hooks/useTheme.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <FuelProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </FuelProvider>
    </ThemeProvider>
  </StrictMode>,
)
