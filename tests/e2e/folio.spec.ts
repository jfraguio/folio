import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __fsRead: (name: string) => string | undefined;
    /** Si está, las escrituras fallan con ese error (`NotAllowedError`, `Error`…). */
    __fsFail?: string;
    /** Nombre que «elige» el usuario en el próximo diálogo de guardar. */
    __nextSaveName?: string;
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
          if (window.__fsFail) {
            const name = window.__fsFail;
            return Promise.reject(name === 'Error' ? new Error('fallo') : new DOMException('fallo', name));
          }
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
      const name = window.__nextSaveName || (opts && opts.suggestedName) || 'folio.txt';
      window.__nextSaveName = undefined;
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

/** Contenido de un archivo de folio con una única tab. */
const fileWith = (body: string) => `[todo:tab 1]\n${body}`;

/** Abre un archivo nuevo y espera al editor. */
async function createFile(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'NEW', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'NEW', exact: true }).click();
  await page.waitForSelector('.cm-editor');
}

/** Pulsa la fila del menú abierto con esa etiqueta exacta (teclado, sin depender del hover). */
async function pickMenuItem(page: Page, label: string): Promise<void> {
  const labels = await page.locator('.panel__item .panel__label').allTextContents();
  const activeIdx = await page
    .locator('.panel__item')
    .evaluateAll((els) => els.findIndex((e) => e.classList.contains('panel__item--active')));
  const idx = labels.indexOf(label);
  expect(idx, `el menú no ofrece «${label}»`).toBeGreaterThanOrEqual(0);
  for (let i = activeIdx; i < idx; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

/** Ejecuta una opción del menú por su etiqueta exacta; si no está a la vista, la busca en «Más…». */
async function runMenu(page: Page, label: string): Promise<void> {
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  const labels = await page.locator('.panel__item .panel__label').allTextContents();
  if (!labels.includes(label) && labels.includes('Más…')) {
    await pickMenuItem(page, 'Más…');
    await expect(page.locator('.panel__item .panel__label', { hasText: 'Más…' })).toHaveCount(0);
  }
  await pickMenuItem(page, label);
  await page.waitForTimeout(100);
}

/** Abre el menú, despliega «Más…» si está y devuelve todas las etiquetas (el menú queda abierto). */
async function allMenuLabels(page: Page): Promise<string[]> {
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  const labels = await page.locator('.panel__item .panel__label').allTextContents();
  if (!labels.includes('Más…')) return labels;
  await pickMenuItem(page, 'Más…');
  await expect(page.locator('.panel__item .panel__label', { hasText: 'Más…' })).toHaveCount(0);
  return page.locator('.panel__item .panel__label').allTextContents();
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

  let labels = await allMenuLabels(page);
  expect(labels).toContain('Diccionario');
  expect(labels.some((l) => l.startsWith('Añadir «'))).toBe(true);
  await page.keyboard.press('Escape');

  // Sin corrector no se ofrecen «Diccionario» ni «Añadir … al diccionario».
  await runMenu(page, 'Desactivar corrector');
  labels = await allMenuLabels(page);
  expect(labels).not.toContain('Diccionario');
  expect(labels.some((l) => l.startsWith('Añadir «'))).toBe(false);
  await page.keyboard.press('Escape');

  await runMenu(page, 'Activar corrector');
  labels = await allMenuLabels(page);
  expect(labels).toContain('Diccionario');
  await page.keyboard.press('Escape');
});

test('las opciones secundarias quedan detrás de «Más…»', async ({ page }) => {
  await page.goto('/');
  await createFile(page);

  const secondary = [
    'Títulos',
    'Desactivar corrector',
    'Diccionario',
    'Crear pestaña',
    'Crear subpestaña',
    'Historial',
    'Instrucciones',
  ];
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  let labels = await page.locator('.panel__item .panel__label').allTextContents();
  for (const l of secondary) expect(labels).not.toContain(l);
  expect(labels).not.toContain('Desencriptar pestaña');
  expect(labels.at(-1)).toBe('Más…');

  // «Más…» no cierra el menú: sustituye su fila por las secundarias y activa la primera.
  await pickMenuItem(page, 'Más…');
  labels = await page.locator('.panel__item .panel__label').allTextContents();
  expect(labels).not.toContain('Más…');
  for (const l of secondary) expect(labels).toContain(l);
  // Con la tab vacía no hay nada que exportar ni bloques que encriptar.
  expect(labels).not.toContain('Exportar pestaña');
  expect(labels).not.toContain('Encriptar pestaña');
  await expect(page.locator('.panel__item--active .panel__label')).toHaveText('Títulos');
  await page.keyboard.press('Escape');

  // Al volver a abrirlo, vuelven a estar ocultas.
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  labels = await page.locator('.panel__item .panel__label').allTextContents();
  expect(labels).not.toContain('Historial');
  await page.keyboard.press('Escape');
});

test('«Títulos» lista los títulos de la tab y lleva hasta el elegido', async ({ page }) => {
  await page.goto('/');
  await createFile(page);

  // Sin títulos, la lista lo dice.
  await runMenu(page, 'Títulos');
  await expect(page.locator('.panel__empty')).toHaveText('Esta pestaña no tiene títulos');
  await page.keyboard.press('Escape');

  const filler = (tag: string) => Array.from({ length: 60 }, (_, i) => `${tag} ${i + 1}`).join('\n');
  await page.locator('.cm-content').click();
  await page.keyboard.insertText(
    ['# Lunes', filler('a'), '## **Martes**', filler('b'), '# Lunes', filler('c')].join('\n'),
  );

  await runMenu(page, 'Títulos');
  // Mismo aspecto que el menú, sin las marcas; los repetidos se distinguen a la derecha.
  await expect(page.locator('.panel__item .panel__label')).toHaveText(['Lunes', 'Martes', 'Lunes']);
  await expect(page.locator('.panel__item').nth(0).locator('.panel__meta')).toHaveText('1 de 2');
  await expect(page.locator('.panel__item').nth(1).locator('.panel__meta')).toHaveCount(0);
  await expect(page.locator('.panel__item').nth(2).locator('.panel__meta')).toHaveText('2 de 2');

  // El segundo «Lunes» queda arriba, justo bajo la barra de tabs, con el cursor en él.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('.overlay')).toHaveCount(0);
  const placement = async () =>
    page.evaluate(() => {
      const bar = document.querySelector('.tab-bar')!.getBoundingClientRect().bottom;
      const lines = [...document.querySelectorAll('.cm-line')];
      // Las dos líneas «# Lunes»: la primera está ya fuera de la vista (o sin pintar).
      const second = lines.filter((l) => l.textContent === '# Lunes').at(-1)!;
      const prev = second.previousElementSibling?.textContent;
      return { offset: second.getBoundingClientRect().top - bar, prev };
    });
  await expect.poll(async () => (await placement()).offset).toBeGreaterThanOrEqual(0);
  const { offset, prev } = await placement();
  expect(offset).toBeLessThan(30);
  expect(prev).toBe('b 60');
  // El cursor está en esa línea: lo que se escribe entra al principio del título.
  await page.keyboard.insertText('X');
  await expect(page.locator('.cm-line', { hasText: 'X# Lunes' })).toHaveCount(1);
});

test('pasar del menú a «Títulos» no hace parpadear el velo', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  await pickMenuItem(page, 'Más…');
  // La entrada del propio menú (fundido desde transparente) ya ha terminado.
  await page.waitForFunction(() => document.querySelector('.overlay')?.getAnimations().length === 0);

  // Un registro por frame (velos en el DOM y la menor opacidad pintada), hasta un rato después
  // de que aparezca la lista de títulos.
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[][]; __done: boolean };
    w.__frames = [];
    let after = 0;
    const sample = () => {
      const overlays = [...document.querySelectorAll<HTMLElement>('.overlay')];
      const opacity = overlays.length ? Math.min(...overlays.map((o) => Number(getComputedStyle(o).opacity))) : 0;
      w.__frames.push([overlays.length, opacity]);
      if (document.querySelector('.panel__empty')) after++;
      if (after < 15 && w.__frames.length < 600) requestAnimationFrame(sample);
      else w.__done = true;
    };
    requestAnimationFrame(sample);
  });
  // Que el registro ya esté en marcha antes del cambio.
  await page.waitForFunction(() => (window as unknown as { __frames: number[][] }).__frames.length >= 3);
  await pickMenuItem(page, 'Títulos');
  await expect(page.locator('.panel__empty')).toHaveText('Esta pestaña no tiene títulos');
  await page.waitForFunction(() => (window as unknown as { __done: boolean }).__done);

  const frames = await page.evaluate(() => (window as unknown as { __frames: number[][] }).__frames);
  // En todos los frames, un único velo y opaco: ni un frame sin él ni una entrada desde transparente.
  expect(frames.length).toBeGreaterThanOrEqual(18);
  for (const f of frames) expect(f).toEqual([1, 1]);
  await expect(page.locator('.overlay')).toHaveClass(/overlay--instant/);
});

