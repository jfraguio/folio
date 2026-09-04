// Smoke test end-to-end con el Chrome del sistema.
// Simula la File System Access API en memoria para poder recorrer el flujo completo sin diálogos nativos.
//
//   npm run build && npm run smoke
//
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PORT = 4179;
const DIST = join(process.cwd(), 'dist');
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.aff': 'text/plain',
  '.dic': 'text/plain',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path = join(DIST, decodeURIComponent(url.pathname));
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
  } catch {
    path = join(DIST, 'index.html');
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const FAKE_FS = `
  window.__files = {};
  function makeHandle(name) {
    const h = {
      kind: 'file', name,
      async getFile() {
        const f = window.__files[name] ?? { text: '', mtime: Date.now() };
        const file = new File([f.text], name, { type: 'text/markdown', lastModified: f.mtime });
        return file;
      },
      async createWritable() {
        let buf = '';
        return {
          async write(chunk) { buf += typeof chunk === 'string' ? chunk : await new Response(chunk).text(); },
          async close() { window.__files[name] = { text: buf, mtime: Date.now() }; window.__writes = (window.__writes ?? 0) + 1; },
        };
      },
      async isSameEntry(o) { return o && o.name === name; },
      async queryPermission() { return 'granted'; },
      async requestPermission() { return 'granted'; },
    };
    return h;
  }
  window.showOpenFilePicker = async () => [makeHandle('existente.md')];
  window.showSaveFilePicker = async (o) => makeHandle(o?.suggestedName ?? 'novela.md');
  window.__files['existente.md'] = { text: '# Uno\\n\\nHola mundo.\\n\\n# Dos\\n\\nAdiós.\\n', mtime: 1000 };
`;

const errors = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => {
  if (m.type() === 'error') {
    errors.push(m.text());
    console.log('  [console.error]', m.text());
  }
});
page.on('pageerror', (e) => {
  errors.push(String(e));
  console.log('  [pageerror]', String(e));
});
await page.addInitScript(FAKE_FS);

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};

await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForSelector('.start');
check('pantalla inicial', (await page.textContent('.start')).includes('Abrir'));
check('marca arriba a la derecha, no en el centro', (await page.textContent('.brand')) === 'Folio' && !(await page.textContent('.start')).includes('Folio'));
check('marca en mayúsculas', (await page.$eval('.brand', (e) => getComputedStyle(e).textTransform)) === 'uppercase');

// Nueva novela → capítulo por defecto y cursor listo.
await page.click('.start__action:has-text("Nuevo")');
await page.waitForSelector('.cm-content');
const initial = await page.evaluate(() => window.__files['novela.md']?.text);
check('nueva novela crea "# Capítulo 1"', initial === '# Capítulo 1\n\n', JSON.stringify(initial));

// Escribir y comprobar autosave (debounce 1,5 s).
await page.keyboard.type('El hombre llegó a la estación poco después de las doce.');
await page.waitForTimeout(2500);
const saved = await page.evaluate(() => window.__files['novela.md']?.text);
check('autosave escribe en el archivo', saved === '# Capítulo 1\n\nEl hombre llegó a la estación poco después de las doce.', JSON.stringify(saved));
const dotState = await page.getAttribute('.status-dot', 'data-state');
check('indicador en estado saved', dotState === 'saved', dotState);

await page.screenshot({ path: '/tmp/folio-light.png' });
await page.screenshot({ path: '/tmp/folio-brand.png', clip: { x: 1080, y: 0, width: 200, height: 60 } });

// Focus mode aplicado.
check('focus mode activo', (await page.$('.cm-focus-mode .cm-active-para')) !== null);

// Encabezado estilizado.
check('encabezado H1 estilizado', (await page.$('.cm-md-heading1')) !== null);

// Paleta de comandos.
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
await page.waitForSelector('.panel__list');
const paletteItems = await page.$$eval('.panel__item .panel__label', (els) => els.map((e) => e.textContent));
check('paleta lista comandos', paletteItems.includes('Capítulos') && !paletteItems.includes('Índice de capítulos'), String(paletteItems.length));
check('paleta sin Guardar ahora / Guardar como', !paletteItems.some((l) => l.startsWith('Guardar')), JSON.stringify(paletteItems));
check('paleta sin tamaño de texto ni focus mode', !paletteItems.some((l) => /tamaño del texto|focus mode/i.test(l)), JSON.stringify(paletteItems));
const sizeBefore = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim());
await page.keyboard.press('Escape');
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+=' : 'Control+=');
const sizeAfter = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim());
check('atajo de tamaño de texto sigue funcionando', parseInt(sizeAfter) === parseInt(sizeBefore) + 1, `${sizeBefore} → ${sizeAfter}`);
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+-' : 'Control+-');
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
await page.waitForSelector('.panel__list');
check('paleta sin buscador', (await page.$('.panel__input')) === null);
check('paleta sin "Tema según el sistema"', !paletteItems.includes('Tema según el sistema'));
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/folio-palette.png' });
await page.keyboard.press('Escape');
check('Esc cierra la paleta', (await page.$('.overlay')) === null);
const menuTitle = await page.getAttribute('.menu-button', 'title');
check('botón de menú con title y atajo', /^Menú \(.+K\)$/.test(menuTitle ?? ''), menuTitle);
await page.click('.menu-button');
await page.waitForSelector('.panel__list');
check('botón de menú abre la paleta', (await page.$('.overlay')) !== null);
await page.keyboard.press('Escape');

