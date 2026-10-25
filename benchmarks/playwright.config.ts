import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', outputDir: '../benchmark-test-results', timeout: 180_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174/RL-Playground/', channel: 'msedge', viewport: { width: 1366, height: 768 } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort', url: 'http://127.0.0.1:4174/RL-Playground/', reuseExistingServer: false },
})
