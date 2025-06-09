import './style.css'
import { WebXRApp } from './webxr-app.js'
import 'webxr-polyfill'

document.addEventListener('DOMContentLoaded', () => {
  const loadingElement = document.getElementById('loading')
  if (loadingElement) {
    loadingElement.classList.add('hidden')
  }
  
  try {
    new WebXRApp()
    console.log('webXR loaded')
  } catch (error) {
    console.error('Failed to initialize WebXR app:', error)
    showError('Failed to initialize WebXR application. Please refresh the page.')
  }
})

function showError(message: string) {
  const errorDiv = document.createElement('div')
  errorDiv.className = 'error-message'
  errorDiv.innerHTML = `
    <h2>Error</h2>
    <p>${message}</p>
    <button onclick="location.reload()">Refresh Page</button>
  `
  document.body.appendChild(errorDiv)
}
