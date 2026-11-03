import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { creerLApi } from './api.ts';
import { App } from './App.tsx';
import './styles.css';

const racine = document.getElementById('racine');
if (racine === null) throw new Error('Élément #racine absent de index.html.');

createRoot(racine).render(
  <StrictMode>
    <App api={creerLApi()} />
  </StrictMode>,
);
