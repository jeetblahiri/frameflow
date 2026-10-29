import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { contentSecurityPolicy } from './src/lib/security-policy';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'production-content-policy',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler() {
          return [
            {
              tag: 'meta',
              attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
              injectTo: 'head-prepend',
            },
          ];
        },
      },
    },
  ],
  base: './',
  build: { target: 'es2022' },
});
