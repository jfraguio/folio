import { getDB, type FileHandleRef, type FolioFileRecord } from './db';
import type { FolioFile } from '../fs/FileAdapter';

/**
 * Identidad de un archivo abierto. Se separan dos conceptos:
 *
 * - `historyId`: el historial de versiones va por **nombre**, para que sobreviva a renombrados y a
 *   copias de iCloud.
 * - `fileKey`: el bloqueo y el borrador van por **archivo físico** (el `handle`, comparado con
 *   `isSameEntry`), porque dos `folio.txt` de carpetas distintas no deben compartir nada. Sin
 *   handles (modo degradado) se cae al nombre y tamaño, que es lo único disponible.
 */
export interface FileIdentity {
  historyId: string;
  fileKey: string;
}

/** Handles guardados de un registro, incluyendo el campo `handle` suelto de versiones anteriores. */
function refsOf(rec: FolioFileRecord): FileHandleRef[] {
  if (rec.handles?.length) return rec.handles;
  return rec.handle ? [{ key: rec.id, handle: rec.handle }] : [];
}

/** Cuántos handles distintos se recuerdan por nombre; suficiente para separar archivos y acotar la BD. */
const MAX_HANDLES = 20;
/**
 * Tope de espera para comprobar un handle persistido (`isSameEntry` / `queryPermission`).
 * En condiciones normales resuelven en unos pocos milisegundos; si un handle queda roto (p. ej.
 * tras una actualización de Chrome, Chromium #587468319), la promesa puede quedarse colgada para
 * siempre y bloquear cualquier apertura.
 */
const HANDLE_TIMEOUT_MS = 1000;

/** Añade (o reemplaza) una identidad física en la lista, conservando las más recientes. */
function withHandle(refs: FileHandleRef[], key: string, handle: FileSystemFileHandle): FileHandleRef[] {
  return [...refs.filter((r) => r.key !== key), { key, handle }].slice(-MAX_HANDLES);
}

/** Resuelve o rechaza con `promise`, o rechaza si no responde en `ms` milisegundos. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FileSystemHandle timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

type EntryMatch = 'same' | 'different' | 'dead';

/** Compara un handle guardado con el abierto; si falla o se cuelga, lo marca como roto (`dead`). */
async function compareEntry(
  stored: FileSystemFileHandle,
  target: FileSystemFileHandle,
  timeoutMs: number,
): Promise<EntryMatch> {
  try {
    const same = await withTimeout(stored.isSameEntry(target), timeoutMs);
    return same ? 'same' : 'different';
  } catch {
    return 'dead';
  }
}

