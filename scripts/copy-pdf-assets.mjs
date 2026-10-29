import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const generated = fileURLToPath(new URL('../public/pdf-assets/', import.meta.url));
rmSync(generated, { recursive: true, force: true });
// PDF.js loads these only for documents that need extra fonts, CMaps or decoders.
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  const target = fileURLToPath(new URL(`../public/pdf-assets/${directory}/`, import.meta.url));
  mkdirSync(target, { recursive: true });
  cpSync(
    fileURLToPath(new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url)),
    target,
    { recursive: true },
  );
}

// Keep distributed third-party notices aligned with the installed, locked versions.
const notices = fileURLToPath(new URL('../public/licenses/', import.meta.url));
mkdirSync(notices, { recursive: true });
for (const [name, file] of [
  ['react', 'LICENSE'],
  ['react-dom', 'LICENSE'],
  ['idb', 'LICENSE'],
  ['lucide-react', 'LICENSE'],
  ['pdfjs-dist', 'LICENSE'],
  ['jszip', 'LICENSE.markdown'],
  ['gifuct-js', 'LICENSE'],
  ['@fontsource/dm-sans', 'LICENSE'],
  ['@fontsource/manrope', 'LICENSE'],
]) {
  cpSync(
    fileURLToPath(new URL(`../node_modules/${name}/${file}`, import.meta.url)),
    `${notices}/${name.replaceAll('/', '-').replace('@', '')}-${file}.txt`,
  );
}
