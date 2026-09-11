import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface TodoFileRecord {
  id: string;
  handle?: FileSystemFileHandle;
  name: string;
  lastOpened: number;
}

export interface DraftRecord {
  todoId: string;
  ts: number;
  text: string;
}

/**
 * Copia de seguridad de apertura: el `.md` completo tal y como estaba en el disco al abrirlo.
 * Solo lectura y solo descargable; to-do nunca la vuelca sobre el archivo.
 */
export interface BackupRecord {
  todoId: string;
  /** Día local de la apertura, `YYYY-MM-DD`. Una copia por día como mucho. */
  day: string;
  /** Momento de la apertura. */
  ts: number;
  /** Texto íntegro del archivo (tabs y diccionario incluidos). */
  text: string;
  /** Palabras totales de las tabs. */
  words: number;
}

interface TodoDB extends DBSchema {
  files: { key: string; value: TodoFileRecord; indexes: { lastOpened: number } };
  drafts: { key: string; value: DraftRecord };
  backups: { key: [string, string]; value: BackupRecord; indexes: { todoId: string } };
}

let dbPromise: Promise<IDBPDatabase<TodoDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TodoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TodoDB>('to-do', 1, {
      upgrade(db) {
        const files = db.createObjectStore('files', { keyPath: 'id' });
        files.createIndex('lastOpened', 'lastOpened');
        db.createObjectStore('drafts', { keyPath: 'todoId' });
        const backups = db.createObjectStore('backups', { keyPath: ['todoId', 'day'] });
        backups.createIndex('todoId', 'todoId');
      },
    });
  }
  return dbPromise;
}

/** Cierra la conexión y olvida la promesa. Solo para tests. */
export async function resetDBForTests(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignorar */
    }
  }
  dbPromise = null;
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* no crítico */
  }
}
