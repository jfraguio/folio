import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __fsRead: (name: string) => string | undefined;
  }
}

/** En Mac el atajo es ⌘; en el resto (CI incluida), Ctrl. Igual que `IS_MAC` en la app. */
const Mod = process.platform === 'darwin' ? 'Meta' : 'Control';

/**
 * File System Access en memoria. El "disco" vive en localStorage para sobrevivir a `reload()`.
 * Los handles son planos (no clonables en IndexedDB, como en el smoke anterior): folio los guarda
 * sin identidad física, así que no aparece «Continuar» y se reabre con «Abrir».
 */
const FS_SHIM = `
  (function () {
    const load = () => new Map(JSON.parse(localStorage.getItem('__fs') || '[]'));
    const save = (s) => localStorage.setItem('__fs', JSON.stringify([...s]));
    function makeHandle(name) {
      return {
        kind: 'file',
        name,
        getFile() {
          const e = load().get(name);
          return Promise.resolve(new File([e?.content ?? ''], name, { type: 'text/plain', lastModified: e?.lastModified ?? Date.now() }));
        },
        createWritable() {
          let buf = '';
          return Promise.resolve({
            write(t) { return Promise.resolve().then(() => { buf += typeof t === 'string' ? t : ''; }); },
            close() { const s = load(); s.set(name, { content: buf, lastModified: Date.now() }); save(s); return Promise.resolve(); },
            abort() { return Promise.resolve(); },
          });
        },
        queryPermission() { return Promise.resolve('granted'); },
        requestPermission() { return Promise.resolve('granted'); },
        isSameEntry(other) { return Promise.resolve(!!other && other.name === name); },
      };
    }
    window.showSaveFilePicker = (opts) => {
      const name = (opts && opts.suggestedName) || 'folio.txt';
      const s = load();
      if (!s.has(name)) { s.set(name, { content: '', lastModified: Date.now() }); save(s); }
      return Promise.resolve(makeHandle(name));
    };
    window.showOpenFilePicker = () => Promise.resolve([makeHandle([...load().keys()][0] ?? 'folio.txt')]);
    window.__fsRead = (name) => load().get(name)?.content;
  })();
`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(FS_SHIM);
});

/** Abre un archivo nuevo y espera al editor. */
async function createFile(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'NEW', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'NEW', exact: true }).click();
  await page.waitForSelector('.cm-editor');
}

/** Ejecuta una opción del menú por su etiqueta exacta (teclado, sin depender del hover). */
async function runMenu(page: Page, label: string): Promise<void> {
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  const labels = await page.locator('.panel__item .panel__label').allTextContents();
  const idx = labels.indexOf(label);
  expect(idx, `el menú no ofrece «${label}»`).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < idx; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
}

test('nuevo archivo: escribir, autosave, tabs y undo aislado por tab', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await expect(page.locator('.tab-bar__tab')).toHaveCount(1);
  await expect(page.locator('.tab-bar__tab').first()).toHaveText('1');

  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra semanal\nLeche y pan');
  await expect(page.locator('.tab-bar__tab').first()).toHaveText('Compra');

  // Autosave: el punto llega a «saved» y el marcador está en disco.
  await page.waitForFunction(
    () => document.querySelector('.status-dot')?.getAttribute('data-state') === 'saved',
    null,
    {
      timeout: 5000,
    },
  );
  const saved = await page.evaluate(() => window.__fsRead('folio.txt'));
  expect(saved).toContain('[todo:tab 1]');
  expect(saved).toContain('Compra semanal');

  // Crear la tab 2 (vacía) y comprobar que ⌘Z no trae el texto de la tab 1.
  await runMenu(page, 'Crear pestaña');
  await expect(page.locator('.tab-bar__tab')).toHaveCount(2);
  await expect(page.locator('.cm-content')).toHaveText('');
  await page.keyboard.press(`${Mod}+z`);
  await expect(page.locator('.cm-content')).toHaveText('');

  // Volver con el atajo y comprobar que la tab 1 conserva lo suyo.
  await page.keyboard.press(`${Mod}+1`);
  await expect(page.locator('.cm-content')).toContainText('Compra semanal');
});

test('el menú refleja el estado y el corrector se activa/desactiva', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra');

  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  let labels = await page.locator('.panel__item .panel__label').allTextContents();
  expect(labels).toContain('Diccionario');
  expect(labels.some((l) => l.startsWith('Añadir «'))).toBe(true);
  await page.keyboard.press('Escape');

  // Sin corrector no se ofrecen «Diccionario» ni «Añadir … al diccionario».
  await runMenu(page, 'Desactivar corrector');
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  labels = await page.locator('.panel__item .panel__label').allTextContents();
  expect(labels).not.toContain('Diccionario');
  expect(labels.some((l) => l.startsWith('Añadir «'))).toBe(false);
  await page.keyboard.press('Escape');

  await runMenu(page, 'Activar corrector');
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  labels = await page.locator('.panel__item .panel__label').allTextContents();
  expect(labels).toContain('Diccionario');
  await page.keyboard.press('Escape');
});

test('tema oscuro desde el menú', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await runMenu(page, 'Tema oscuro');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('el corrector marca una palabra inventada', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('holaaaquetal ');
  await expect(page.locator('.cm-misspelled')).toHaveCount(1, { timeout: 6000 });
});

test('reabrir conserva el contenido y las tabs', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra semanal');
  await page.waitForFunction(
    () => document.querySelector('.status-dot')?.getAttribute('data-state') === 'saved',
    null,
    {
      timeout: 5000,
    },
  );

  await page.reload();
  await expect(page.getByRole('button', { name: 'OPEN', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'OPEN', exact: true }).click();
  await page.waitForSelector('.cm-editor');
  await expect(page.locator('.cm-content')).toContainText('Compra semanal');
  await expect(page.locator('.tab-bar__tab').first()).toHaveText('Compra');
});
