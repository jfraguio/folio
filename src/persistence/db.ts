import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { LEGACY } from './legacyIds';

/** Una identidad física de archivo (un `handle`) con su clave estable, para bloquear y borrar. */
export interface FileHandleRef {
  key: string;
  handle: FileSystemFileHandle;
}

export interface FolioFileRecord {
  id: string;
  /** Handle del archivo abierto más recientemente con este nombre (para «Continuar»). */
  handle?: FileSystemFileHandle;
  /**
   * Todos los archivos físicos vistos con este nombre, cada uno con su clave estable. Sin esto, dos
   * `folio.txt` de carpetas distintas compartirían bloqueo y borrador por llamarse igual.
   */
  handles?: FileHandleRef[];
  name: string;
  lastOpened: number;
}

export interface DraftRecord {
  /** Clave del archivo físico (ver `resolveFileIdentity`); no es el id de historial por nombre. */
  todoId: string;
  ts: number;
  text: string;
  /**
   * SHA-256 del texto del disco del que parte el borrador. Ausente en borradores anteriores a este
   * cambio; se compara al abrir para no ofrecer el borrador de otro archivo con el mismo nombre.
   */
  baseHash?: string;
}

/**
 * Versión del historial: el archivo completo en un instante dado. Se guarda una cada hora mientras la
 * aplicación está abierta, al abrir si hace más de una hora de la última, y a petición del usuario.
 * Solo lectura y solo descargable; folio nunca la vuelca sobre el archivo.
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

interface FolioDB extends DBSchema {
  files: { key: string; value: FolioFileRecord; indexes: { lastOpened: number } };
  drafts: { key: string; value: DraftRecord };
  backups: { key: [string, number]; value: BackupRecord; indexes: { todoId: string } };
}

let dbPromise: Promise<IDBPDatabase<FolioDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FolioDB>> {
  if (!dbPromise) {
    // La BD conserva el nombre anterior de la app ('to-do'), igual que las claves `todo.*` de
    // localStorage y los canales/locks: así se mantienen los datos al renombrar a folio, y no se
    // pisan con los del Folio original, que vive en el mismo origen (jfraguio.github.io).
    dbPromise = openDB<FolioDB>(LEGACY.dbName, 2, {
      // Otra pestaña quiere subir la versión de la BD: cerramos la nuestra para no bloquearla, y
      // soltamos la promesa para poder reabrir en la versión nueva.
      blocking() {
        void dbPromise?.then((db) => db.close()).catch(() => {});
        dbPromise = null;
      },
      // La conexión se cerró de forma anómala (p. ej. el navegador la terminó): hay que reabrirla.
      terminated() {
        dbPromise = null;
      },
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
    // Un fallo al abrir (p. ej. `blocked`) no debe dejar la BD inutilizable toda la sesión: se
    // olvida la promesa rechazada para que el siguiente intento vuelva a abrir.
    dbPromise = dbPromise.catch((e) => {
      dbPromise = null;
      throw e;
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
