import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { WorkoutProvider } from './lib/workout-context.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WorkoutProvider>
        <App />
      </WorkoutProvider>
    </BrowserRouter>
  </StrictMode>,
)
