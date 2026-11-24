import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const elementoRaiz = document.getElementById('root');
if (!elementoRaiz) {
  throw new Error('No se encontró el contenedor raíz #root');
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

