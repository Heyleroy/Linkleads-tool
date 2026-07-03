import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from '/vite-plugin-web-extension'"latest"
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: 'src/manifest.json',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
