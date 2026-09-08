import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface NovelRecord {
  id: string;
  handle?: FileSystemFileHandle;
  name: string;
  lastOpened: number;
}

export interface DraftRecord {
  novelId: string;
  ts: number;
  text: string;
}

/** Solo para migrar: el diccionario personal vive ahora dentro del `.md` (folioBlocks.ts). */
export interface DictionaryRecord {
  lang: string;
  words: string[];
}

/**
 * Copia de seguridad de apertura: el `.md` completo tal y como estaba en el disco al abrirlo.
 * Solo lectura y solo descargable; Folio nunca la vuelca sobre el archivo.
 */
export interface BackupRecord {
  novelId: string;
  /** Día local de la apertura, `YYYY-MM-DD`. Una copia por día como mucho. */
  day: string;
  /** Momento de la apertura. */
  ts: number;
  /** Texto íntegro del archivo (con los bloques de notas y diccionario). */
  text: string;
  /** Palabras de la novela (sin los bloques), con el mismo criterio que el contador del editor. */
  words: number;
}

interface FolioDB extends DBSchema {
  novels: { key: string; value: NovelRecord; indexes: { lastOpened: number } };
  drafts: { key: string; value: DraftRecord };
  dictionary: { key: string; value: DictionaryRecord };
  backups: { key: [string, string]; value: BackupRecord; indexes: { novelId: string } };
}

let dbPromise: Promise<IDBPDatabase<FolioDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FolioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FolioDB>('folio', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const novels = db.createObjectStore('novels', { keyPath: 'id' });
          novels.createIndex('lastOpened', 'lastOpened');
          db.createObjectStore('drafts', { keyPath: 'novelId' });
          db.createObjectStore('dictionary', { keyPath: 'lang' });
        }
        // v2: se eliminó el control de versiones.
        if (db.objectStoreNames.contains('snapshots' as never)) db.deleteObjectStore('snapshots' as never);
        // v3: copias de seguridad de apertura (no es un historial: solo lectura y solo descarga).
        if (oldVersion < 3) {
          const backups = db.createObjectStore('backups', { keyPath: ['novelId', 'day'] });
          backups.createIndex('novelId', 'novelId');
        }
      },
    });
  }
  return dbPromise;
}

/** Solo para tests. */
export function resetDBForTests(): void {
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
