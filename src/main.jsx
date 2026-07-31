import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { markNativeShell, initNativeShell } from './native/bootstrap.js'

// Synchronous and before the first render -- see bootstrap.js for why.
markNativeShell()

createRoot(document.getElementById('root')).render(<App />)

// Runs after the initial render call above -- see bootstrap.js for why this
// timing is what hides the splash screen without a blank-content flash.
initNativeShell()
