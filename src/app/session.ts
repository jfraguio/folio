import { EditorView } from '@codemirror/view';
import type { FileAdapter, NovelFile } from '../fs/FileAdapter';
import { FsAccessAdapter } from '../fs/FsAccessAdapter';
import { download } from '../fs/FallbackAdapter';
import { createEditor, jumpTo } from '../editor/createEditor';
import { typewriter, typewriterCompartment } from '../editor/typewriter';
import { spanishTypography, typographyCompartment } from '../editor/typography';
import { spellcheck, spellCompartment, wordAt } from '../editor/spellcheck';
import { chapterAt, getChapterIndex } from '../editor/chapters';
import { Autosave } from '../persistence/autosave';
import { LiveDraft } from '../persistence/liveDraft';
import { resolveNovelId } from '../persistence/novels';
import { acquireNovelLock } from '../persistence/locks';
import { PersonalDictionary } from '../persistence/dictionary';
import { prefs, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../persistence/prefs';
import { requestPersistentStorage } from '../persistence/db';
import { SpellService } from '../spell/SpellService';
import { SPELL_LANG } from '../spell/dictionaries';
import { CommandRegistry, labelOf } from './commands';
import { installShortcuts, shortcutFor } from './shortcuts';
import { StatusDot } from '../ui/StatusDot';
import { createMenuButton } from '../ui/MenuButton';
import { WordCounter } from '../ui/WordCounter';
import { notice } from '../ui/Notice';
import { openPalette, closeOverlay, isOverlayOpen } from '../ui/Palette';
import { openDialog } from '../ui/Dialog';
import { openDictionaryManager } from '../ui/DictionaryManager';
import { formatNumber } from '../text/words';
import { el, relativeTime } from '../ui/el';

export interface SessionOptions {
  root: HTMLElement;
  adapter: FileAdapter;
  file: NovelFile;
  onExit: () => void;
}

export async function startSession(o: SessionOptions): Promise<void> {
  const { adapter, root } = o;
  let file = o.file;
  const degraded = !adapter.capabilities.directWrite;

  // 1. Leer y normalizar.
  let { text, mtime } = await adapter.read(file);

  // 2. Identidad, almacenamiento persistente y bloqueo.
  const novelId = await resolveNovelId(file);
  void requestPersistentStorage();
  const lock = await acquireNovelLock(novelId);
  if (!lock.acquired) {
    const takeover = await new Promise<boolean>((resolve) =>
      openDialog(
        ['Esta novela ya está abierta en otra pestaña.'],
        [
          { label: 'Volver', quiet: true, onClick: () => resolve(false) },
          { label: 'Editar aquí', primary: true, onClick: () => resolve(true) },
        ],
      ),
    );
    if (!takeover || !(await lock.requestTakeover())) {
      o.onExit();
      return;
    }
  }

  // 3. Comprobación de borrador vivo.
  const draft = await LiveDraft.read(novelId);
  if (draft && draft.ts > mtime && draft.text !== text) {
    const recover = await new Promise<boolean>((resolve) =>
      openDialog(
        [`Hay cambios sin guardar de ${relativeTime(draft.ts)}. ¿Quieres recuperarlos?`],
        [
          { label: 'Descartar', quiet: true, onClick: () => resolve(false) },
          { label: 'Recuperar', primary: true, onClick: () => resolve(true) },
        ],
      ),
    );
    if (recover) text = draft.text;
  }

  // 4. UI base.
  root.replaceChildren();
  const editorRoot = el('div', { class: 'editor-root' });
  root.appendChild(editorRoot);

  const statusDot = new StatusDot((state) => {
    if (state === 'error') void commands.run('save.retry');
    else if (state === 'conflict') showConflict();
    else if (state === 'degraded') void commands.run('export.md');
    else void commands.run('palette');
  });
  const menuButton = createMenuButton(() => void commands.run('palette'));
  root.appendChild(menuButton);
  const wordCounter = new WordCounter();
  const cornerRight = el('div', { class: 'corner-right' }, statusDot.root, wordCounter.root);
  root.appendChild(cornerRight);

  // 5. Servicios.
  const liveDraft = new LiveDraft(novelId);
  const dictionary = new PersonalDictionary(SPELL_LANG);
  await dictionary.load();
  const spell = new SpellService();
  const spellExt = spellcheck({ service: spell, dictionary });
  const commands = new CommandRegistry();


  // El índice se calcula bajo demanda; tras escribir se espera un poco para no recorrer la novela en cada tecla.
  let wordCountTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleWordCount = (ms: number) => {
    if (wordCountTimer) clearTimeout(wordCountTimer);
    wordCountTimer = setTimeout(refreshWords, ms);
  };

  // 6. Editor.
  const view = createEditor({
    parent: editorRoot,
    doc: text,
    spell: prefs.get('spellEnabled') ? spellExt.extension : [],
    extra: [
      EditorView.updateListener.of((u) => {
        if (u.docChanged) scheduleWordCount(300);
        else if (u.selectionSet) scheduleWordCount(0);
        if (!u.docChanged) return;
        const t = u.state.doc.toString();
        liveDraft.schedule(t);
        if (!degraded) autosave.markDirty();
        else statusDot.set('degraded');
      }),
    ],
  });

  const getText = () => view.state.doc.toString();
  const refreshWords = () => {
    const index = getChapterIndex(view.state);
    const current = chapterAt(index, view.state.selection.main.head);
    wordCounter.set(current ? current.words : null, index.totalWords);
  };
  refreshWords();

  // Cursor al primer párrafo tras el encabezado en novelas nuevas/vacías; al inicio en el resto.
  const firstChapter = getChapterIndex(view.state).chapters.find((c) => !c.implicit);
  if (firstChapter && getChapterIndex(view.state).totalWords === 0) {
    view.dispatch({ selection: { anchor: Math.min(firstChapter.target, view.state.doc.length) } });
  }
  view.focus();

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
      statusDot.set(degraded ? 'degraded' : state, info.lastSaved);
      if (state === 'saved') void liveDraft.clear();
    },
    onConflict: () => {
      notice('El archivo ha cambiado en el disco. Pulsa el punto de estado para resolverlo.', 6000);
    },
    onError: (kind) => {
      if (kind === 'permission') notice('Folio perdió el permiso de escritura. Pulsa el punto de estado para recuperarlo.', 6000);
      else if (kind === 'not-found') notice('El archivo ya no está donde estaba. Pulsa el punto de estado para guardarlo en otro sitio.', 6000);
    },
  });
  if (degraded) statusDot.set('degraded');
  else autosave.accept(mtime, text);
  if (draft && text === draft.text) autosave.markDirty(); // el borrador recuperado debe escribirse

  // 8. Corrector.
  const loadSpell = async () => {
    try {
      await dictionary.load();
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

  // 9. Conflicto.
  const showConflict = () => {
    openDialog(
      [
        'El archivo ha cambiado en el disco desde la última vez que Folio lo guardó.',
        '¿Qué versión quieres conservar? La otra se perderá.',
      ],
      [
        {
          label: 'Cargar la del disco',
          quiet: true,
          onClick: async () => {
            const fresh = await adapter.read(file);
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: fresh.text } });
            autosave.accept(fresh.mtime, fresh.text);
            notice('Se ha cargado la versión del disco.');
          },
        },
        {
          label: 'Conservar la mía',
          primary: true,
          onClick: async () => {
            await autosave.overwrite();
          },
        },
      ],
      () => view.focus(),
    );
  };

  // 10. Comandos.
  const focusEditor = () => view.focus();

  const saveAs = async () => {
    const t = getText();
    const f = await adapter.saveAs(t, file.name || 'novela.md');
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
      id: 'palette',
      label: 'Paleta de comandos',
      run: () => {
        if (isOverlayOpen()) {
          closeOverlay();
          return;
        }
        const items = commands
          .visible()
          .filter((c) => c.id !== 'palette')
          .map((c) => ({ id: c.id, label: labelOf(c), meta: c.shortcut ?? shortcutFor(c.id), keywords: c.keywords }));
        openPalette({ items, onSelect: (item) => void commands.run(item.id) }, focusEditor);
      },
    },
    {
      id: 'chapters',
      label: 'Capítulos',
      keywords: 'navegar ir a escena',
      run: () => {
        if (isOverlayOpen()) {
          closeOverlay();
          return;
        }
        const index = getChapterIndex(view.state);
        const current = chapterAt(index, view.state.selection.main.head);
        const items = index.chapters.map((c, i) => ({
          id: String(i),
          label: c.title,
          meta: formatNumber(c.words),
          nested: c.level === 2,
          current: c === current,
        }));
        openPalette(
          {
            placeholder: 'Ir a capítulo…',
            items,
            footer: `${formatNumber(index.totalWords)} palabras`,
            initialActiveId: current ? String(index.chapters.indexOf(current)) : undefined,
            onSelect: (item) => {
              const c = index.chapters[Number(item.id)];
              if (c) jumpTo(view, Math.min(c.target, view.state.doc.length));
            },
          },
          focusEditor,
        );
      },
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
            notice('Sin permiso de escritura. Puedes guardar en otro archivo desde la paleta.');
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
      id: 'export.md',
      label: 'Descargar el .md',
      when: () => degraded,
      run: () => download(getText(), file.name || 'novela.md', 'text/markdown'),
    },
    {
      id: 'export.txt',
      label: 'Exportar',
      keywords: 'texto plano',
      run: async () => {
        await autosave.flush();
        const { markdownToTxt } = await import('../export/toTxt');
        const txt = markdownToTxt(getText());
        const name = file.name.replace(/\.(md|markdown)$/i, '') + '.txt';
        if ('showSaveFilePicker' in window) {
          try {
            const h = await window.showSaveFilePicker({
              suggestedName: name,
              types: [{ description: 'Texto', accept: { 'text/plain': ['.txt'] } }],
            });
            const w = await h.createWritable();
            await w.write(txt);
            await w.close();
            notice(`Exportado a ${h.name}`);
          } catch (e) {
            if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
          }
        } else {
          download(txt, name, 'text/plain');
        }
      },
    },
    {
      id: 'theme.toggle',
      label: () => (document.documentElement.dataset.theme === 'dark' ? 'Tema claro' : 'Tema oscuro'),
      keywords: 'modo oscuro claro noche',
      run: () => prefs.set('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
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
    {
      id: 'typewriter.toggle',
      label: () => (prefs.get('typewriter') ? 'Desactivar texto centrado' : 'Activar texto centrado'),
      keywords: 'máquina de escribir centrar cursor',
      run: () => {
        const on = prefs.toggle('typewriter');
        view.dispatch({ effects: typewriterCompartment.reconfigure(typewriter(on)) });
      },
    },
    {
      id: 'typography.toggle',
      label: () => (prefs.get('typographyEs') ? 'Desactivar asistencia literaria' : 'Activar asistencia literaria'),
      keywords: 'raya comillas guion largo',
      run: () => {
        const on = prefs.toggle('typographyEs');
        view.dispatch({ effects: typographyCompartment.reconfigure(spanishTypography(on)) });
        if (on) notice('-- → —   " → « »   ... → …', 4000);
      },
    },
    {
      id: 'spell.toggle',
      label: () => (prefs.get('spellEnabled') ? 'Desactivar corrector' : 'Activar corrector'),
      keywords: 'ortografía',
      run: () => setSpellEnabled(!prefs.get('spellEnabled')),
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
        await dictionary.add(w.word);
        await spell.addWords([w.word]);
        rescanSpell();
        notice(`«${w.word}» añadida al diccionario.`);
      },
    },
    {
      id: 'dictionary.manage',
      label: 'Gestionar diccionario personal',
      run: () =>
        openDictionaryManager(
          dictionary,
          () => {
            spell.dispose();
            void loadSpell().then(rescanSpell);
          },
          focusEditor,
        ),
    },
  );

  // 11. Atajos y ciclo de vida.
  const removeShortcuts = installShortcuts(commands);

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      void liveDraft.flush();
      if (!degraded) void autosave.flush();
    }
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    void liveDraft.flush();
    if (!degraded && autosave.isDirty) {
      void autosave.flush();
      e.preventDefault();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('pagehide', onVisibility);

  lock.onTakeoverRequest(async () => {
    await autosave.flush();
    if (autosave.isDirty && !degraded) return false;
    teardown();
    root.replaceChildren(
      el('main', { class: 'start' }, el('p', { class: 'start__note' }, 'Esta novela se está editando en otra pestaña.')),
    );
    return true;
  });

  function teardown() {
    removeShortcuts();
    autosave.dispose();
    spell.dispose();
    lock.release();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('pagehide', onVisibility);
    closeOverlay();
    view.destroy();
    cornerRight.remove();
    menuButton.remove();
    if (wordCountTimer) clearTimeout(wordCountTimer);
  }
}
