import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/RL-Playground/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
