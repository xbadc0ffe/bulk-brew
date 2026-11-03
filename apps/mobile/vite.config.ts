import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Capacitor serves the built files from the app bundle, so base stays "./".
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
});