test('«Exportar pestaña» descarga la tab abierta como texto plano', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.insertText(
    [
      '# Compra semanal',
      '-- **Leche**',
      'Pan *integral*',
      '> ver [la tienda](https://tienda.example)',
      '---',
      'fin',
    ].join('\n'),
  );

  const downloading = page.waitForEvent('download');
  await runMenu(page, 'Exportar pestaña');
  const file = await downloading;
  expect(file.suggestedFilename()).toBe('Compra.txt');
  const { readFile } = await import('node:fs/promises');
  const text = await readFile((await file.path())!, 'utf8');
  expect(text).toBe(
    ['Compra semanal', 'Leche', 'Pan integral', 'ver la tienda (https://tienda.example)', '', 'fin'].join('\n'),
  );
});

test('«Instrucciones» abre un panel con las convenciones y los atajos', async ({ page }) => {
  await page.goto('/');
  await createFile(page);

  await runMenu(page, 'Instrucciones');
  const panel = page.locator('.panel');
  await expect(panel.locator('.panel__header')).toHaveText('Instrucciones');
  await expect(panel.locator('.help__title')).toHaveText([
    'Escribir',
    'Pestañas',
    'Bloques cifrados',
    'Atajos',
    'Zen',
    'Historial',
  ]);
  await expect(panel.locator('.help__sample--heading')).toHaveText('# Semana');
  await expect(panel.locator('.help__code')).toContainText('<secret:contraseña>');
  await expect(panel.locator('.help__code')).toContainText('</secret:contraseña>');
  // Los atajos salen de la tabla real: ⌘ en Mac, Ctrl en el resto.
  await expect(panel.locator('.help__key', { hasText: Mod === 'Meta' ? '⌘K' : 'Ctrl+K' })).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('.panel')).toHaveCount(0);
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

  /**
   * Selecciona la línea `n` entera: clic en ella, End y Shift+Home. No usa ⌘/Ctrl+↑: en CodeMirror
   * solo es «inicio del documento» en Mac; en Linux no tiene binding y sube una línea conservando la
   * columna, con lo que la selección empezaría a mitad del enlace.
   */
  const selectLine = async (n: number) => {
    await page.locator('.cm-line').nth(n).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Home');
  };

  // Copiar la línea del enlace: texto plano con la sintaxis (para pegar en folio) y HTML con el enlace.
  await selectLine(0);
  await page.keyboard.press(`${Mod}+c`);
  let clip = await clipboard();
  expect(clip['text/plain']).toBe('Mira [esta web](https://example.com) hoy');
  expect(clip['text/html']).toContain('Mira <a href="https://example.com/">esta web</a> hoy');

  // Sin enlaces, el portapapeles queda como siempre: solo texto plano.
  await selectLine(1);
  await page.keyboard.press(`${Mod}+c`);
  clip = await clipboard();
  expect(clip).toEqual({ 'text/plain': 'Sin enlaces' });

  // Cortar: mismo contenido, el texto desaparece y ⌘Z lo devuelve.
  await selectLine(0);
  await page.keyboard.press(`${Mod}+x`);
  clip = await clipboard();
  expect(clip['text/plain']).toBe('Mira [esta web](https://example.com) hoy');
  expect(clip['text/html']).toContain('Mira <a href="https://example.com/">esta web</a> hoy');
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

/** Cambia el archivo del "disco" desde fuera de folio (otro dispositivo, Google Drive…). */
async function touchDisk(page: Page, change: { content?: string }): Promise<void> {
  await page.evaluate((c) => {
    const s = new Map<string, { content: string; lastModified: number }>(
      JSON.parse(localStorage.getItem('__fs') || '[]'),
    );
    const e = s.get('folio.txt')!;
    s.set('folio.txt', { content: c.content ?? e.content, lastModified: e.lastModified + 60_000 });
    localStorage.setItem('__fs', JSON.stringify([...s]));
  }, change);
  // Al recuperar el foco, folio comprueba el mtime de inmediato (sin esperar los 10 s del sondeo).
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}

async function waitSaved(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('.status-dot')?.getAttribute('data-state') === 'saved',
    null,
    {
      timeout: 5000,
    },
  );
}

