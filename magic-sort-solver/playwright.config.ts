import { defineConfig, devices } from '@playwright/test';

// Echte WebKit-Engine (wie Safari) mit iPhone-/iPad-Geräteprofilen. Für Tests auf echter
// Hardware siehe README („Manuelle Tests auf dem Gerät“).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    { name: 'iphone-se', use: { ...devices['iPhone SE'], browserName: 'webkit' } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'], browserName: 'webkit' } },
    { name: 'ipad-hoch', use: { ...devices['iPad (gen 7)'], browserName: 'webkit' } },
    { name: 'ipad-quer', use: { ...devices['iPad (gen 7) landscape'], browserName: 'webkit' } },
  ],
});
