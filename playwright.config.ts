import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
const rate = 44100,
  samples = rate * 4,
  wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++)
  wav.writeInt16LE(Math.round(Math.sin((i / rate) * Math.PI * 880) * 6000), 44 + i * 2);
mkdirSync('.cache', { recursive: true });
const audioFixture = resolve('.cache/test-input.wav');
writeFileSync(audioFixture, wav);
const production = process.env.FRAMEFLOW_E2E_PRODUCTION === '1';
const baseURL = production ? 'http://127.0.0.1:4173/frameflow/' : 'http://127.0.0.1:5173/';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 1440, height: 960 },
    permissions: ['camera', 'microphone'],
    launchOptions: {
      executablePath: process.env.FRAMEFLOW_BROWSER_EXECUTABLE || undefined,
      args: [
        '--disable-gpu',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${audioFixture}`,
      ],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node tests/browser-fixture.mjs',
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: production
        ? 'node scripts/serve-built.mjs'
        : 'npm run dev -- --port 5173 --strictPort',
      url: baseURL,
      reuseExistingServer: !production && !process.env.CI,
      timeout: 30000,
    },
  ],
});