/** Comprueba si un handle persistido responde sin mostrar diálogo ni leer el disco. */
async function isHandleAlive(handle: FileSystemFileHandle, timeoutMs: number): Promise<boolean> {
  if (typeof handle.queryPermission !== 'function') return true;
  try {
    await withTimeout(handle.queryPermission({ mode: 'read' }), timeoutMs);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resuelve la identidad estable de un archivo (ver `FileIdentity`). Actualiza el registro del
 * nombre para que «Continuar» y la próxima apertura encuentren el mismo archivo físico.
 */
export async function resolveFileIdentity(
  f: FolioFile,
  opts: { handleTimeoutMs?: number } = {},
): Promise<FileIdentity> {
  const db = await getDB();

  // Sin handle (modo degradado): nombre y tamaño, best-effort. Historial y bloqueo coinciden.
  if (!f.handle) {
    const id = `file:${f.name}:${f.file?.size ?? 0}`;
    await db.put('files', { id, name: f.name, lastOpened: Date.now() }).catch(() => {});
    return { historyId: id, fileKey: id };
  }

  const timeoutMs = opts.handleTimeoutMs ?? HANDLE_TIMEOUT_MS;
  const all = await db.getAll('files');

  // 1. ¿Mismo archivo físico ya visto? El handle manda sobre el nombre. Se comparan todos en
  //    paralelo y con límite de tiempo: un handle colgado no bloquea la apertura y se purga del
  //    registro (conservando `id` y el historial).
  const checks = await Promise.all(
    all.map(async (rec) => {
      const refs = refsOf(rec);
      const results = await Promise.all(refs.map((ref) => compareEntry(ref.handle, f.handle!, timeoutMs)));
      const alive = refs.filter((_, i) => results[i] !== 'dead');
      const matchedIndex = results.indexOf('same');
      return {
        rec,
        alive,
        hadDead: alive.length < refs.length,
        match: matchedIndex >= 0 ? refs[matchedIndex]! : null,
      };
    }),
  );

  const pruneDead = async (skipId?: string) => {
    for (const c of checks) {
      if (!c.hadDead || c.rec.id === skipId) continue;
      const nextHandle = c.alive.length ? c.alive[c.alive.length - 1]!.handle : undefined;
      await db
        .put('files', {
          ...c.rec,
          handle: nextHandle,
          handles: c.alive.length ? c.alive : undefined,
        })
        .catch(() => {});
    }
  };

  const hit = checks.find((c) => c.match !== null);
  if (hit && hit.match) {
    const handles = withHandle(hit.alive, hit.match.key, f.handle);
    await db
      .put('files', { ...hit.rec, handle: f.handle, handles, name: f.name, lastOpened: Date.now() })
      .catch(() => {});
    await pruneDead(hit.rec.id);
    return { historyId: hit.rec.id, fileKey: hit.match.key };
  }

  // 2. El historial sigue al nombre (o se crea uno nuevo).
  const byNameCheck = checks.find((c) => c.rec.name === f.name);
  const byName = byNameCheck?.rec;
  const historyId = byName?.id ?? crypto.randomUUID();
  // 3. El archivo físico es nuevo: clave propia, para no compartir bloqueo ni borrador con otros
  //    archivos que se llamen igual. El primero con un nombre reutiliza su id como clave.
  const fileKey = byName ? crypto.randomUUID() : historyId;
  const handles = withHandle(byNameCheck ? byNameCheck.alive : [], fileKey, f.handle);
  const record: FolioFileRecord = { id: historyId, name: f.name, lastOpened: Date.now(), handle: f.handle, handles };
  try {
    await db.put('files', record);
  } catch {
    // El handle no es clonable: se guarda sin identidad física (no habrá «Continuar»).
    await db.put('files', { ...record, handle: undefined, handles: undefined }).catch(() => {});
  }
  await pruneDead(historyId);
  return { historyId, fileKey };
}

export async function lastFile(opts: { handleTimeoutMs?: number } = {}): Promise<FolioFileRecord | null> {
  const db = await getDB();
  const all = await db.getAllFromIndex('files', 'lastOpened');
  const withHandles = all.filter((rec): rec is FolioFileRecord & { handle: FileSystemFileHandle } => !!rec?.handle);
  if (!withHandles.length) return null;

  const timeoutMs = opts.handleTimeoutMs ?? HANDLE_TIMEOUT_MS;
  const aliveFlags = await Promise.all(withHandles.map((rec) => isHandleAlive(rec.handle, timeoutMs)));

  // Los handles que no responden se olvidan sin borrar el registro (se conserva el historial),
  // para no ofrecer un «CONTINUE» colgado ni volver a esperar por ellos.
  for (let i = 0; i < withHandles.length; i++) {
    if (!aliveFlags[i]) await forgetFile(withHandles[i]!.id).catch(() => {});
  }

  for (let i = withHandles.length - 1; i >= 0; i--) {
    if (aliveFlags[i]) return withHandles[i]!;
  }
  return null;
}

/**
 * Olvida los handles persistidos de un archivo (deja de ofrecerse en «CONTINUE»), conservando el
 * registro para que su historial de versiones siga asociado al nombre al volver a abrirlo.
 */
export async function forgetFile(id: string): Promise<void> {
  const db = await getDB();
  const rec = await db.get('files', id);
  if (!rec) return;
  await db.put('files', { ...rec, handle: undefined, handles: undefined });
}
