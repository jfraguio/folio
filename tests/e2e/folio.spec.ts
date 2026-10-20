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

test('modo zen: contador de palabras abajo a la izquierda, alineado con los iconos', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('# Encabezado\nuna dos tres');
  const counter = page.locator('.word-count');
  await expect(counter).toBeHidden(); // fuera de zen no se ve

  await runMenu(page, 'Modo zen');
  await expect(counter).toBeVisible();
  await expect(counter).toHaveText('3'); // el encabezado no cuenta
  await page.keyboard.type(' cuatro');
  await expect(counter).toHaveText('4');

  const box = await counter.boundingBox();
  const dot = await page.locator('.status-dot').boundingBox();
  expect(box!.x).toBeLessThan(100);
  expect(box!.y + box!.height / 2).toBeCloseTo(dot!.y + dot!.height / 2, 0);
  const style = (sel: string) =>
    page.locator(sel).evaluate((e) => {
      const cs = getComputedStyle(e);
      return [cs.fontSize, cs.color, cs.opacity];
    });
  expect(await style('.word-count')).toEqual(await style('.brand'));

  await runMenu(page, 'Desactivar modo zen');
  await expect(counter).toBeHidden();
});

test('enlaces [texto](url): siempre plegados, URL en el title, protegidos y creados al pegar una URL', async ({
  page,
}) => {
  await page.goto('/');
  await createFile(page);
  const line = page.locator('.cm-line');
  await page.locator('.cm-content').click();
  await page.keyboard.type('Mira [esta web](https://example.com) hoy\nOtra palabra');

  // Solo se ve el texto, como enlace; el destino va en el title.
  await expect(line.first()).toHaveText('Mira esta web hoy');
  const link = page.locator('.cm-link').first();
  await expect(link).toHaveText('esta web');
  await expect(link).toHaveAttribute('title', 'https://example.com');

  // Con el cursor dentro sigue plegado.
  await link.click();
  await expect(line.first()).toHaveText('Mira esta web hoy');

  // Retroceso justo detrás del enlace borra la última letra de su texto, no la sintaxis.
  await line.first().click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 'Mira esta web'.length; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Backspace');
  await expect(line.first()).toHaveText('Mira esta we hoy');
  await page.waitForFunction(() => window.__fsRead('folio.txt')?.includes('[esta we](https://example.com)'), null, {
    timeout: 5000,
  });
  await page.keyboard.type('b');

  // ⌘/Ctrl+clic abre el destino.
  const [popup] = await Promise.all([
    page.context().waitForEvent('page'),
    page
      .locator('.cm-link')
      .first()
      .click({ modifiers: [Mod] }),
  ]);
  expect(popup.url()).toContain('example.com');
  await popup.close();

  // Pegar una URL sobre «palabra» la convierte en enlace (plegado: el cursor queda detrás).
  await line.nth(1).click();
  await page.keyboard.press('End');
  for (let i = 0; i < 'palabra'.length; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'https://folio.example/p');
    document
      .querySelector('.cm-content')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(line.nth(1)).toHaveText('Otra palabra');
  await expect(line.nth(1).locator('.cm-link')).toHaveText('palabra');
  await page.waitForFunction(() => window.__fsRead('folio.txt')?.includes('[palabra](https://folio.example/p)'), null, {
    timeout: 5000,
  });
});

test('copiar y cortar un enlace deja también HTML con <a href> (Teams, Outlook…)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Mira [esta web](https://example.com) hoy\nSin enlaces');

  /** Formatos del portapapeles del sistema y su contenido. */
  const clipboard = () =>
    page.evaluate(async () => {
      const out: Record<string, string> = {};
      for (const item of await navigator.clipboard.read())
        for (const type of item.types) out[type] = await (await item.getType(type)).text();
      return out;
    });

  // Copiar la línea del enlace: texto plano con la sintaxis (para pegar en folio) y HTML con el enlace.
  await page.keyboard.press(`${Mod}+ArrowUp`);
  await page.keyboard.press('Shift+End');
  await page.keyboard.press(`${Mod}+c`);
  let clip = await clipboard();
  expect(clip['text/plain']).toBe('Mira [esta web](https://example.com) hoy');
  expect(clip['text/html']).toContain('Mira <a href="https://example.com/">esta web</a> hoy');

  // Sin enlaces, el portapapeles queda como siempre: solo texto plano.
  await page.locator('.cm-line').nth(1).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press(`${Mod}+c`);
  clip = await clipboard();
  expect(clip).toEqual({ 'text/plain': 'Sin enlaces' });

  // Cortar: mismo contenido, el texto desaparece y ⌘Z lo devuelve.
  await page.keyboard.press(`${Mod}+ArrowUp`);
  await page.keyboard.press('Shift+End');
  await page.keyboard.press(`${Mod}+x`);
  clip = await clipboard();
  expect(clip['text/html']).toContain('<a href="https://example.com/">esta web</a>');
  await expect(page.locator('.cm-line').first()).toHaveText('');
  await page.keyboard.press(`${Mod}+z`);
  await expect(page.locator('.cm-line').first()).toHaveText('Mira esta web hoy');
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