test('un mtime nuevo con el mismo contenido (Google Drive) no avisa ni recarga', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra semanal');
  await waitSaved(page);

  await touchDisk(page, {});
  await page.waitForTimeout(300);
  await expect(page.locator('.notice--visible')).toHaveCount(0);
  await expect(page.locator('.cm-content')).toHaveText('Compra semanal');

  // También con cambios locales aún sin guardar: no se pierden y se escriben.
  await page.keyboard.type(' y fruta');
  await touchDisk(page, {});
  await page.waitForTimeout(300);
  await expect(page.locator('.notice--visible')).toHaveCount(0);
  await waitSaved(page);
  expect(await page.evaluate(() => window.__fsRead('folio.txt'))).toContain('Compra semanal y fruta');
});

test('un cambio externo real del contenido se carga y avisa', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra semanal');
  await waitSaved(page);

  await touchDisk(page, { content: '[todo:tab 1]\nDesde otro equipo' });
  await expect(page.locator('.notice--visible')).toContainText('El archivo cambió en otro dispositivo');
  await expect(page.locator('.cm-content')).toHaveText('Desde otro equipo');
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

/** Estado del punto de estado. */
const dotState = (page: Page) => page.locator('.status-dot').getAttribute('data-state');

test('borrador vivo: lo que no llegó al archivo se recupera al reabrir', async ({ page }) => {
  page.on('dialog', (d) => void d.accept()); // «¿Salir del sitio?» al recargar con cambios sin guardar
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra semanal');
  await waitSaved(page);

  // El disco deja de aceptar escrituras: lo nuevo solo queda en el borrador.
  await page.evaluate(() => (window.__fsFail = 'Error'));
  await page.keyboard.type(' y fruta');
  await expect.poll(() => dotState(page), { timeout: 6000 }).toBe('error');
  await page.reload();

  await page.getByRole('button', { name: 'OPEN', exact: true }).click();
  await expect(page.locator('.panel__body')).toContainText('Hay cambios sin guardar');
  await page.getByRole('button', { name: 'Recuperar' }).click();
  await expect(page.locator('.cm-content')).toHaveText('Compra semanal y fruta');
  // Y se escribe en el archivo.
  await waitSaved(page);
  expect(await page.evaluate(() => window.__fsRead('folio.txt'))).toBe('[todo:tab 1]\nCompra semanal y fruta');

  // Ya guardado, al reabrir no se vuelve a ofrecer.
  await page.reload();
  await page.getByRole('button', { name: 'OPEN', exact: true }).click();
  await page.waitForSelector('.cm-editor');
  await expect(page.locator('.cm-content')).toHaveText('Compra semanal y fruta');
  await expect(page.locator('.overlay')).toHaveCount(0);
});

test('abrir un archivo de texto plano no lo reescribe hasta que se edita', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      '__fs',
      JSON.stringify([['notas.txt', { content: 'Texto plano\r\nsin marcadores\n', lastModified: 1000 }]]),
    ),
  );
  await page.getByRole('button', { name: 'OPEN', exact: true }).click();
  await page.waitForSelector('.cm-editor');
  await expect(page.locator('.cm-content')).toContainText('sin marcadores');

  // ⌘S y pasar a segundo plano guardan «lo pendiente»: no hay nada, el archivo queda intacto.
  await page.keyboard.press(`${Mod}+s`);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__fsRead('notas.txt'))).toBe('Texto plano\r\nsin marcadores\n');

  // Al editar, se escribe ya en el formato de folio (saltos \n, marcador y sin saltos finales).
  await page.locator('.cm-content').click();
  await page.keyboard.press(`${Mod}+End`);
  await page.keyboard.press('Backspace'); // la línea vacía final
  await page.keyboard.type(' (editado)');
  await page.keyboard.press(`${Mod}+s`);
  await expect
    .poll(() => page.evaluate(() => window.__fsRead('notas.txt')))
    .toBe('[todo:tab 1]\nTexto plano\nsin marcadores (editado)');
});

