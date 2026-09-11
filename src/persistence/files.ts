import { getDB, type TodoFileRecord } from './db';
import type { TodoFile } from '../fs/FileAdapter';

/**
 * Resuelve la identidad estable de un archivo.
 * Con FS Access se compara el handle con los guardados (isSameEntry).
 * En modo degradado se deriva del nombre y tamaño (best-effort).
 */
export async function resolveTodoId(f: TodoFile): Promise<string> {
  const db = await getDB();
  const all = await db.getAll('files');

  if (f.handle) {
    for (const rec of all) {
      if (rec.handle) {
        try {
          if (await rec.handle.isSameEntry(f.handle)) {
            await db.put('files', { ...rec, name: f.name, lastOpened: Date.now() }).catch(() => {});
            return rec.id;
          }
        } catch {
          /* handle inválido: se ignora */
        }
      }
    }
    const id = crypto.randomUUID();
    try {
      await db.put('files', { id, handle: f.handle, name: f.name, lastOpened: Date.now() });
    } catch {
      // El handle no es clonable en este navegador: se guarda sin él (no habrá "Continuar").
      await db.put('files', { id, name: f.name, lastOpened: Date.now() });
    }
    return id;
  }

  const id = `file:${f.name}:${f.file?.size ?? 0}`;
  await db.put('files', { id, name: f.name, lastOpened: Date.now() });
  return id;
}

export async function lastFile(): Promise<TodoFileRecord | null> {
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
