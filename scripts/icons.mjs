// Genera los iconos PNG de la PWA a partir de public/icon.svg con el Chrome del sistema
// (no hay rasterizador SVG en el proyecto). Uso: node scripts/icons.mjs
//
//   icon-192.png, icon-512.png     → manifest (purpose: any), Android y Chrome de escritorio
//   icon-maskable-512.png          → manifest (purpose: maskable): Android recorta la forma, así que
//                                    el dibujo va centrado con margen de seguridad sobre fondo pleno
//   apple-touch-icon.png (180)     → iOS no acepta SVG en el icono de la pantalla de inicio
import { chromium } from '/Users/franciscojfc/Documents/dev/PERSONAL/folio/node_modules/playwright-core/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(join(root, 'public/icon.svg'), 'utf8');

/** Fondo del icono: el --bg del tema claro (el SVG original usa blanco puro). */
const BG = '#f5f4f0';

const targets = [
  { file: 'icon-192.png', size: 192, inset: 0 },
  { file: 'icon-512.png', size: 512, inset: 0 },
  // Zona segura de los iconos enmascarables: el 80 % central.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.1 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0 },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
    const pad = Math.round(t.size * t.inset);
    const inner = t.size - pad * 2;
    // Fondo pleno (sin esquinas redondeadas: las pone el sistema) y el SVG encima.
    await page.setContent(`<!doctype html><html><body style="margin:0;background:${BG};width:${t.size}px;height:${t.size}px;display:grid;place-items:center">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ').replace('fill="#FFFFFF"', `fill="${BG}"`)}</div>
    </body></html>`);
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: t.size, height: t.size } });
    await writeFile(join(root, 'public', t.file), png);
    await page.close();
    console.log(`[icons] ${t.file} (${t.size}px)`);
  }
} finally {
  await browser.close();
}
