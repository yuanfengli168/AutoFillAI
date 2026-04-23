import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outfile = resolve(root, 'dist/content.js');

await mkdir(resolve(root, 'dist'), { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/content/content-script.ts')],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome114'],
  sourcemap: true,
  logLevel: 'info'
});
