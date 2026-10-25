import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/RL-Playground/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    // Bound concurrent JSDOM heaps so full UI suites do not starve one another.
    maxWorkers: 2,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
