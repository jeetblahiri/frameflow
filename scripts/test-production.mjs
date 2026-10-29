import { spawnSync } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let result = spawnSync(npm, ['run', 'build'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
result = spawnSync(npm, ['run', 'test:e2e', '--', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, FRAMEFLOW_E2E_PRODUCTION: '1' },
});
process.exit(result.status ?? 1);