test('sin permiso de escritura, «Guardar en otro archivo…» lleva el texto a un archivo nuevo y lo abre', async ({
  page,
}) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra semanal');
  await waitSaved(page);

  await page.evaluate(() => (window.__fsFail = 'NotAllowedError'));
  await page.keyboard.type(' y fruta');
  await expect(page.locator('.notice--visible')).toContainText('folio perdió el permiso de escritura', {
    timeout: 6000,
  });
  expect(await dotState(page)).toBe('error');

  // Sin error no se ofrece; con él, sí (junto a «Reintentar guardado»).
  const labels = await allMenuLabels(page);
  expect(labels).toContain('Reintentar guardado');
  expect(labels).toContain('Guardar en otro archivo…');
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    window.__fsFail = undefined;
    window.__nextSaveName = 'rescate.txt';
  });
  await runMenu(page, 'Guardar en otro archivo…');
  await expect(page.locator('.notice--visible')).toContainText('Guardado en rescate.txt');
  expect(await page.evaluate(() => window.__fsRead('rescate.txt'))).toBe('[todo:tab 1]\nCompra semanal y fruta');
  // El archivo nuevo queda abierto: lo siguiente se escribe en él, no en el anterior.
  await expect(page.locator('.cm-content')).toHaveText('Compra semanal y fruta');
  await expect.poll(() => page.locator('.brand').getAttribute('title')).toContain('rescate.txt');
  await page.locator('.cm-content').click();
  await page.keyboard.press(`${Mod}+End`);
  await page.keyboard.type('!');
  await page.keyboard.press(`${Mod}+s`);
  await expect
    .poll(() => page.evaluate(() => window.__fsRead('rescate.txt')))
    .toBe('[todo:tab 1]\nCompra semanal y fruta!');
  expect(await page.evaluate(() => window.__fsRead('folio.txt'))).toBe('[todo:tab 1]\nCompra semanal');
  const after = await allMenuLabels(page);
  expect(after).not.toContain('Guardar en otro archivo…');
});

