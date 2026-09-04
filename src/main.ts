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
import { startSession } from './app/session';
import { el } from './ui/el';

const root = document.getElementById('app')!;
const adapter = createAdapter();

initPrefsEffects();
document.body.appendChild(el('h1', { class: 'brand' }, 'Folio'));

async function showStart(): Promise<void> {
  const last = adapter.capabilities.persistentHandle ? await lastNovel().catch(() => null) : null;
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
      try {
        const ok = await FsAccessAdapter.ensurePermission(rec.handle);
        if (!ok) {
          notice('Sin permiso para abrir el archivo.');
          return;
        }
        await rec.handle.getFile();
        await enter({ name: rec.handle.name, handle: rec.handle });
      } catch {
        await forgetNovel(rec.id);
        notice('El archivo ya no está disponible.');
        await showStart();
      }
    },
  });
}

async function enter(file: NovelFile): Promise<void> {
  try {
    await startSession({ root, adapter, file, onExit: () => void showStart() });
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
