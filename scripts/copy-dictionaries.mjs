// Copia el diccionario Hunspell de español de node_modules a public/dict/ para servirlo como asset estático.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const out = join(process.cwd(), 'public', 'dict');
mkdirSync(out, { recursive: true });

const pkgDir = dirname(require.resolve('dictionary-es'));
for (const ext of ['aff', 'dic']) {
  copyFileSync(join(pkgDir, `index.${ext}`), join(out, `es.${ext}`));
}
console.log('[dict] diccionario de español copiado a public/dict/');