test('pegar una URL sobre el texto de un enlace le cambia la URL', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'portapapeles');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.insertText('ver [la web](https://viejo.example) hoy');
  await waitSaved(page);
  // Seleccionar «web» dentro del enlace (el texto visible es «ver la web hoy»).
  await page.evaluate(() => navigator.clipboard.writeText('https://nuevo.example'));
  await page.keyboard.press(`${Mod}+Home`);
  for (let i = 0; i < 'ver la '.length; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 'web'.length; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press(`${Mod}+v`);
  await page.keyboard.press(`${Mod}+s`);
  await expect
    .poll(() => page.evaluate(() => window.__fsRead('folio.txt')))
    .toBe('[todo:tab 1]\nver [la web](https://nuevo.example) hoy');
});

test('los avisos se ven por encima de un panel abierto', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra semanal');
  await waitSaved(page);
  await runMenu(page, 'Historial');
  await page.getByRole('button', { name: 'Guardar versión' }).click();
  const notice = page.locator('.notice--visible');
  await expect(notice).toHaveText(/Versión guardada\.|Sin cambios desde la última versión\./);
  const [noticeZ, overlayZ] = await page.evaluate(() => [
    Number(getComputedStyle(document.querySelector('.notice')!).zIndex),
    Number(getComputedStyle(document.querySelector('.overlay')!).zIndex),
  ]);
  expect(noticeZ).toBeGreaterThan(overlayZ);
  // Y no roba los clics de lo que tiene debajo.
  expect(await notice.evaluate((n) => getComputedStyle(n).pointerEvents)).toBe('none');
});

