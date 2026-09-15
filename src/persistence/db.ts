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
 * Versión del historial: el `.md` completo en un instante dado. Se guarda una cada hora mientras la
 * aplicación está abierta, al abrir si hace más de una hora de la última, y a petición del usuario.
 * Solo lectura y solo descargable; to-do nunca la vuelca sobre el archivo.
 */
export interface BackupRecord {
  todoId: string;
  /** Instante de la versión. Forma parte de la clave. */
  ts: number;
  /** Texto íntegro del archivo (tabs y diccionario incluidos). */
  text: string;
  /** SHA-256 (hex) de `text`. Ausente solo en copias migradas de la BD v1; se calcula al comparar. */
  hash?: string;
  /** Palabras totales de las tabs. */
  words: number;
}

interface TodoDB extends DBSchema {
  files: { key: string; value: TodoFileRecord; indexes: { lastOpened: number } };
  drafts: { key: string; value: DraftRecord };
  backups: { key: [string, number]; value: BackupRecord; indexes: { todoId: string } };
}

let dbPromise: Promise<IDBPDatabase<TodoDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TodoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TodoDB>('to-do', 2, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const files = db.createObjectStore('files', { keyPath: 'id' });
          files.createIndex('lastOpened', 'lastOpened');
          db.createObjectStore('drafts', { keyPath: 'todoId' });
        }
        // v2: el historial pasa de una copia por día (clave [todoId, day]) a versiones por instante
        // (clave [todoId, ts]). Las copias existentes ya tenían `ts`, así que se conservan.
        let legacy: BackupRecord[] = [];
        if (oldVersion >= 1) {
          try {
            legacy = (await tx.objectStore('backups').getAll()) as BackupRecord[];
          } catch {
            legacy = [];
          }
          db.deleteObjectStore('backups');
        }
        const backups = db.createObjectStore('backups', { keyPath: ['todoId', 'ts'] });
        backups.createIndex('todoId', 'todoId');
        for (const b of legacy) {
          if (typeof b.ts === 'number' && typeof b.text === 'string') {
            void backups.put({ todoId: b.todoId, ts: b.ts, text: b.text, words: b.words ?? 0 });
          }
        }
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
