// Smoke test de to-do: levanta dist/ servido en http://localhost:8931 y recorre el flujo
// completo con el Chrome del sistema, inyectando una File System Access API en memoria
// (sin diálogos nativos). Uso: node scripts/smoke.mjs
import { chromium } from '/Users/franciscojfc/Documents/dev/PERSONAL/folio/node_modules/playwright-core/index.mjs';

const BASE = 'http://localhost:8931';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Implementación en memoria de showOpenFilePicker/showSaveFilePicker + permisos.
// El "disco" se persiste en localStorage para sobrevivir a page.reload() en el smoke.
// Los handles son structured-cloneables (planos), para que IndexedDB pueda persistirlos.
const fsShim = `
  (function () {
    const load = () => new Map(JSON.parse(localStorage.getItem('__fs') || '[]'));
    const save = (s) => localStorage.setItem('__fs', JSON.stringify([...s]));
    function makeHandle(name) {
      return {
        kind: 'file',
        name,
        getFile() {
          const e = load().get(name);
          return Promise.resolve(new File([e?.content ?? ''], name, { type: 'text/markdown', lastModified: e?.lastModified ?? Date.now() }));
        },
        createWritable() {
          let buf = '';
          return Promise.resolve({
            write(t) { return Promise.resolve().then(() => { buf += typeof t === 'string' ? t : ''; }); },
            close() { const s = load(); s.set(name, { content: buf, lastModified: Date.now() }); save(s); return Promise.resolve(); },
          });
        },
        queryPermission() { return Promise.resolve('granted'); },
        requestPermission() { return Promise.resolve('granted'); },
        isSameEntry(other) { return Promise.resolve(!!other && other.name === name); },
      };
    }
    window.showSaveFilePicker = (opts) => {
      const name = (opts && opts.suggestedName) || 'to-do.md';
      const s = load();
      if (!s.has(name)) { s.set(name, { content: '', lastModified: Date.now() }); save(s); }
      return Promise.resolve(makeHandle(name));
    };
    window.showOpenFilePicker = () => Promise.resolve([makeHandle([...load().keys()][0] ?? 'to-do.md')]);
    window.__fsRead = (name) => load().get(name)?.content;
  })();
`;

