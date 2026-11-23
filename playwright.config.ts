import { defineConfig, devices } from '@playwright/test';
import { basePath } from './tests/base-path';

const port = 4399;
const home = `http://localhost:${port}${basePath}/`;

/** End-to-end tests run against the production build, the same files a host would serve. */
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: home,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && node tests/serve.mjs ${port} "${basePath}"`,
    url: home,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