// Índice de capítulos con contador.
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.keyboard.type('# Capítulo 2');
await page.keyboard.press('Enter');
await page.keyboard.type('Nadie esperaba.');
await page.keyboard.press('Shift+Enter');
await page.keyboard.type('Segunda línea.');
await page.waitForTimeout(2500);
const afterEnter = await page.evaluate(() => window.__files['novela.md']?.text);
check(
  'Enter crea párrafo (línea en blanco) y Shift+Enter salto simple',
  afterEnter === '# Capítulo 1\n\nEl hombre llegó a la estación poco después de las doce.\n\n# Capítulo 2\n\nNadie esperaba.\nSegunda línea.',
  JSON.stringify(afterEnter),
);
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+p' : 'Control+p');
await page.waitForSelector('.panel__input');
const chapters = await page.$$eval('.panel__item', (els) =>
  els.map((e) => [e.querySelector('.panel__label').textContent, e.querySelector('.panel__meta').textContent]),
);
check(
  'índice con contador por capítulo',
  JSON.stringify(chapters) === JSON.stringify([['Capítulo 1', '11'], ['Capítulo 2', '4']]),
  JSON.stringify(chapters),
);
await page.screenshot({ path: '/tmp/folio-chapters.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const counter = await page.textContent('.word-count');
check('contador capítulo/novela abajo a la derecha', counter === '4/15', counter);
const [brandRight, counterRight, dotRight] = await page.evaluate(() =>
  ['.brand', '.word-count', '.status-dot'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().right)),
);
check('contador alineado a la derecha con la marca y punto a su izquierda', brandRight === counterRight && dotRight < counterRight, `${brandRight} ${counterRight} ${dotRight}`);
await page.screenshot({ path: '/tmp/folio-counter.png', clip: { x: 1080, y: 740, width: 200, height: 60 } });
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+p' : 'Control+p');
await page.waitForSelector('.panel__input');
const footer = await page.textContent('.panel__footer');
check('total de palabras en el pie', footer.trim() === '15 palabras', footer);
await page.click('.panel__item:first-child');
await page.waitForTimeout(100);
const cursorLine = await page.evaluate(() => {
  const sel = window.getSelection();
  return sel?.anchorNode?.parentElement?.closest('.cm-line')?.textContent ?? '';
});
check('navegar al capítulo mueve el cursor', cursorLine.startsWith('El hombre'), cursorLine);

// Tema.
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+l' : 'Control+Shift+l');
const theme = await page.evaluate(() => document.documentElement.dataset.theme);
check('atajo cambia el tema', theme === 'dark', theme);
const stored = await page.evaluate(() => localStorage.getItem('folio.theme'));
check('tema persistido', stored === 'dark', stored);
await page.waitForTimeout(2000); // deja terminar el autosave antes de recargar
await page.reload();
await page.waitForSelector('.start');
const themeAfterReload = await page.evaluate(() => document.documentElement.dataset.theme);
check('tema oscuro se conserva tras recargar', themeAfterReload === 'dark', themeAfterReload);
const chromeOpacity = await page.$eval('.brand', (e) => getComputedStyle(e).opacity);
check('marca más visible en oscuro', Number(chromeOpacity) >= 0.6, chromeOpacity);
await page.screenshot({ path: '/tmp/folio-dark-start.png' });
await page.click('.start__action:has-text("Abrir")');
await page.waitForSelector('.cm-content');

// Corrector: espera a que el worker marque una palabra inexistente.
await page.keyboard.press('End');
await page.keyboard.type(' Xqzwrtv palabra.');
await page.keyboard.press('ArrowLeft');
const marked = await page.waitForSelector('.cm-misspelled', { timeout: 15000 }).catch(() => null);
check('corrector marca palabra inexistente', marked !== null, marked ? await marked.textContent() : 'sin marca');
const wrongMark = await page.$$eval('.cm-misspelled', (els) => els.map((e) => e.textContent));
check('corrector no marca palabras correctas', !wrongMark.includes('palabra') && !wrongMark.includes('hombre'), JSON.stringify(wrongMark));

// Abrir novela existente: reabrir desde la pantalla inicial.
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
await page.waitForSelector('.panel__list');
const finalItems = await page.$$eval('.panel__item .panel__label', (els) => els.map((e) => e.textContent));
check('menú sin "Abrir otra novela"', !finalItems.includes('Abrir otra novela'));
check('menú con "texto centrado" y "asistencia literaria" activados por defecto', finalItems.includes('Desactivar texto centrado') && finalItems.includes('Desactivar asistencia literaria'), JSON.stringify(finalItems));
await page.keyboard.press('Escape');
await page.waitForTimeout(2000);
await page.reload();
await page.waitForSelector('.start');
const startText = await page.textContent('.start');
check('vuelve a la pantalla inicial', startText.includes('Abrir'), startText.slice(0, 120));
await page.click('.start__action:has-text("Abrir")');
await page.waitForSelector('.cm-content');
const opened = await page.textContent('.cm-content');
check('abre novela existente', opened.includes('Hola mundo'), opened.slice(0, 60));

await page.screenshot({ path: '/tmp/folio-editor.png' });

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
if (errors.length) {
  console.log('\nErrores de consola:');
  for (const e of errors) console.log('  ' + e);
}
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
process.exit(failed.length || errors.length ? 1 : 0);
