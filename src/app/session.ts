import { EditorView } from '@codemirror/view';
import { DEFAULT_FOLIO_NAME, FOLIO_MIME, type FileAdapter, type FolioFile } from '../fs/FileAdapter';
import { FsAccessAdapter } from '../fs/FsAccessAdapter';
import { download } from '../fs/download';
import { isTouch } from '../ui/env';
import { createEditor, createEditorState } from '../editor/createEditor';
import { TabStates } from './TabStates';
import { spellcheck, spellCompartment, wordAt } from '../editor/spellcheck';
import { countDone } from '../editor/strikethrough';
import { zen, zenCompartment } from '../editor/zen';
import { Autosave } from '../persistence/autosave';
import { FileWatcher } from '../persistence/fileWatcher';
import { LiveDraft } from '../persistence/liveDraft';
import { VersionHistory, sha256 } from '../persistence/backups';
import { resolveFileIdentity } from '../persistence/files';
import { acquireFileLock } from '../persistence/locks';
import { PersonalDictionary } from '../persistence/dictionary';
import { emptyTab, joinDocument, splitDocument, TAB_COUNT } from '../persistence/folioFormat';
import { prefs } from '../persistence/prefs';
import { requestPersistentStorage } from '../persistence/db';
import { SpellService } from '../spell/SpellService';
import { CommandRegistry, labelOf } from './commands';
import { installShortcuts, shortcutFor } from './shortcuts';
import { SaveStatus, StatusDot, describeStatus } from '../ui/StatusDot';
import { createMenuButton } from '../ui/MenuButton';
import { TabBar } from '../ui/TabBar';
import { notice } from '../ui/Notice';
import { openMenu, closeOverlay, isOverlayOpen, type MenuItem } from '../ui/Menu';
import { openDialog } from '../ui/Dialog';
import { openDictionaryManager } from '../ui/DictionaryManager';
import { openHistory } from '../ui/History';
import { el, formatDateTime, relativeTime } from '../ui/el';

export interface SessionOptions {
  root: HTMLElement;
  adapter: FileAdapter;
  file: FolioFile;
  onExit: () => void;
}

/** Sesión de edición viva. `close()` guarda lo pendiente y libera todos los recursos (incluido el bloqueo). */
export interface Session {
  close(): Promise<void>;
  /** Hay cambios sin guardar (o un guardado en curso o en error). */
  isDirty(): boolean;
}

/**
 * Abre un archivo. Devuelve `null` si el usuario decide no abrirlo (p. ej. está en otra pestaña
 * y prefiere volver); en ese caso ya se ha llamado a `onExit`.
 */
