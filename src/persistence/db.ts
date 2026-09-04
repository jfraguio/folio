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

export interface DictionaryRecord {
  lang: string;
  words: string[];
}

interface FolioDB extends DBSchema {
  novels: { key: string; value: NovelRecord; indexes: { lastOpened: number } };
  drafts: { key: string; value: DraftRecord };
  dictionary: { key: string; value: DictionaryRecord };
}

let dbPromise: Promise<IDBPDatabase<FolioDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FolioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FolioDB>('folio', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const novels = db.createObjectStore('novels', { keyPath: 'id' });
          novels.createIndex('lastOpened', 'lastOpened');
          db.createObjectStore('drafts', { keyPath: 'novelId' });
          db.createObjectStore('dictionary', { keyPath: 'lang' });
        }
        // v2: se eliminó el control de versiones.
        if (db.objectStoreNames.contains('snapshots' as never)) db.deleteObjectStore('snapshots' as never);
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
