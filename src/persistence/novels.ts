import { getDB, type NovelRecord } from './db';
import type { NovelFile } from '../fs/FileAdapter';

/**
 * Resuelve la identidad estable de una novela.
 * Con FS Access se compara el handle con los guardados (isSameEntry).
 * En modo degradado se deriva del nombre y tamaño (best-effort).
 */
export async function resolveNovelId(f: NovelFile): Promise<string> {
  const db = await getDB();
  const all = await db.getAll('novels');

  if (f.handle) {
    for (const rec of all) {
      if (rec.handle) {
        try {
          if (await rec.handle.isSameEntry(f.handle)) {
            await db.put('novels', { ...rec, name: f.name, lastOpened: Date.now() }).catch(() => {});
            return rec.id;
          }
        } catch {
          /* handle inválido: se ignora */
        }
      }
    }
    const id = crypto.randomUUID();
    try {
      await db.put('novels', { id, handle: f.handle, name: f.name, lastOpened: Date.now() });
    } catch {
      // El handle no es clonable en este navegador: se guarda sin él (no habrá "Continuar").
      await db.put('novels', { id, name: f.name, lastOpened: Date.now() });
    }
    return id;
  }

  const id = `file:${f.name}:${f.file?.size ?? 0}`;
  await db.put('novels', { id, name: f.name, lastOpened: Date.now() });
  return id;
}

export async function lastNovel(): Promise<NovelRecord | null> {
  const db = await getDB();
  const all = await db.getAllFromIndex('novels', 'lastOpened');
  for (let i = all.length - 1; i >= 0; i--) {
    const rec = all[i];
    if (rec?.handle) return rec;
  }
  return null;
}

export async function forgetNovel(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('novels', id);
}