export async function startSession(o: SessionOptions): Promise<Session | null> {
  const { adapter, root } = o;
  let file = o.file;
  const degraded = !adapter.capabilities.directWrite;
  // En táctil enfocar el editor abre el teclado virtual, que tapa media pantalla: solo se hace
  // cuando el usuario ya estaba escribiendo (o cuando toca el propio editor, que lo hace solo).
  const touch = isTouch();

  // 1. Leer y normalizar. `raw` es el archivo tal cual (con el bloque del diccionario, si lo hay).
  const diskRead = await adapter.read(file);
  let raw = diskRead.text;
  const mtime = diskRead.mtime;
  /** Texto que hay realmente en el disco; `raw` puede pasar a ser el borrador recuperado. */
  const diskText = raw;
  /** Hash de la versión del disco: el borrador solo se ofrece si parte de esta misma base. */
  let baseHash = await sha256(diskText);

  // 2. Identidad, almacenamiento persistente y bloqueo. El historial va por nombre (`historyId`);
  // el bloqueo y el borrador, por archivo físico (`fileKey`).
  const { historyId, fileKey } = await resolveFileIdentity(file);
  void requestPersistentStorage();
  const lock = await acquireFileLock(fileKey);
  if (!lock.acquired) {
    // Cerrar el diálogo con Esc o con un clic fuera es «Volver»: si no, la apertura quedaría colgada.
    const takeover =
      (await openDialog(
        ['Este archivo ya está abierto en otra pestaña.'],
        [
          { id: 'cancel', label: 'Volver', quiet: true },
          { id: 'takeover', label: 'Editar aquí', primary: true },
        ],
      )) === 'takeover';
    if (!takeover) {
      lock.release();
      o.onExit();
      return null;
    }
    const result = await lock.requestTakeover();
    if (result === 'refused') {
      lock.release();
      notice(
        'La otra pestaña tiene cambios que aún no ha podido guardar. Resuélvelo allí antes de abrir el archivo aquí.',
        8000,
      );
      o.onExit();
      return null;
    }
    // Sin respuesta: la otra pestaña está congelada, descartada o colgada. El bloqueo es una
    // salvaguarda, no una barrera: el usuario ya ha pedido editar aquí y se le deja.
    if (result === 'no-response') {
      notice(
        'La otra pestaña no responde. Se abre aquí; si allí sigue abierto, prevalecerá lo último que se guarde.',
        8000,
      );
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
    const history = new VersionHistory(historyId, () => getText());
    disposers.push(() => history.dispose());
    const backupReady = degraded ? Promise.resolve() : history.saveIfDue(diskText).then(() => {});
    if (!degraded) history.start();

    // 4. Comprobación de borrador vivo (guarda el texto completo, diccionario incluido). Se busca
    // por la clave del archivo físico; si no hay, por el id por nombre (borradores anteriores).
    const liveDraft = new LiveDraft(fileKey, () => baseHash);
    let draft = await LiveDraft.read(fileKey);
    let draftKey = fileKey;
    if (!draft && fileKey !== historyId) {
      draft = await LiveDraft.read(historyId);
      draftKey = historyId;
    }
    let recovered = false;
    // `baseHash` ausente = borrador anterior al cambio: se acepta con la comprobación de siempre.
    const draftFits = !!draft && (draft.baseHash === undefined || draft.baseHash === baseHash);
    if (draft && draftFits && draft.ts > mtime && draft.text !== raw) {
      // Esc o clic fuera = «Descartar»: la promesa nunca se queda sin resolver.
      recovered =
        (await openDialog(
          [`Hay cambios sin guardar de ${relativeTime(draft.ts)}. ¿Quieres recuperarlos?`],
          [
            { id: 'discard', label: 'Descartar', quiet: true },
            { id: 'recover', label: 'Recuperar', primary: true },
          ],
        )) === 'recover';
      if (recovered) raw = draft.text;
      else void LiveDraft.remove(draftKey).catch(() => {}); // que no vuelva a preguntar en la próxima apertura
    }

    // Las tabs son el documento; el diccionario viaja al final del archivo como comentario HTML.
    const { tabs, words } = splitDocument(raw);

    // 4. UI base.
    root.replaceChildren();
    const editorRoot = el('div', { class: 'editor-root' });
    root.appendChild(editorRoot);
    disposers.push(() => editorRoot.remove());

    const statusDot = new StatusDot((state) => {
      if (state === 'error') void commands.run('save.retry');
      else if (state === 'degraded') void commands.run('export.txt');
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

    // 6. Tabs y editor. Al entrar se abre siempre la primera tab (sin subtab): la sesión no
    // recuerda la última activa (hubo una pref `todo.lastTab`; se retiró porque la barra arrancaba
    // marcando la tab 1 con el contenido de otra).
    /** Tab principal abierta. */
    let activeTab = 0;
    /** Subtab abierta dentro de `activeTab`, o -1 si lo que se edita es la propia tab. */
    let activeSub = -1;

    /** Texto de la tab `t` (o de su subtab `s`, si `s` ≥ 0). */
    const textOf = (t: number, s: number): string => (s < 0 ? tabs[t]?.text : tabs[t]?.subs[s]) ?? '';
    const setTextOf = (t: number, s: number, text: string): void => {
      const tab = tabs[t];
      if (!tab) return;
      if (s < 0) tab.text = text;
      else if (s < tab.subs.length) tab.subs[s] = text;
    };
    /** Vuelca el editor en la tab (o subtab) abierta. */
    const syncActive = () => setTextOf(activeTab, activeSub, view.state.doc.toString());

    const tabBar = new TabBar({
      tabs,
      onSelect: (t, s) => switchTab(t, s),
    });
    tabBar.setActive(activeTab, activeSub);
    root.appendChild(tabBar.root);
    disposers.push(() => tabBar.root.remove());
    // La barra no debe robar el foco al editor: así al pulsar una tab el cursor (y en táctil el
    // teclado) siguen donde estaban. `editorHadFocus` se toma antes de que el toque pueda
    // desenfocar nada, porque en algunos navegadores el botón ya tiene el foco en el `click`.
    let editorHadFocus = false;
    tabBar.root.addEventListener('pointerdown', () => (editorHadFocus = view.hasFocus), true);
    tabBar.root.addEventListener('mousedown', (e) => e.preventDefault());

    /** Primera línea no vacía del documento: basta para el título de la tab activa. */
    const firstLine = (): string => {
      const doc = view.state.doc;
      for (let n = 1; n <= doc.lines; n++) {
        const text = doc.line(n).text;
        if (text.trim()) return text;
      }
      return '';
    };
    const updateListener = EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      // Nada de O(n) por pulsación: el modelo se sincroniza al guardar o cambiar de tab, el título
      // de la tab activa se recalcula con su primera línea y el contador se agrupa en un frame.
      tabBar.refreshActive(firstLine());
      scheduleDone();
      markChanged();
    });
    /** Config del editor: se relee en cada estado nuevo para que tome el corrector/zen actuales. */
    const editorConfig = () => ({
      spell: prefs.get('spellEnabled') ? spellExt.extension : [],
      zen: prefs.get('zen'),
      extra: [updateListener],
    });
    const view = createEditor({ parent: editorRoot, doc: textOf(activeTab, activeSub), ...editorConfig() });
    // Un `EditorState` por tab/subtab: cambiar de tab no es una transacción, así que no entra en el
    // historial y ⌘Z nunca devuelve el texto de otra tab.
    const states = new TabStates(view, (doc) => createEditorState(doc, editorConfig()));
    disposers.push(() => view.destroy());

    /**
     * En táctil, si el teclado estaba cerrado, pulsar en la barra no debe abrirlo: se enfoca el
     * editor solo en escritorio o si ya lo tenía. Consume `editorHadFocus` (ver arriba).
     */
    function shouldKeepFocus(): boolean {
      const keep = !touch || view.hasFocus || editorHadFocus;
      editorHadFocus = false;
      return keep;
    }

    /**
     * Vuelca la tab `t` (o su subtab `s`) en el editor y la marca como activa. No es una transacción
     * sobre el documento: se cambia de `EditorState`, así que no toca el historial de ninguna tab.
     */
    function showTab(t: number, s: number, keepFocus: boolean): void {
      activeTab = t;
      activeSub = s;
      const isNew = states.load(tabs[t]!, s, textOf(t, s));
      // Al estrenar una tab el cursor arranca al final (y el focus mode queda colocado, como antes).
      if (isNew) view.dispatch({ selection: { anchor: view.state.doc.length } });
      tabBar.setActive(t, s);
      refreshDone();
      if (keepFocus) view.focus();
    }

    /** Cambia la tab (o subtab) activa: guarda el estado actual y carga el de la nueva. */
    function switchTab(t: number, s = -1): void {
      const keepFocus = shouldKeepFocus();
      if (t < 0 || t >= tabs.length) return;
      if (s >= tabs[t]!.subs.length) return;
      if (t === activeTab && s === activeSub) {
        if (keepFocus) view.focus();
        return;
      }
      syncActive();
      states.save(tabs[activeTab]!, activeSub);
      showTab(t, Math.max(s, -1), keepFocus);
    }

    /** Crea una tab vacía al final (hasta TAB_COUNT) y pasa a ella. Solo desde una tab principal. */
    function addTab(): void {
      const keepFocus = shouldKeepFocus();
      if (activeSub >= 0 || tabs.length >= TAB_COUNT) return;
      syncActive();
      states.save(tabs[activeTab]!, activeSub);
      tabs.push(emptyTab());
      showTab(tabs.length - 1, -1, keepFocus);
      markChanged(); // la tab nueva se escribe (marcador vacío) para que exista al reabrir
    }

    /** Crea una subtab vacía al final de la tab abierta (hasta TAB_COUNT) y pasa a ella. Solo desde una tab principal. */
    function addSubTab(): void {
      const keepFocus = shouldKeepFocus();
      const tab = tabs[activeTab];
      if (activeSub >= 0 || !tab || tab.subs.length >= TAB_COUNT) return;
      syncActive();
      states.save(tab, activeSub);
      tab.subs.push('');
      showTab(activeTab, tab.subs.length - 1, keepFocus);
      markChanged();
    }

    /**
     * ¿Se puede quitar la tab (o subtab) abierta? Nunca se borra texto: una subtab solo si está
     * vacía; una tab principal solo si está vacía, no tiene subtabs con texto y no es la única.
     */
    function canRemoveActive(): boolean {
      const tab = tabs[activeTab];
      if (!tab) return false;
      const current = view.state.doc.toString();
      if (activeSub >= 0) return !current.trim();
      if (tabs.length <= 1) return false;
      return !current.trim() && tab.subs.every((s) => !s.trim());
    }

    /** Quita la tab (o subtab) abierta (ver `canRemoveActive`). */
    function removeActive(): void {
      const keepFocus = shouldKeepFocus();
      if (!canRemoveActive()) return;
      syncActive();
      const tab = tabs[activeTab]!;
      states.save(tab, activeSub);
      if (activeSub >= 0) {
        // Pasa a estar activa la subtab que ocupa ahora su sitio (o la última); sin subtabs, la tab.
        const subs = tab.subs;
        subs.splice(activeSub, 1);
        states.dropSub(tab, activeSub);
        showTab(activeTab, Math.min(activeSub, subs.length - 1), keepFocus);
      } else {
        // Pasa a estar activa la tab que ocupa ahora su sitio (o la última), sin subtab.
        tabs.splice(activeTab, 1);
        states.drop(tab);
        showTab(Math.min(activeTab, tabs.length - 1), -1, keepFocus);
      }
      markChanged();
    }

    /** Texto que va al disco: las tabs más el bloque del diccionario (si tiene contenido). */
    const getText = () => {
      syncActive();
      return joinDocument({ tabs, words: dictionary.list() });
    };
    const markChanged = () => {
      liveDraft.schedule();
      if (!degraded) autosave.markDirty();
      else saveStatus.set('degraded');
    };

    // En escritorio se puede empezar a escribir nada más abrir; en táctil se espera a que el
    // usuario toque el texto, para no levantar el teclado sobre lo que acaba de abrir.
    if (!touch) view.focus();
    // El cursor arranca al final de la tab activa.
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    // El estado que ya muestra el editor es el de la tab activa: queda guardado en la caché.
    states.seed(tabs[activeTab]!, activeSub, view.state);

    // 7. Autosave.
    const canWatch = typeof adapter.mtime === 'function';
    // Último tipo de error avisado: evita repetir el mismo aviso en cada intento.
    let lastErrorKind: string | undefined;
    const autosave: Autosave = new Autosave({
      getText,
      initialMtime: mtime,
      io: {
        mtime: async (): Promise<number> => (adapter.mtime ? adapter.mtime(file) : autosave.lastKnownMtime),
        write: async (t) => (await adapter.write(file, t)).mtime,
        // Solo se usa cuando el mtime es posterior, para ver si el contenido cambió de verdad.
        read: () => adapter.read(file),
      },
      onState: (state, info) => {
        saveStatus.set(degraded ? 'degraded' : state, info.lastSaved);
        if (state === 'saved') {
          lastErrorKind = undefined;
          void liveDraft.clear();
        }
      },
      // Alguien guardó después que nosotros: se descarta lo local y se carga lo del disco.
      onNewerOnDisk: () => reloadFromDisk({ unlessSaving: false }),
      onError: (kind) => {
        // Avisar solo al entrar en error o al cambiar de tipo; con el permiso revocado, si no,
        // el aviso se repetiría cada ~1,5 s mientras se escribe.
        if (kind === lastErrorKind) return;
        lastErrorKind = kind;
        if (kind === 'permission')
          notice('folio perdió el permiso de escritura. Pulsa el punto de estado para recuperarlo.', 6000);
        else if (kind === 'not-found')
          notice('El archivo ya no está donde estaba. Pulsa el punto de estado para guardarlo en otro sitio.', 6000);
      },
    });
    disposers.push(() => autosave.dispose());
    if (degraded) saveStatus.set('degraded');
    // Lo "guardado" es lo que hay en el disco, no el borrador recuperado: así el primer flush
    // detecta la diferencia y lo escribe de verdad.
    else autosave.accept(mtime, diskText);
    if (recovered && !degraded) autosave.markDirty(); // el borrador recuperado debe escribirse
    dictionary.onChange(markChanged);

    // La marca «FOLIO» muestra al pasar el ratón el archivo abierto y la fecha de su última
    // modificación correcta en disco (el mtime devuelto por la última escritura que funcionó).
    // La File System Access API no expone la ruta completa del archivo, solo su nombre.
    const brand = document.querySelector<HTMLElement>('.brand');
    if (brand) {
      disposers.push(
        saveStatus.subscribe((state) => {
          // El título solo cambia cuando hay algo nuevo que contar (guardado o error).
          if (state !== 'saved' && state !== 'error') return;
          brand.title = `${file.name}\nÚltima modificación: ${formatDateTime(autosave.lastKnownMtime)}`;
        }),
      );
      disposers.push(() => brand.removeAttribute('title'));
    }

    // Contador de TO-DOs resueltos (líneas tachadas) de la tab abierta, en rojo junto a la marca.
    const doneCount = brand ? el('span', { class: 'done-count', attrs: { 'aria-label': 'TO-DOs resueltos' } }) : null;
    if (brand && doneCount) brand.before(doneCount);
    if (doneCount) disposers.push(() => doneCount.remove());
    const refreshDone = () => {
      if (!doneCount) return;
      const n = countDone(view.state.doc.toString());
      doneCount.textContent = n > 0 ? String(n) : '';
    };
    refreshDone();
    // El contador de TO-DOs se recalcula como mucho una vez por frame, no en cada pulsación.
    let doneScheduled = false;
    const scheduleDone = () => {
      if (doneScheduled) return;
      doneScheduled = true;
      requestAnimationFrame(() => {
        doneScheduled = false;
        refreshDone();
      });
    };

    // 8. Corrector.
    const loadSpell = async () => {
      try {
        await spell.load();
      } catch (e) {
        notice('No se pudo cargar el diccionario ortográfico.');
        console.error(e);
      }
    };
    // Cargar cuando el navegador esté libre: no competir con el primer pintado ni el primer escaneo.
    const whenIdle = (fn: () => void) => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 2000 });
      else setTimeout(fn, 0);
    };
    if (prefs.get('spellEnabled')) whenIdle(() => void loadSpell());

    const setSpellEnabled = (on: boolean) => {
      prefs.set('spellEnabled', on);
      const effect = spellCompartment.reconfigure(on ? spellExt.extension : []);
      view.dispatch({ effects: effect });
      states.updateAll(effect); // las demás tabs guardadas tomarán el corrector al abrirse
      if (on && !spell.ready) void loadSpell();
    };
    const rescanSpell = () => view.plugin(spellExt.plugin)?.rescan();
    /**
     * Quitar una palabra del diccionario personal: basta con invalidar su caché y re-escanear.
     * Hunspell no la conoce (las del diccionario personal se filtran en el hilo principal), así que
     * no hace falta recargarlo entero (~500 ms y ~50 MB por palabra).
     */
    const forgetWord = (word: string) => {
      spell.forget(word);
      rescanSpell();
    };

    /**
     * Modo zen: la pref pone `html[data-zen]` (tabs y tipografía van por CSS); aquí se activan o
     * quitan las extensiones del editor (sustituciones al teclear y focus mode).
     */
    const setZen = (on: boolean) => {
      prefs.set('zen', on);
      const effect = zenCompartment.reconfigure(zen(on));
      view.dispatch({ effects: effect });
      states.updateAll(effect);
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
      const wordsBefore = dictionary.list();
      const prevHead = view.state.selection.main.head;
      // El borrador pasa a partir de esta versión del disco.
      void sha256(fresh.text).then((h) => (baseHash = h));
      tabs.splice(0, tabs.length, ...split.tabs);
      dictionary.load(split.words);
      // El disco puede traer menos tabs (o subtabs) de las que había: la activa no puede quedar fuera.
      if (activeTab >= tabs.length) activeTab = tabs.length - 1;
      if (activeSub >= tabs[activeTab]!.subs.length) activeSub = tabs[activeTab]!.subs.length - 1;
      const next = textOf(activeTab, activeSub);
      // La versión del disco estrena estados: su historial arranca limpio y ⌘Z no devuelve lo local.
      states.clear();
      const state = createEditorState(next, editorConfig()).update({
        selection: { anchor: Math.min(prevHead, next.length) },
      }).state;
      states.set(tabs[activeTab]!, activeSub, state);
      tabBar.setActive(activeTab, activeSub);
      // Si el diccionario personal cambió, se invalidan solo las palabras quitadas (sin recargar
      // Hunspell) y se re-escanea.
      const now = new Set(dictionary.list());
      for (const w of wordsBefore) if (!now.has(w)) spell.forget(w);
      rescanSpell();
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
      // El mtime cambió pero el contenido es el mismo que ya teníamos (iCloud reescribe la fecha
      // sin tocar el texto): se acepta la fecha nueva en silencio, sin recargar ni avisar.
      if (autosave.isSameAsSaved(fresh.text)) {
        autosave.accept(fresh.mtime, fresh.text);
        return;
      }
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
      mtime: async () => (adapter.mtime ? adapter.mtime(file) : autosave.lastKnownMtime),
      lastKnown: () => autosave.lastKnownMtime,
      canReload: () => autosave.state !== 'saving',
      onChange: () => reloadFromDisk({ unlessSaving: true }),
      onError: (e) => console.debug('[folio] no se pudo comprobar el archivo', e),
    });
    disposers.push(() => watcher.dispose());
    if (canWatch) watcher.start();

    // 10. Comandos.
    // Al cerrar un panel, en escritorio el cursor vuelve al texto; en táctil no, porque eso
    // levantaría el teclado tras elegir, p. ej., «Tema oscuro».
    const focusEditor = () => {
      if (!touch) view.focus();
    };

    const saveAs = async () => {
      const t = getText();
      const f = await adapter.saveAs(t, file.name || DEFAULT_FOLIO_NAME);
      if (!f) return;
      file = f;
      if (!degraded) {
        const m = adapter.mtime ? await adapter.mtime(f) : Date.now();
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
          const items: MenuItem[] = commands
            .visible()
            // Los saltos directos a una tab o subtab (`tab.N`, `subtab.N`) van por atajo; crear y eliminar sí se listan.
            .filter((c) => c.id !== 'menu' && !/^(sub)?tab\.\d+$/.test(c.id))
            // En táctil no hay teclado físico: los atajos a la derecha solo estorban.
            .map((c) => ({ id: c.id, label: labelOf(c), meta: touch ? undefined : shortcutFor(c.id) }));
          // Sin ratón no hay tooltip en el punto de estado: el estado del guardado se lee aquí.
          if (touch) {
            const status = describeStatus(saveStatus.state, saveStatus.lastSaved);
            if (status) items.unshift({ id: 'status', label: status, info: true });
          }
          openMenu(
            {
              items,
              onSelect: (item) => void commands.run(item.id),
              // Con el menú abierto, un número cambia directamente a esa tab principal (0 = la 10), si
              // existe. En modo zen solo se ve la tab abierta: cambiar a otra desde aquí lo desactiva.
              onKey: (e) => {
                if (!/^[0-9]$/.test(e.key)) return false;
                const i = (Number(e.key) + 9) % TAB_COUNT;
                if (i >= tabs.length) return false;
                if (prefs.get('zen')) setZen(false);
                switchTab(i, -1);
                return true;
              },
            },
            focusEditor,
          );
        },
      },
      // El orden de registro es el del menú: Modo zen, Tema, Pantalla completa, Corrector,
      // Diccionario, Crear pestaña, Crear subpestaña, Eliminar pestaña, Historial; después, las
      // opciones que solo aparecen en situaciones concretas (palabra bajo el cursor, modo degradado,
      // error de guardado).
      {
        id: 'zen.toggle',
        label: () => (prefs.get('zen') ? 'Desactivar modo zen' : 'Modo zen'),
        keywords: 'concentración escribir folio tipografía',
        run: () => setZen(!prefs.get('zen')),
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
        // iPhone no tiene API de pantalla completa: mejor no ofrecerla que fallar al elegirla.
        when: () => typeof document.documentElement.requestFullscreen === 'function',
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
        run: () => openDictionaryManager(dictionary, forgetWord, focusEditor),
      },
      // Crear y quitar tabs y subtabs. Solo se crea desde una tab principal (no desde una subtab);
      // se quita solo la abierta, y solo si está vacía.
      {
        id: 'tab.create',
        label: 'Crear pestaña',
        keywords: 'nueva tab añadir',
        when: () => activeSub < 0 && tabs.length < TAB_COUNT,
        run: () => addTab(),
      },
      {
        id: 'subtab.create',
        label: 'Crear subpestaña',
        keywords: 'nueva subtab añadir',
        when: () => activeSub < 0 && (tabs[activeTab]?.subs.length ?? TAB_COUNT) < TAB_COUNT,
        run: () => addSubTab(),
      },
      {
        id: 'tab.remove',
        label: () => (activeSub >= 0 ? `Eliminar subpestaña ${activeSub + 1}` : `Eliminar pestaña ${activeTab + 1}`),
        keywords: 'quitar borrar tab subtab',
        when: () => canRemoveActive(),
        run: () => removeActive(),
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
          openHistory(historyId, file.name, { saveNow: () => history.saveNow(), restoreFocus: focusEditor });
        },
      },
      {
        id: 'dictionary.add',
        label: () => {
          const w = wordAt(view, view.state.selection.main.head);
          return w ? `Añadir «${w.word}» al diccionario` : 'Añadir palabra al diccionario';
        },
        keywords: 'ortografía aceptar palabra',
        // Solo con el corrector activado (como «Diccionario») y con una palabra bajo el cursor.
        when: () => prefs.get('spellEnabled') && wordAt(view, view.state.selection.main.head) !== null,
        run: async () => {
          const w = wordAt(view, view.state.selection.main.head);
          if (!w) return;
          dictionary.add(w.word);
          // No hace falta enseñársela a Hunspell: `shouldSkip` ya ignora las del diccionario personal.
          rescanSpell();
          notice(`«${w.word}» añadida al diccionario.`);
        },
      },
      {
        id: 'export.txt',
        label: 'Descargar el .txt',
        when: () => degraded,
        run: () => download(getText(), file.name || DEFAULT_FOLIO_NAME, FOLIO_MIME),
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
      // Tabs por atajo (⌘1…⌘0 / Ctrl+1…Ctrl+0) y subtabs de la tab abierta (⌘⌥1…⌘⌥0 / Ctrl+Alt+1…0);
      // no aparecen en el menú. Sin efecto si la tab o subtab no existe.
      ...Array.from({ length: TAB_COUNT }, (_, i) => ({
        id: `tab.${i}`,
        label: `Tab ${i + 1}`,
        hidden: true,
        run: () => switchTab(i, -1),
      })),
      ...Array.from({ length: TAB_COUNT }, (_, i) => ({
        id: `subtab.${i}`,
        label: `Subtab ${i + 1}`,
        hidden: true,
        run: () => switchTab(activeTab, i),
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
      if (document.visibilityState === 'hidden') {
        onHide();
        // Con la pestaña oculta no hay cambios que detectar: parar el sondeo ahorra batería y
        // accesos a iCloud. Al volver se reanuda y se comprueba de inmediato.
        watcher.stop();
      } else if (canWatch) {
        watcher.start();
        void watcher.check();
      }
    };
    const onFocus = () => {
      if (canWatch) void watcher.check();
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
        el(
          'main',
          { class: 'start' },
          el('p', { class: 'start__note' }, 'Este archivo se está editando en otra pestaña.'),
        ),
      );
      return true;
    });

    return {
      async close() {
        await liveDraft.flush();
        if (!degraded) await autosave.flush();
        teardown();
      },
      isDirty: () => !degraded && autosave.isDirty,
    };
  } catch (e) {
    teardown();
    throw e;
  }
}
