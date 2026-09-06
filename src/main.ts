import './styles/tokens.css';
import './styles/base.css';
import './styles/editor.css';
import './styles/overlays.css';

import { createAdapter, hasFsAccess, isMobile } from './fs/detect';
import { DEFAULT_NOVEL_CONTENT, type NovelFile } from './fs/FileAdapter';
import { FsAccessAdapter } from './fs/FsAccessAdapter';
import { initPrefsEffects } from './persistence/prefs';
import { lastNovel, forgetNovel } from './persistence/novels';
import { renderStartScreen } from './ui/StartScreen';
import { notice } from './ui/Notice';
import { startSession, type Session } from './app/session';
import { el } from './ui/el';

const root = document.getElementById('app')!;
const adapter = createAdapter();

initPrefsEffects();
document.body.appendChild(el('h1', { class: 'brand' }, 'Folio'));

/** Sesión de edición viva, si la hay. Solo puede haber una: abrir otro archivo cierra la anterior. */
let session: Session | null = null;
/** Se incrementa cada vez que se empieza a abrir un archivo; sirve para descartar pantallas de inicio tardías. */
let generation = 0;

async function showStart(): Promise<void> {
  const gen = generation;
  const last = adapter.capabilities.persistentHandle ? await lastNovel().catch(() => null) : null;
  // Mientras se consultaba IndexedDB puede haber llegado un archivo (p. ej. desde el sistema
  // operativo): entonces la pantalla de inicio ya no toca y pintarla borraría el editor.
  if (gen !== generation) return;
  renderStartScreen(root, {
    degraded: !hasFsAccess(),
    mobile: isMobile(),
    last,
    onOpen: async () => {
      const f = await adapter.open().catch(fail);
      if (f) await enter(f);
    },
    onCreate: async () => {
      const f = await adapter.create(DEFAULT_NOVEL_CONTENT).catch(fail);
      if (f) await enter(f);
    },
    onContinue: async (rec) => {
      if (!rec.handle) return;
      let available = false;
      try {
        const ok = await FsAccessAdapter.ensurePermission(rec.handle);
        if (!ok) {
          notice('Sin permiso para abrir el archivo.');
          return;
        }
        await rec.handle.getFile();
        available = true;
      } catch {
        await forgetNovel(rec.id);
        notice('El archivo ya no está disponible.');
        await showStart();
      }
      if (available) await enter({ name: rec.handle.name, handle: rec.handle });
    },
  });
}

async function enter(file: NovelFile): Promise<void> {
  generation++;
  try {
    // Solo una sesión a la vez: si ya hay una novela abierta (p. ej. el sistema operativo nos
    // entrega otro archivo), se guarda y se cierra antes, liberando su bloqueo.
    const previous = session;
    session = null;
    await previous?.close();
    session = await startSession({ root, adapter, file, onExit: () => void showStart() });
  } catch (e) {
    console.error(e);
    notice('No se pudo abrir la novela.');
    await showStart();
  }
}

function fail(e: unknown): null {
  console.error(e);
  notice('Algo ha fallado al acceder al archivo.');
  return null;
}

/** Archivos entregados por el sistema operativo (PWA instalada con file_handlers). */
const lq = (window as unknown as { launchQueue?: { setConsumer: (cb: (p: { files: FileSystemHandle[] }) => void) => void } })
  .launchQueue;
if (lq) {
  lq.setConsumer(async (params) => {
    const handle = params.files?.[0];
    if (handle && handle.kind === 'file') {
      await enter({ name: handle.name, handle: handle as FileSystemFileHandle });
    }
  });
}

void showStart();