const results = [];
const ok = (name, cond) => {
  results.push([cond ? 'PASS' : 'FAIL', name]);
  if (!cond) process.exitCode = 1;
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

await page.addInitScript(fsShim);
await page.goto(BASE, { waitUntil: 'load' });

// 1. Pantalla inicial con las acciones.
await page.waitForSelector('.start__action');
ok('pantalla inicial con Abrir/Nuevo', (await page.locator('.start__action').count()) >= 2);
ok('marca TO-DO visible', (await page.locator('.brand').textContent()) === 'TO-DO');

// 2. Nuevo archivo → entra en el editor.
await page.getByRole('button', { name: 'NEW', exact: true }).click();
await page.waitForSelector('.cm-editor');
ok('editor creado tras Nuevo', true);
ok('un archivo nuevo tiene una sola tab', (await page.locator('.tab-bar__tab').count()) === 1);
ok('tabs vacías se llaman por su número', (await page.locator('.tab-bar__tab').first().textContent()) === '1');
// Con una única tab (vacía) el menú ofrece crear, pero no eliminar.
await page.keyboard.press('Meta+k');
await page.waitForSelector('.panel__item');
let menuLabels = await page.locator('.panel__item .panel__label').allTextContents();
ok('el menú ofrece «Crear pestaña» al final y no «Eliminar» con una sola tab', menuLabels.at(-1) === 'Crear pestaña' && !menuLabels.some((l) => l.startsWith('Eliminar pestaña')));
await page.keyboard.press('Escape');

// 3. Escribir en la tab 1: el título cambia a la primera palabra.
await page.locator('.cm-content').click();
await page.keyboard.type('Compra semanal\nLeche y pan');
await page.waitForTimeout(100);
ok('tab con contenido usa la primera palabra', (await page.locator('.tab-bar__tab').first().textContent()) === 'Compra');

// 4. Autosave: el punto aparece (dirty) y desaparece tras el guardado.
await page.waitForTimeout(1800); // debounce 1,5 s
await page.waitForFunction(() => document.querySelector('.status-dot')?.dataset.state === 'saved', null, { timeout: 5000 });
const savedMd = await page.evaluate(() => window.__fsRead('to-do.md'));
ok('autosave escribió el .md con el marcador de tab', savedMd?.includes('[todo:tab 1]') && savedMd.includes('Compra semanal'));

// 5. Crear una tab desde el menú: pasa a estar activa y vacía; el menú ofrece eliminarla.
const menuRun = async (label) => {
  await page.keyboard.press('Meta+k');
  await page.waitForSelector('.panel__item');
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.waitForTimeout(100);
};
ok('con texto en la tab 1 el menú no ofrece eliminarla', !(await (async () => { await page.keyboard.press('Meta+k'); await page.waitForSelector('.panel__item'); const ls = await page.locator('.panel__item .panel__label').allTextContents(); await page.keyboard.press('Escape'); return ls; })()).some((l) => l.startsWith('Eliminar pestaña')));
await menuRun('Crear pestaña');
ok('«Crear pestaña» crea la tab 2 y la activa', (await page.locator('.tab-bar__tab').count()) === 2 && await page.locator('.tab-bar__tab').nth(1).evaluate((n) => n.classList.contains('tab-bar__tab--active')));
const docTab2 = await page.locator('.cm-content').textContent();
ok('tab 2 vacía', (docTab2 ?? '') === '');
await page.keyboard.press('Meta+k');
await page.waitForSelector('.panel__item');
menuLabels = await page.locator('.panel__item .panel__label').allTextContents();
ok('el menú ofrece «Eliminar pestaña 2» para la tab abierta vacía', menuLabels.includes('Eliminar pestaña 2'));
await page.keyboard.press('Escape');
// Eliminarla y volver a crearla: se vuelve a la tab 1 y luego a una tab 2 nueva.
await menuRun('Eliminar pestaña 2');
ok('«Eliminar pestaña 2» la quita y vuelve a la 1', (await page.locator('.tab-bar__tab').count()) === 1 && await page.locator('.tab-bar__tab').first().evaluate((n) => n.classList.contains('tab-bar__tab--active')));
ok('la tab 1 conserva su texto tras eliminar la 2', (await page.locator('.cm-content').textContent())?.includes('Compra semanal'));
await menuRun('Crear pestaña');
// Cambiar de tab con el clic sigue funcionando.
await page.locator('.tab-bar__tab').nth(0).click();
await page.locator('.tab-bar__tab').nth(1).click();
ok('tab 2 activa tras clic', await page.locator('.tab-bar__tab').nth(1).evaluate((n) => n.classList.contains('tab-bar__tab--active')));

// 6. Escribir en tab 2 y volver con atajo ⌘1: el contenido de la 1 persiste.
await page.keyboard.type('Ideas varias');
await page.waitForTimeout(100);
await page.keyboard.press('Meta+1');
await page.waitForTimeout(100);
ok('atajo Mod+1 vuelve a la tab 1', await page.locator('.tab-bar__tab').first().evaluate((n) => n.classList.contains('tab-bar__tab--active')));
await page.keyboard.press('Meta+5');
await page.waitForTimeout(100);
ok('Mod+N a una tab que no existe no hace nada', await page.locator('.tab-bar__tab').first().evaluate((n) => n.classList.contains('tab-bar__tab--active')));
ok('contenido de la tab 1 intacto', (await page.locator('.cm-content').textContent())?.includes('Compra semanal'));

// 7. Menú con ⌘K: las cuatro opciones en orden + pantalla completa (+ «Añadir palabra» condicional,
//    porque el cursor está sobre una palabra tras escribir).
await page.keyboard.press('Meta+k');
await page.waitForSelector('.panel__item');
const labels = await page.locator('.panel__item .panel__label').allTextContents();
const base = labels.filter((l) => !l.startsWith('Añadir'));
ok('menú con Tema, corrector, Diccionario, Historial, Pantalla completa y Crear pestaña al final', JSON.stringify(base) === JSON.stringify([
  'Tema oscuro', 'Desactivar corrector', 'Diccionario', 'Historial', 'Pantalla completa', 'Crear pestaña',
]));
ok('menú ofrece añadir la palabra bajo el cursor', labels.some((l) => l.startsWith('Añadir «') && l.endsWith('» al diccionario')));
// Con el corrector desactivado, «Añadir … al diccionario» (y «Diccionario») no se ofrecen.
await page.getByRole('option', { name: 'Desactivar corrector', exact: true }).click();
await page.waitForTimeout(100);
await page.keyboard.press('Meta+k');
await page.waitForSelector('.panel__item');
const offLabels = await page.locator('.panel__item .panel__label').allTextContents();
ok('sin corrector no se ofrece añadir palabra al diccionario', !offLabels.some((l) => l.startsWith('Añadir')) && !offLabels.includes('Diccionario'));
await page.getByRole('option', { name: 'Activar corrector', exact: true }).click();
await page.waitForTimeout(100);
await page.keyboard.press('Meta+k');
await page.waitForSelector('.panel__item');
ok('al reactivar el corrector vuelve la opción', (await page.locator('.panel__item .panel__label').allTextContents()).some((l) => l.startsWith('Añadir «')));

// 8. Tema oscuro desde el menú.
await page.getByRole('option', { name: 'Tema oscuro' }).click();
await page.waitForTimeout(100);
ok('tema oscuro aplicado', await page.evaluate(() => document.documentElement.dataset.theme === 'dark'));

// 9. Corrector: con el diccionario cargado, una palabra inventada se marca en rojo.
await page.keyboard.type('holaaaquetal ');
await page.waitForTimeout(2500); // carga del diccionario + debounce 400 ms
const misspelled = await page.locator('.cm-misspelled').count();
ok('corrector marca la palabra errónea', misspelled >= 1);

// 10. Diccionario desde el menú (vacío por ahora).
await page.keyboard.press('Meta+k');
await page.waitForSelector('.panel__item');
await page.getByRole('option', { name: 'Diccionario', exact: true }).click();
await page.waitForSelector('.dict');
ok('panel de diccionario abierto', (await page.locator('.panel__footer').first().textContent())?.includes('Diccionario personal'));
await page.keyboard.press('Escape');

// 11. Historial desde el menú (debe tener la copia de apertura de hoy... el archivo se creó vacío).
await page.keyboard.press('Meta+k');
await page.waitForSelector('.panel__item');
await page.getByRole('option', { name: 'Historial' }).click();
await page.waitForSelector('.history');
await page.waitForTimeout(300);
const histText = await page.locator('.panel--tall').textContent();
ok('historial abierto', histText?.includes('Historial'));
await page.keyboard.press('Escape');

// 12. Reapertura: recargar y abrir de nuevo; el contenido persiste desde el "disco".
// (Con handles falsos no clonables no hay «Continuar»; se reabre con «Abrir», como en el smoke de Folio.)
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.start__action');
await page.getByRole('button', { name: 'OPEN', exact: true }).click();
await page.waitForSelector('.cm-editor');
await page.waitForTimeout(200);
ok('contenido recuperado tras reabrir', (await page.locator('.cm-content').textContent())?.includes('Compra semanal'));
ok('la tab recuerda su título al reabrir', (await page.locator('.tab-bar__tab').first().textContent()) === 'Compra');
ok('el número de tabs se conserva al reabrir', (await page.locator('.tab-bar__tab').count()) === 2);
ok('tema oscuro persiste tras recargar', await page.evaluate(() => document.documentElement.dataset.theme === 'dark'));

await browser.close();

console.log('\n--- smoke ---');
for (const [s, n] of results) console.log(`${s}  ${n}`);
console.log(results.every(([s]) => s === 'PASS') ? 'TODO OK' : 'HAY FALLOS');
