import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initNativeShell } from './native/bootstrap.js'

createRoot(document.getElementById('root')).render(<App />)

// Runs after the initial render call above -- see bootstrap.js for why this
// timing is what hides the splash screen without a blank-content flash.
initNativeShell()