test.describe('zen con pantalla táctil', () => {
  test.use({ hasTouch: true });

  test('un toque en el margen no enfoca el editor (no abre el teclado); un clic con ratón, sí', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('todo.zen', 'true'));
    await page.goto('/');
    await createFile(page);
    await page.locator('.cm-content').click();
    await page.keyboard.type('Compra semanal');
    const editorFocused = () => page.evaluate(() => !!document.activeElement?.closest('.cm-editor'));
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(await editorFocused()).toBe(false);

    // Margen izquierdo de la columna centrada del zen.
    await page.touchscreen.tap(8, 300);
    await page.waitForTimeout(100);
    expect(await editorFocused()).toBe(false);

    await page.mouse.click(8, 300);
    await expect.poll(editorFocused).toBe(true);
  });
});

test('con «reducir movimiento» no hay fundidos, ni scroll suave, ni parpadeo del cursor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Compra');
  const styles = await page.evaluate(() => ({
    dot: getComputedStyle(document.querySelector('.status-dot')!, '::after').transitionDuration,
    // CodeMirror desactiva el parpadeo con una duración de 0.
    cursor: getComputedStyle(document.querySelector('.cm-cursorLayer')!).animationDuration,
  }));
  expect(styles.dot.split(',').every((d) => d.trim() === '0s')).toBe(true);
  expect(styles.cursor).toBe('0s');
  // Los avisos: basta con su regla de estilo (un nodo con su clase).
  await page.evaluate(() => {
    const n = document.createElement('div');
    n.className = 'notice';
    document.body.appendChild(n);
  });
  expect(
    await page
      .locator('.notice')
      .last()
      .evaluate((n) => getComputedStyle(n).transitionDuration),
  ).toBe('0s');
});

