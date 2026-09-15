import { getDB, type BackupRecord } from './db';
import { splitDocument } from './todoBlocks';
import { countWords } from '../text/words';

/** Versiones que se conservan por archivo (las más recientes). */
export const HISTORY_KEEP = 50;
/** Cada cuánto se guarda una versión mientras la aplicación está abierta. */
export const HISTORY_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Historial de versiones.
 *
 * Se guarda en IndexedDB el `.md` completo (tabs y diccionario incluidos):
 *
 * - al abrir el archivo, si hace más de una hora de la última versión (o no hay ninguna);
 * - cada hora mientras la aplicación está abierta;
 * - cuando el usuario pulsa «Guardar versión» en el panel de historial, sin esperar.
 *
 * Ninguna versión se guarda si el texto no ha cambiado respecto a la más reciente: se compara el
 * SHA-256 del contenido (guardado con cada versión), así una hora sin tocar el archivo no consume
 * una de las HISTORY_KEEP plazas. Se conservan las HISTORY_KEEP más recientes; la más antigua
 * desaparece al guardar la siguiente. Son de solo lectura: la única salida es descargarlas como
 * `.md`; to-do nunca vuelca una versión sobre el archivo ni el editor.
 */

/** SHA-256 del texto, en hexadecimal. */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash de una versión; las migradas de la BD v1 no lo traen guardado y se calcula al vuelo. */
async function hashOf(v: BackupRecord): Promise<string> {
  return v.hash ?? sha256(v.text);
}

/**
 * Guarda una versión si el texto ha cambiado respecto a la más reciente (comparando hashes) y
 * aplica la retención. Devuelve el registro guardado, o `null` si el contenido no había cambiado.
 */
export async function saveVersion(todoId: string, text: string, now = Date.now()): Promise<BackupRecord | null> {
  const latest = await latestVersion(todoId);
  const hash = await sha256(text);
  if (latest && (await hashOf(latest)) === hash) return null;

  const db = await getDB();
  const tx = db.transaction('backups', 'readwrite');
  const existing = await tx.store.index('todoId').getAll(todoId);
  // La clave incluye `ts`: dos guardados en el mismo milisegundo (solo en tests) no deben pisarse.
  let ts = now;
  while (existing.some((b) => b.ts === ts)) ts += 1;
  const record: BackupRecord = { todoId, ts, text, hash, words: countWords(splitDocument(text).tabs.join('\n')) };
  await tx.store.put(record);
  const sorted = [...existing, record].sort((a, b) => b.ts - a.ts);
  for (const old of sorted.slice(HISTORY_KEEP)) await tx.store.delete([todoId, old.ts]);
  await tx.done;
  return record;
}

/**
 * Guarda una versión si ha pasado al menos HISTORY_INTERVAL_MS desde la más reciente (o no hay
 * ninguna). Devuelve el registro guardado, o `null` si no tocaba o el contenido no había cambiado.
 */
export async function saveVersionIfDue(todoId: string, text: string, now = Date.now()): Promise<BackupRecord | null> {
  const latest = await latestVersion(todoId);
  if (latest && now - latest.ts < HISTORY_INTERVAL_MS) return null;
  return saveVersion(todoId, text, now);
}

/** Versiones de un archivo, de la más reciente a la más antigua. */
export async function listVersions(todoId: string): Promise<BackupRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('backups', 'todoId', todoId);
  return all.sort((a, b) => b.ts - a.ts);
}

/** Solo la versión más reciente, sin cargar las demás: el índice `todoId` ordena por [todoId, ts]. */
async function latestVersion(todoId: string): Promise<BackupRecord | undefined> {
  const db = await getDB();
  const cursor = await db.transaction('backups').store.index('todoId').openCursor(IDBKeyRange.only(todoId), 'prev');
  return cursor?.value;
}

/** Nombre de archivo para descargar una versión: `<to-do> — 2026-09-11 14.30.md`. */
export function versionFileName(fileName: string, version: Pick<BackupRecord, 'ts'>): string {
  const base = (fileName || 'to-do').replace(/\.(md|markdown)$/i, '');
  const d = new Date(version.ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`;
  return `${base} — ${stamp}.md`;
}

/**
 * Temporizador horario de una sesión: mientras está arrancado, cada HISTORY_INTERVAL_MS guarda una
 * versión del texto actual si toca (ver `saveVersionIfDue`). Los fallos de IndexedDB se ignoran:
 * el historial es una red de seguridad, nunca debe molestar.
 */
export class VersionHistory {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly now: () => number;

  constructor(
    private readonly todoId: string,
    private readonly getText: () => string,
    opts: { intervalMs?: number; now?: () => number } = {},
  ) {
    this.intervalMs = opts.intervalMs ?? HISTORY_INTERVAL_MS;
    this.now = opts.now ?? Date.now;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.saveIfDue(), this.intervalMs);
  }

  /** Versión del texto actual, si ha pasado el intervalo desde la última. */
  async saveIfDue(text = this.getText(), now = this.now()): Promise<BackupRecord | null> {
    try {
      return await saveVersionIfDue(this.todoId, text, now);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  /**
   * Versión del texto actual, ahora, sin esperar al intervalo (botón «Guardar versión»).
   * Devuelve `null` si el contenido no ha cambiado desde la última versión. Propaga errores.
   */
  saveNow(now = this.now()): Promise<BackupRecord | null> {
    return saveVersion(this.todoId, this.getText(), now);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
