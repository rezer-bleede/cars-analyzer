import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    css: true,
    globals: true
  }
})
