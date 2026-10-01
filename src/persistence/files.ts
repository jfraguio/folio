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

/** Añade (o reemplaza) una identidad física en la lista, conservando las más recientes. */
function withHandle(refs: FileHandleRef[], key: string, handle: FileSystemFileHandle): FileHandleRef[] {
  return [...refs.filter((r) => r.key !== key), { key, handle }].slice(-MAX_HANDLES);
}

/**
 * Resuelve la identidad estable de un archivo (ver `FileIdentity`). Actualiza el registro del
 * nombre para que «Continuar» y la próxima apertura encuentren el mismo archivo físico.
 */
export async function resolveFileIdentity(f: FolioFile): Promise<FileIdentity> {
  const db = await getDB();

  // Sin handle (modo degradado): nombre y tamaño, best-effort. Historial y bloqueo coinciden.
  if (!f.handle) {
    const id = `file:${f.name}:${f.file?.size ?? 0}`;
    await db.put('files', { id, name: f.name, lastOpened: Date.now() }).catch(() => {});
    return { historyId: id, fileKey: id };
  }

  const all = await db.getAll('files');

  // 1. ¿Mismo archivo físico ya visto? El handle manda sobre el nombre.
  for (const rec of all) {
    for (const ref of refsOf(rec)) {
      try {
        if (await ref.handle.isSameEntry(f.handle)) {
          const handles = withHandle(refsOf(rec), ref.key, f.handle);
          await db
            .put('files', { ...rec, handle: f.handle, handles, name: f.name, lastOpened: Date.now() })
            .catch(() => {});
          return { historyId: rec.id, fileKey: ref.key };
        }
      } catch {
        /* handle inválido: se ignora */
      }
    }
  }

  // 2. El historial sigue al nombre (o se crea uno nuevo).
  const byName = all.find((rec) => rec.name === f.name);
  const historyId = byName?.id ?? crypto.randomUUID();
  // 3. El archivo físico es nuevo: clave propia, para no compartir bloqueo ni borrador con otros
  //    archivos que se llamen igual. El primero con un nombre reutiliza su id como clave.
  const fileKey = byName ? crypto.randomUUID() : historyId;
  const handles = withHandle(byName ? refsOf(byName) : [], fileKey, f.handle);
  const record: FolioFileRecord = { id: historyId, name: f.name, lastOpened: Date.now(), handle: f.handle, handles };
  try {
    await db.put('files', record);
  } catch {
    // El handle no es clonable: se guarda sin identidad física (no habrá «Continuar»).
    await db.put('files', { ...record, handle: undefined, handles: undefined }).catch(() => {});
  }
  return { historyId, fileKey };
}

export async function lastFile(): Promise<FolioFileRecord | null> {
  const db = await getDB();
  const all = await db.getAllFromIndex('files', 'lastOpened');
  for (let i = all.length - 1; i >= 0; i--) {
    const rec = all[i];
    if (rec?.handle) return rec;
  }
  return null;
}

export async function forgetFile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('files', id);
}
