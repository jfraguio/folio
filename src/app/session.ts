import { EditorView } from '@codemirror/view';
import type { FileAdapter, TodoFile } from '../fs/FileAdapter';
import { FsAccessAdapter } from '../fs/FsAccessAdapter';
import { download } from '../fs/FallbackAdapter';
import { createEditor } from '../editor/createEditor';
import { spellcheck, spellCompartment, wordAt } from '../editor/spellcheck';
import { countDone } from '../editor/strikethrough';
import { Autosave } from '../persistence/autosave';
import { FileWatcher } from '../persistence/fileWatcher';
import { LiveDraft } from '../persistence/liveDraft';
import { VersionHistory } from '../persistence/backups';
import { resolveTodoId } from '../persistence/files';
import { acquireTodoLock } from '../persistence/locks';
import { PersonalDictionary } from '../persistence/dictionary';
import { joinDocument, splitDocument, TAB_COUNT } from '../persistence/todoBlocks';
import { prefs, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../persistence/prefs';
import { requestPersistentStorage } from '../persistence/db';
import { SpellService } from '../spell/SpellService';
import { CommandRegistry, labelOf } from './commands';
import { installShortcuts, shortcutFor } from './shortcuts';
import { SaveStatus, StatusDot } from '../ui/StatusDot';
import { createMenuButton } from '../ui/MenuButton';
import { TabBar } from '../ui/TabBar';
import { notice } from '../ui/Notice';
import { openMenu, closeOverlay, isOverlayOpen } from '../ui/Menu';
import { openDialog } from '../ui/Dialog';
import { openDictionaryManager } from '../ui/DictionaryManager';
import { openHistory } from '../ui/History';
import { el, formatDateTime, relativeTime } from '../ui/el';

export interface SessionOptions {
  root: HTMLElement;
  adapter: FileAdapter;
  file: TodoFile;
  onExit: () => void;
}

/** Sesión de edición viva. `close()` guarda lo pendiente y libera todos los recursos (incluido el bloqueo). */
export interface Session {
  close(): Promise<void>;
}

/**
 * Abre un archivo. Devuelve `null` si el usuario decide no abrirlo (p. ej. está en otra pestaña
 * y prefiere volver); en ese caso ya se ha llamado a `onExit`.
 */
export async function startSession(o: SessionOptions): Promise<Session | null> {
  const { adapter, root } = o;
  let file = o.file;
  const degraded = !adapter.capabilities.directWrite;

  // 1. Leer y normalizar. `raw` es el archivo tal cual (con el bloque del diccionario, si lo hay).
  let { text: raw, mtime } = await adapter.read(file);
  /** Texto que hay realmente en el disco; `raw` puede pasar a ser el borrador recuperado. */
  const diskText = raw;

  // 2. Identidad, almacenamiento persistente y bloqueo.
  const todoId = await resolveTodoId(file);
  void requestPersistentStorage();
  const lock = await acquireTodoLock(todoId);
  if (!lock.acquired) {
    const takeover = await new Promise<boolean>((resolve) =>
      openDialog(
        ['Este archivo ya está abierto en otra pestaña.'],
        [
          { label: 'Volver', quiet: true, onClick: () => resolve(false) },
          { label: 'Editar aquí', primary: true, onClick: () => resolve(true) },
        ],
      ),
    );
    if (!takeover) {
      lock.release();
      o.onExit();
      return null;
    }
    const result = await lock.requestTakeover();
    if (result === 'refused') {
      lock.release();
      notice('La otra pestaña tiene cambios que aún no ha podido guardar. Resuélvelo allí antes de abrir el archivo aquí.', 8000);
      o.onExit();
      return null;
    }
    // Sin respuesta: la otra pestaña está congelada, descartada o colgada. El bloqueo es una
    // salvaguarda, no una barrera: el usuario ya ha pedido editar aquí y se le deja.
    if (result === 'no-response') {
      notice('La otra pestaña no responde. Se abre aquí; si allí sigue abierto, prevalecerá lo último que se guarde.', 8000);
    }
  }

  // A partir de aquí el bloqueo es nuestro (o lo hemos asumido): cualquier fallo debe soltarlo,
  // o el archivo quedaría bloqueado para esta pestaña hasta recargar.
  const disposers: Array<() => void> = [];
  const teardown = () => {
    while (disposers.length) {
      try {
        disposers.pop()!();
      } catch (e) {
        console.error(e);
      }
    }
  };
  disposers.push(() => lock.release());

  try {
    // 3. Historial: versión de apertura (lo que hay en el disco, antes de cualquier recuperación) si
    // hace más de una hora de la última, y una cada hora mientras la sesión siga abierta.
    // Nunca bloquea la apertura: si IndexedDB falla, simplemente no hay versión.
    const history = new VersionHistory(todoId, () => getText());
    disposers.push(() => history.dispose());
    const backupReady = degraded ? Promise.resolve() : history.saveIfDue(diskText).then(() => {});
    if (!degraded) history.start();

    // 4. Comprobación de borrador vivo (guarda el texto completo, diccionario incluido).
    const liveDraft = new LiveDraft(todoId);
    const draft = await LiveDraft.read(todoId);
    let recovered = false;
    if (draft && draft.ts > mtime && draft.text !== raw) {
      recovered = await new Promise<boolean>((resolve) =>
        openDialog(
          [`Hay cambios sin guardar de ${relativeTime(draft.ts)}. ¿Quieres recuperarlos?`],
          [
            { label: 'Descartar', quiet: true, onClick: () => resolve(false) },
            { label: 'Recuperar', primary: true, onClick: () => resolve(true) },
          ],
        ),
      );
      if (recovered) raw = draft.text;
      else void liveDraft.clear().catch(() => {}); // que no vuelva a preguntar en la próxima apertura
    }

    // Las tabs son el documento; el diccionario viaja al final del .md como comentario HTML.
    const { tabs, words } = splitDocument(raw);

    // 4. UI base.
    root.replaceChildren();
    const editorRoot = el('div', { class: 'editor-root' });
    root.appendChild(editorRoot);
    disposers.push(() => editorRoot.remove());

    const statusDot = new StatusDot((state) => {
      if (state === 'error') void commands.run('save.retry');
      else if (state === 'degraded') void commands.run('export.md');
      else void commands.run('menu');
    });
    // Estado del guardado: el punto de la esquina y cualquier otro indicador.
    const saveStatus = new SaveStatus((state, lastSaved) => statusDot.set(state, lastSaved));
    const menuButton = createMenuButton(() => void commands.run('menu'));
    // Esquina inferior derecha: punto de estado y, a su derecha, el botón de menú.
    const cornerRight = el('div', { class: 'corner-right' }, statusDot.root, menuButton);
    root.appendChild(cornerRight);
    disposers.push(() => {
      cornerRight.remove();
    });

    // 5. Servicios.
    const dictionary = new PersonalDictionary();
    dictionary.load(words);
    const spell = new SpellService();
    disposers.push(() => spell.dispose());
    const spellExt = spellcheck({ service: spell, dictionary });
    const commands = new CommandRegistry();

    // 6. Tabs y editor.
    let active = Math.min(Math.max(prefs.get('lastTab'), 0), TAB_COUNT - 1);
    /** `true` mientras se vuelca en el editor la versión del disco: ese cambio no es del usuario. */
    let syncingFromDisk = false;

    const tabBar = new TabBar({
      tabs,
      onSelect: (i) => switchTab(i),
    });
    root.appendChild(tabBar.root);
    disposers.push(() => tabBar.root.remove());

    const view = createEditor({
      parent: editorRoot,
      doc: tabs[active] ?? '',
      spell: prefs.get('spellEnabled') ? spellExt.extension : [],
      extra: [
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          tabs[active] = view.state.doc.toString();
          tabBar.render();
          refreshDone();
          if (!syncingFromDisk) markChanged();
        }),
      ],
    });
    disposers.push(() => view.destroy());

    /** Cambia la tab activa: guarda el contenido actual y carga el de la nueva. */
    function switchTab(i: number): void {
      if (i === active) {
        view.focus();
        return;
      }
      tabs[active] = view.state.doc.toString();
      active = i;
      prefs.set('lastTab', i);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: tabs[i] ?? '' },
        selection: { anchor: (tabs[i] ?? '').length },
      });
      tabBar.setActive(i);
      refreshDone();
      view.focus();
    }

    /** Texto que va al disco: las tabs más el bloque del diccionario (si tiene contenido). */
    const getText = () => {
      tabs[active] = view.state.doc.toString();
      return joinDocument({ tabs, words: dictionary.list() });
    };
    const markChanged = () => {
      liveDraft.schedule(getText());
      if (!degraded) autosave.markDirty();
      else saveStatus.set('degraded');
    };

    view.focus();
    // El cursor arranca al final de la tab activa.
    view.dispatch({ selection: { anchor: view.state.doc.length } });

    // 7. Autosave.
    const fsAdapter = adapter instanceof FsAccessAdapter ? adapter : null;
    const autosave: Autosave = new Autosave({
      getText,
      initialMtime: mtime,
      io: {
        mtime: (): Promise<number> => (fsAdapter ? fsAdapter.mtime(file) : Promise.resolve(autosave.lastKnownMtime)),
        write: async (t) => (await adapter.write(file, t)).mtime,
      },
      onState: (state, info) => {
        saveStatus.set(degraded ? 'degraded' : state, info.lastSaved);
        if (state === 'saved') void liveDraft.clear();
      },
      // Alguien guardó después que nosotros: se descarta lo local y se carga lo del disco.
      onNewerOnDisk: () => reloadFromDisk({ unlessSaving: false }),
      onError: (kind) => {
        if (kind === 'permission') notice('to-do perdió el permiso de escritura. Pulsa el punto de estado para recuperarlo.', 6000);
        else if (kind === 'not-found') notice('El archivo ya no está donde estaba. Pulsa el punto de estado para guardarlo en otro sitio.', 6000);
      },
    });
    disposers.push(() => autosave.dispose());
    if (degraded) saveStatus.set('degraded');
    // Lo "guardado" es lo que hay en el disco, no el borrador recuperado: así el primer flush
    // detecta la diferencia y lo escribe de verdad.
    else autosave.accept(mtime, diskText);
    if (recovered && !degraded) autosave.markDirty(); // el borrador recuperado debe escribirse
    dictionary.onChange(markChanged);

    // La marca «TO-DO» muestra al pasar el ratón el archivo abierto y la fecha de su última
    // modificación correcta en disco (el mtime devuelto por la última escritura que funcionó).
    // La File System Access API no expone la ruta completa del archivo, solo su nombre.
    const brand = document.querySelector<HTMLElement>('.brand');
    if (brand) {
      disposers.push(
        saveStatus.subscribe(() => {
          brand.title = `${file.name}\nÚltima modificación: ${formatDateTime(autosave.lastKnownMtime)}`;
        }),
      );
      disposers.push(() => brand.removeAttribute('title'));
    }

    // Contador de TO-DOs resueltos (líneas tachadas) de la tab abierta, en rojo junto a la marca.
    const doneCount = brand
      ? el('span', { class: 'done-count', attrs: { 'aria-label': 'TO-DOs resueltos' } })
      : null;
    if (brand && doneCount) brand.before(doneCount);
    if (doneCount) disposers.push(() => doneCount.remove());
    const refreshDone = () => {
      if (!doneCount) return;
      const n = countDone(view.state.doc.toString());
      doneCount.textContent = n > 0 ? String(n) : '';
    };
    refreshDone();

    // 8. Corrector.
    const loadSpell = async () => {
      try {
        await spell.load();
        await spell.addWords(dictionary.list());
      } catch (e) {
        notice('No se pudo cargar el diccionario ortográfico.');
        console.error(e);
      }
    };
    if (prefs.get('spellEnabled')) void loadSpell();

    const setSpellEnabled = (on: boolean) => {
      prefs.set('spellEnabled', on);
      view.dispatch({ effects: spellCompartment.reconfigure(on ? spellExt.extension : []) });
      if (on && !spell.ready) void loadSpell();
    };
    const rescanSpell = () => view.plugin(spellExt.plugin)?.rescan();
    /** Tras quitar palabras del diccionario: Hunspell no permite olvidarlas, así que se recarga. */
    const reloadSpell = () => {
      spell.dispose();
      if (prefs.get('spellEnabled')) void loadSpell().then(rescanSpell);
    };

    // 9. El disco manda si es más nuevo.
    //
    // Política de concurrencia (el archivo vive en una carpeta sincronizada con iCloud Drive y se
    // edita desde varios ordenadores): no hay diálogo de conflicto. Todo lo que se escribe en local
    // se guarda; pero si el disco tiene un `lastModified` posterior al de la versión cargada, la
    // versión del disco sustituye a la local (como mucho se pierden unos segundos de trabajo).
    // Se detecta en dos puntos: el sondeo de cambios externos (9b) y la propia escritura del
    // autosave, que comprueba el mtime justo antes de escribir y aborta si el disco es posterior.

    /** Sustituye el documento por lo que hay en el disco, conservando el cursor, y acepta su mtime. */
    const applyDiskVersion = (fresh: { text: string; mtime: number }) => {
      const split = splitDocument(fresh.text);
      const wordsBefore = dictionary.list().join('\n');
      tabs.splice(0, tabs.length, ...split.tabs);
      dictionary.load(split.words);
      const next = tabs[active] ?? '';
      const head = Math.min(view.state.selection.main.head, next.length);
      syncingFromDisk = true;
      try {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
          selection: { anchor: head },
        });
      } finally {
        syncingFromDisk = false;
      }
      tabBar.render();
      // Hunspell no permite olvidar palabras: si el diccionario personal cambió, se recarga entero.
      if (dictionary.list().join('\n') !== wordsBefore) reloadSpell();
      else rescanSpell();
      autosave.accept(fresh.mtime, fresh.text);
    };

    /**
     * Relee el archivo y lo vuelca en el editor. Lo usan el sondeo y el autosave.
     * Con `unlessSaving`, si durante la lectura arrancó una escritura propia se desiste: esa
     * escritura hace su propia comprobación de mtime y, si procede, recargará ella.
     */
    const reloadFromDisk = async ({ unlessSaving }: { unlessSaving: boolean }) => {
      const fresh = await adapter.read(file);
      if (unlessSaving && autosave.state === 'saving') return;
      applyDiskVersion(fresh);
      notice('El archivo cambió en otro dispositivo: se ha cargado la versión más reciente.');
    };

    // 9b. Cambios externos. Cada 10 s, y al recuperar el foco, se compara solo el `lastModified`
    // del disco con el de la versión cargada (`autosave.lastKnownMtime`, que ya se actualiza con
    // cada escritura propia). Únicamente si el del disco es posterior se relee y se vuelca.
    //
    // La única excepción es una escritura propia en vuelo: recargar en mitad de ella dejaría el
    // editor con una versión y el disco con otra, y el mtime de nuestra escritura ocultaría la
    // diferencia. Además esa escritura ya hace su propia comprobación. Se espera al siguiente ciclo.
    const watcher = new FileWatcher({
      mtime: () => (fsAdapter ? fsAdapter.mtime(file) : Promise.resolve(autosave.lastKnownMtime)),
      lastKnown: () => autosave.lastKnownMtime,
      canReload: () => autosave.state !== 'saving',
      onChange: () => reloadFromDisk({ unlessSaving: true }),
      onError: (e) => console.debug('[to-do] no se pudo comprobar el archivo', e),
    });
    disposers.push(() => watcher.dispose());
    if (fsAdapter) watcher.start();

    // 10. Comandos.
    const focusEditor = () => view.focus();

    const saveAs = async () => {
      const t = getText();
      const f = await adapter.saveAs(t, file.name || 'to-do.md');
      if (!f) return;
      file = f;
      if (!degraded) {
        const m = fsAdapter ? await fsAdapter.mtime(f) : Date.now();
        autosave.accept(m, t);
        notice(`Guardado en ${f.name}`);
      } else {
        notice('Descargado.');
      }
    };

    commands.register(
      {
        id: 'menu',
        label: 'Menú',
        run: () => {
          if (isOverlayOpen()) {
            closeOverlay();
            return;
          }
          const items = commands
            .visible()
            .filter((c) => c.id !== 'menu' && !c.id.startsWith('tab.'))
            .map((c) => ({ id: c.id, label: labelOf(c), meta: c.shortcut ?? shortcutFor(c.id), keywords: c.keywords }));
          openMenu(
            {
              items,
              onSelect: (item) => void commands.run(item.id),
              // Con el menú abierto, un número cambia directamente a esa tab (0 = la 10).
              onKey: (e) => {
                if (!/^[0-9]$/.test(e.key)) return false;
                switchTab((Number(e.key) + 9) % TAB_COUNT);
                return true;
              },
            },
            focusEditor,
          );
        },
      },
      {
        id: 'theme.toggle',
        label: () => (document.documentElement.dataset.theme === 'dark' ? 'Tema claro' : 'Tema oscuro'),
        keywords: 'modo oscuro claro noche',
        run: () => prefs.set('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'spell.toggle',
        label: () => (prefs.get('spellEnabled') ? 'Desactivar corrector' : 'Activar corrector'),
        keywords: 'ortografía',
        run: () => setSpellEnabled(!prefs.get('spellEnabled')),
      },
      {
        id: 'dictionary.manage',
        label: 'Diccionario',
        keywords: 'palabras ortografía',
        // Solo tiene sentido con el corrector activado.
        when: () => prefs.get('spellEnabled'),
        run: () => openDictionaryManager(dictionary, reloadSpell, focusEditor),
      },
      {
        id: 'history',
        label: 'Historial',
        keywords: 'copias de seguridad versiones backup respaldo',
        // En modo degradado la identidad del archivo no es estable y no se guardan versiones.
        when: () => !degraded,
        run: async () => {
          if (isOverlayOpen()) {
            closeOverlay();
            return;
          }
          await backupReady; // que la versión de apertura, si la hay, ya esté en la lista
          openHistory(todoId, file.name, { saveNow: () => history.saveNow(), restoreFocus: focusEditor });
        },
      },
      {
        id: 'fullscreen',
        label: () => (document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa'),
        run: async () => {
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
          } catch {
            notice('El navegador no permite la pantalla completa aquí.');
          }
        },
      },
      {
        id: 'dictionary.add',
        label: () => {
          const w = wordAt(view, view.state.selection.main.head);
          return w ? `Añadir «${w.word}» al diccionario` : 'Añadir palabra al diccionario';
        },
        keywords: 'ortografía aceptar palabra',
        when: () => wordAt(view, view.state.selection.main.head) !== null,
        run: async () => {
          const w = wordAt(view, view.state.selection.main.head);
          if (!w) return;
          dictionary.add(w.word);
          await spell.addWords([w.word]);
          rescanSpell();
          notice(`«${w.word}» añadida al diccionario.`);
        },
      },
      {
        id: 'export.md',
        label: 'Descargar el .md',
        when: () => degraded,
        run: () => download(getText(), file.name || 'to-do.md', 'text/markdown'),
      },
      {
        id: 'save',
        label: 'Guardar ahora',
        hidden: true, // solo por ⌘S: evita el diálogo del navegador y fuerza el flush
        run: async () => {
          if (degraded) {
            await saveAs();
            return;
          }
          await autosave.flush();
        },
      },
      {
        id: 'save.retry',
        label: 'Reintentar guardado',
        when: () => autosave.state === 'error',
        run: async () => {
          if (autosave.lastError === 'permission' && file.handle) {
            const ok = await FsAccessAdapter.ensurePermission(file.handle);
            if (!ok) {
              notice('Sin permiso de escritura. Puedes guardar en otro archivo desde el menú.');
              return;
            }
          }
          if (autosave.lastError === 'not-found') {
            await saveAs();
            return;
          }
          await autosave.retry();
        },
      },
      {
        id: 'save.as',
        label: 'Guardar como…',
        hidden: true, // se ofrece solo desde la recuperación de errores
        run: saveAs,
      },
      {
        id: 'font.increase',
        label: 'Aumentar tamaño del texto',
        hidden: true, // solo por atajo
        run: () => prefs.set('fontSize', Math.min(FONT_SIZE_MAX, prefs.get('fontSize') + 1)),
      },
      {
        id: 'font.decrease',
        label: 'Reducir tamaño del texto',
        hidden: true, // solo por atajo
        run: () => prefs.set('fontSize', Math.max(FONT_SIZE_MIN, prefs.get('fontSize') - 1)),
      },
      // Tabs por atajo (⌘1…⌘0 / Ctrl+1…Ctrl+0); no aparecen en el menú.
      ...Array.from({ length: TAB_COUNT }, (_, i) => ({
        id: `tab.${i}`,
        label: `Tab ${i + 1}`,
        hidden: true,
        run: () => switchTab(i),
      })),
    );

    // 11. Atajos y ciclo de vida.
    const removeShortcuts = installShortcuts(commands);
    disposers.push(removeShortcuts);

    const onHide = () => {
      void liveDraft.flush();
      if (!degraded) void autosave.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
      // Al volver a la pestaña: comprobar ya si el archivo cambió mientras estábamos fuera.
      else if (fsAdapter) void watcher.check();
    };
    const onFocus = () => {
      if (fsAdapter) void watcher.check();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      void liveDraft.flush();
      if (!degraded && autosave.isDirty) {
        void autosave.flush();
        e.preventDefault();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onHide);
    disposers.push(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onHide);
      closeOverlay();
    });

    lock.onTakeoverRequest(async () => {
      await autosave.flush();
      if (autosave.isDirty && !degraded) return false;
      teardown();
      root.replaceChildren(
        el('main', { class: 'start' }, el('p', { class: 'start__note' }, 'Este archivo se está editando en otra pestaña.')),
      );
      return true;
    });

    return {
      async close() {
        await liveDraft.flush();
        if (!degraded) await autosave.flush();
        teardown();
      },
    };
  } catch (e) {
    teardown();
    throw e;
  }
}
