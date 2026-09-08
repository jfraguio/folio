import { getDB, type BackupRecord } from './db';
import { splitDocument } from './folioBlocks';
import { countWords } from '../text/words';

/** Copias que se conservan por novela (las más recientes). */
export const BACKUP_KEEP = 10;

/**
 * Copias de seguridad de apertura.
 *
 * Al abrir una novela se guarda en IndexedDB el `.md` tal y como estaba en el disco, como mucho
 * una vez por día y solo si su contenido difiere de todas las copias ya guardadas. Se conservan las
 * BACKUP_KEEP más recientes. Son de solo lectura: la única salida es descargarlas como `.md`;
 * Folio nunca vuelca una copia sobre el archivo ni sobre el editor.
 */

/** Día local `YYYY-MM-DD` de un instante. */
export function localDay(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Guarda una copia del texto leído del disco si hoy aún no hay ninguna y el contenido no coincide
 * con ninguna copia existente. Devuelve `true` si se ha guardado algo.
 */
export async function saveOpeningBackup(novelId: string, text: string, now = Date.now()): Promise<boolean> {
  const db = await getDB();
  const tx = db.transaction('backups', 'readwrite');
  const existing = await tx.store.index('novelId').getAll(novelId);
  const day = localDay(now);
  if (existing.some((b) => b.day === day || b.text === text)) {
    await tx.done;
    return false;
  }
  await tx.store.put({ novelId, day, ts: now, text, words: countWords(splitDocument(text).body) });
  // Retención: se conservan las BACKUP_KEEP más recientes.
  const sorted = [...existing, { day }].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  for (const old of sorted.slice(BACKUP_KEEP)) await tx.store.delete([novelId, old.day]);
  await tx.done;
  return true;
}

/** Copias de una novela, de la más reciente a la más antigua. */
export async function listBackups(novelId: string): Promise<BackupRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('backups', 'novelId', novelId);
  return all.sort((a, b) => b.ts - a.ts);
}

/** Nombre de archivo para descargar una copia: `<novela> — 2026-09-08.md`. */
export function backupFileName(novelName: string, backup: Pick<BackupRecord, 'day'>): string {
  const base = (novelName || 'novela').replace(/\.(md|markdown)$/i, '');
  return `${base} — ${backup.day}.md`;
}
