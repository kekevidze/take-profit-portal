import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          marketing: path.resolve(__dirname, 'marketing/index.html'),
          agent: path.resolve(__dirname, 'agent/index.html'),
          deposit: path.resolve(__dirname, 'deposit/index.html'),
          depositWelcome: path.resolve(__dirname, 'deposit/welcome.html'),
          depositFaqContent: path.resolve(__dirname, 'deposit/faq-content.html'),
          backoffice: path.resolve(__dirname, 'backoffice/index.html'),
        },
      },
    },
  };
});
