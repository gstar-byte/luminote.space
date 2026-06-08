import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            editor: [
              '@tiptap/react', 
              '@tiptap/starter-kit', 
              '@tiptap/extension-image', 
              '@tiptap/extension-link', 
              '@tiptap/extension-placeholder', 
              '@tiptap/extension-text-align', 
              '@tiptap/extension-text-style', 
              '@tiptap/extension-underline', 
              '@tiptap/extension-bubble-menu', 
              '@tiptap/extension-color'
            ],
            motion: ['motion'],
            vendor: ['react', 'react-dom', 'react-helmet-async', 'lucide-react'],
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        manifest: false,
        workbox: {
          cleanupOutdatedCaches: true,
          importScripts: ['/notification-sw.js'],
        },
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon-48-v17.png', 
          'favicon-192-v17.png', 
          'favicon-512-v17.png', 
          'favicon-maskable-192-v17.png', 
          'favicon-maskable-512-v17.png', 
          'apple-touch-icon-v17.png', 
          'app-logo.svg',
          'favicon.svg'
        ],
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      // Ensure a single React instance so `react-dom`'s `createPortal`
      // (used for un-clipped floating menus) shares the app's hook dispatcher.
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
