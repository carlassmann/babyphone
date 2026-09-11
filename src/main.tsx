import { createRoot } from 'react-dom/client';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import './style.css';
import { RouterProvider } from '@tanstack/react-router';
import { IconDefaults } from './icons';
import { router } from './router';
createRoot(document.getElementById('root')!).render(
  <IconDefaults>
    <RouterProvider router={router} />
  </IconDefaults>,
);
