import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testDir: './tests/native',
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:4173/frameflow/',
    headless: false,
    viewport: null,
    launchOptions: {
      executablePath: process.env.FRAMEFLOW_BROWSER_EXECUTABLE || undefined,
      args: [
        '--auto-select-tab-capture-source-by-title=Mobile browser fixture',
        '--auto-select-desktop-capture-source=Mobile browser fixture',
        '--enable-usermedia-screen-capturing',
      ],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