test('cifrar y descifrar varios bloques: guarda, reabre y conserva el texto exacto', async ({ page }) => {
  test.setTimeout(120_000);
  const plain = [
    'Pista visible.',
    '',
    '<secret:alfa>',
    'Contenido secreto uno: 🧪',
    '  con espacios',
    '</secret:alfa>',
    '',
    'Texto entre bloques.',
    '<secret:beta>Contenido secreto dos.</secret:beta>',
    'Final visible.',
  ].join('\n');
  await page.goto('/');
  await createFile(page);
  await page.locator('.cm-content').click();
  await page.keyboard.insertText(plain);
  await waitSaved(page);

  // Con marcas pendientes, Encriptar está en el primer nivel; Desencriptar no aparece.
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  let labels = await page.locator('.panel__item .panel__label').allTextContents();
  expect(labels).toContain('Encriptar pestaña');
  expect(labels).not.toContain('Desencriptar pestaña');
  await page.keyboard.press('Escape');

  await runMenu(page, 'Encriptar pestaña');
  await expect(page.locator('.notice--visible')).toHaveText('Pestaña encriptada.');
  await expect(page.locator('.cm-content')).toContainText('<folio-secret:v1:');
  await expect(page.locator('.cm-content')).not.toContainText('Contenido secreto uno');
  await expect(page.locator('.cm-content')).not.toContainText('Contenido secreto dos');
  await waitSaved(page);

  // Ya cifrada: Desencriptar está en el primer nivel y Encriptar desaparece al no quedar pendientes.
  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  labels = await page.locator('.panel__item .panel__label').allTextContents();
  expect(labels).toContain('Desencriptar pestaña');
  expect(labels).not.toContain('Encriptar pestaña');
  await page.keyboard.press('Escape');

  const encryptedDisk = await page.evaluate(() => window.__fsRead('folio.txt'));
  expect(encryptedDisk).toContain('Pista visible.');
  expect(encryptedDisk).toContain('Texto entre bloques.');
  expect(encryptedDisk).toContain('Final visible.');
  expect(encryptedDisk).toContain('<folio-secret:v1:pbkdf2-hmac-sha256:600000:aes-256-gcm:');
  expect(encryptedDisk).not.toContain('Contenido secreto');
  expect(encryptedDisk).not.toContain('alfa');
  expect(encryptedDisk).not.toContain('beta');

  // Cerrar y reabrir: los bloques siguen ahí y se pueden descifrar.
  await page.reload();
  await page.getByRole('button', { name: 'OPEN', exact: true }).click();
  await page.waitForSelector('.cm-editor');
  await expect(page.locator('.cm-content')).toContainText('<folio-secret:v1:');

  await runMenu(page, 'Desencriptar pestaña');
  await expect(page.locator('.panel__header')).toHaveText('Desencriptar pestaña');
  await expect(page.locator('.panel__body p')).toHaveCount(0);
  await expect(page.locator('.secret-input')).toHaveAttribute('placeholder', 'Contraseña');
  await page.getByLabel('Contraseña').fill('alfa');
  await page.getByRole('button', { name: 'Desencriptar' }).click();
  await expect(page.locator('.cm-content')).toContainText('Contenido secreto uno');
  await expect(page.locator('.cm-content')).not.toContainText('Contenido secreto dos');
  await expect(page.locator('.cm-content')).toContainText('<folio-secret:v1:');
  await expect(page.locator('.notice--visible')).toHaveText(
    '1 bloque se ha descifrado. 1 bloque no se ha podido descifrar.',
  );
  await waitSaved(page);
  expect(await page.evaluate(() => window.__fsRead('folio.txt'))).toContain('<secret:alfa>');

  await runMenu(page, 'Desencriptar pestaña');
  await page.getByLabel('Contraseña').fill('beta');
  await page.getByRole('button', { name: 'Desencriptar' }).click();
  await expect(page.locator('.cm-content')).not.toContainText('<folio-secret:v1:');
  await expect(page.locator('.cm-content')).toContainText('Contenido secreto dos');
  await waitSaved(page);
  // El contenido restaurado es exactamente el original, incluida la contraseña en las marcas.
  expect(await page.evaluate(() => window.__fsRead('folio.txt'))).toBe(fileWith(plain));

  await page.keyboard.press(`${Mod}+k`);
  await page.waitForSelector('.panel__item');
  labels = await page.locator('.panel__item .panel__label').allTextContents();
  expect(labels).not.toContain('Desencriptar pestaña');
  expect(labels).toContain('Encriptar pestaña');
  await page.keyboard.press('Escape');
});

test('desencriptar con éxito no muestra ningún aviso', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  const plain = '<secret:clave>\nContenido recuperado.\n</secret:clave>';
  await page.locator('.cm-content').click();
  await page.keyboard.insertText(plain);
  await waitSaved(page);

  await runMenu(page, 'Encriptar pestaña');
  await expect(page.locator('.cm-content')).toContainText('<folio-secret:v1:');
  await waitSaved(page);
  // Deja desaparecer el aviso del cifrado antes de comprobar el del descifrado.
  await expect(page.locator('.notice--visible')).toHaveCount(0, { timeout: 5000 });

  await runMenu(page, 'Desencriptar pestaña');
  await page.getByLabel('Contraseña').fill('clave');
  await page.getByRole('button', { name: 'Desencriptar' }).click();
  await expect(page.locator('.cm-content')).toContainText('Contenido recuperado.');
  await expect(page.locator('.notice--visible')).toHaveCount(0);
});

test('las marcas incorrectas no ofrecen Encriptar ni modifican la pestaña', async ({ page }) => {
  await page.goto('/');
  await createFile(page);
  const original = 'Texto visible.\n<secret:>\nEste bloque no tiene contraseña.\n</secret:>\nFinal.';
  await page.locator('.cm-content').click();
  await page.keyboard.insertText(original);
  await waitSaved(page);

  const labels = await allMenuLabels(page);
  expect(labels).not.toContain('Encriptar pestaña');
  expect(labels).not.toContain('Desencriptar pestaña');
  await page.keyboard.press('Escape');
  await expect(page.locator('.cm-content')).toContainText('Este bloque no tiene contraseña.');
  expect(await page.evaluate(() => window.__fsRead('folio.txt'))).toBe(fileWith(original));
});
