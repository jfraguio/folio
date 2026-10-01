import { beforeEach, describe, expect, it, vi } from 'vitest';

// Almacén en memoria sin structured-clone: los handles simulados conservan `isSameEntry`, que un
// IndexedDB real clonaría (las funciones no sobreviven al clon).
const mem = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('../src/persistence/db', () => ({
  getDB: async () => ({
    getAll: async () => [...mem.store.values()],
    get: async (k: string) => mem.store.get(k),
    put: async (_store: string, v: { id: string }) => {
      mem.store.set(v.id, v);
    },
    delete: async (_store: string, k: string) => {
      mem.store.delete(k);
    },
  }),
}));

import { resolveFileIdentity } from '../src/persistence/files';

/** Handle simulado: dos con el mismo `id` son el mismo archivo físico. */
const makeHandle = (id: string) =>
  ({
    kind: 'file',
    name: 'folio.txt',
    __id: id,
    async isSameEntry(other: { __id?: string }) {
      return other?.__id === id;
    },
  }) as unknown as FileSystemFileHandle;

const file = (handle?: FileSystemFileHandle, name = 'folio.txt', size = 0) =>
  handle ? { name, handle } : { name, file: { size } as File };

describe('resolveFileIdentity', () => {
  beforeEach(() => mem.store.clear());

  it('dos «folio.txt» de carpetas distintas no comparten fileKey, pero sí historial', async () => {
    const a = await resolveFileIdentity(file(makeHandle('A')));
    const b = await resolveFileIdentity(file(makeHandle('B')));
    expect(a.historyId).toBe(b.historyId); // el historial sigue al nombre
    expect(a.fileKey).not.toBe(b.fileKey); // el bloqueo/borrador, al archivo físico
  });

  it('reabrir el mismo archivo físico conserva su fileKey', async () => {
    const first = await resolveFileIdentity(file(makeHandle('A')));
    const again = await resolveFileIdentity(file(makeHandle('A')));
    expect(again).toEqual(first);
  });

  it('un tercer archivo con el mismo nombre recibe otra clave propia', async () => {
    const a = await resolveFileIdentity(file(makeHandle('A')));
    const b = await resolveFileIdentity(file(makeHandle('B')));
    const c = await resolveFileIdentity(file(makeHandle('C')));
    expect(new Set([a.fileKey, b.fileKey, c.fileKey]).size).toBe(3);
    expect(new Set([a.historyId, b.historyId, c.historyId]).size).toBe(1);
  });

  it('nombres distintos no comparten nada', async () => {
    const a = await resolveFileIdentity(file(makeHandle('A'), 'uno.txt'));
    const b = await resolveFileIdentity(file(makeHandle('B'), 'dos.txt'));
    expect(a.historyId).not.toBe(b.historyId);
    expect(a.fileKey).not.toBe(b.fileKey);
  });

  it('sin handle (modo degradado) la identidad es nombre y tamaño', async () => {
    const a = await resolveFileIdentity(file(undefined, 'folio.txt', 10));
    expect(a).toEqual({ historyId: 'file:folio.txt:10', fileKey: 'file:folio.txt:10' });
  });
});
