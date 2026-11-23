import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolioFileRecord } from '../src/persistence/db';

// Almacén en memoria sin structured-clone: los handles simulados conservan `isSameEntry`, que un
// IndexedDB real clonaría (las funciones no sobreviven al clon).
const mem = vi.hoisted(() => ({ store: new Map<string, FolioFileRecord>() }));

vi.mock('../src/persistence/db', () => ({
  getDB: async () => ({
    getAll: async () => [...mem.store.values()],
    getAllFromIndex: async (_store: string, _index: string) =>
      [...mem.store.values()].sort((a, b) => a.lastOpened - b.lastOpened),
    get: async (_store: string, k: string) => mem.store.get(k),
    put: async (_store: string, v: FolioFileRecord) => {
      mem.store.set(v.id, v);
    },
    delete: async (_store: string, k: string) => {
      mem.store.delete(k);
    },
  }),
}));

import { forgetFile, lastFile, resolveFileIdentity } from '../src/persistence/files';
import { FsAccessAdapter } from '../src/fs/FsAccessAdapter';

/** Handle simulado: dos con el mismo `id` son el mismo archivo físico. */
const makeHandle = (id: string, name = 'folio.txt') =>
  ({
    kind: 'file',
    name,
    __id: id,
    async isSameEntry(other: { __id?: string }) {
      return other?.__id === id;
    },
    async queryPermission() {
      return 'granted' as const;
    },
    async requestPermission() {
      return 'granted' as const;
    },
  }) as unknown as FileSystemFileHandle;

/** Handle roto (Chromium #587468319): cualquier llamada se queda colgada para siempre. */
const makeHungHandle = (name = 'folio.txt') =>
  ({
    kind: 'file',
    name,
    isSameEntry: () => new Promise<boolean>(() => {}),
    queryPermission: () => new Promise<PermissionState>(() => {}),
    requestPermission: () => new Promise<PermissionState>(() => {}),
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

  it('un handle colgado en isSameEntry no bloquea la apertura, se purga y conserva el historial', async () => {
    const dead = makeHungHandle('WORKSHOP.txt');
    mem.store.set('hist-1', {
      id: 'hist-1',
      name: 'WORKSHOP.txt',
      lastOpened: 100,
      handle: dead,
      handles: [{ key: 'hist-1', handle: dead }],
    });

    const fresh = makeHandle('FRESH', 'WORKSHOP.txt');
    const id = await resolveFileIdentity(file(fresh, 'WORKSHOP.txt'), { handleTimeoutMs: 25 });
    expect(id.historyId).toBe('hist-1');

    // El handle colgado desapareció del registro y quedó sustituido por el nuevo.
    const saved = mem.store.get('hist-1')!;
    expect(saved.handle).toBe(fresh);
    expect(saved.handles).toHaveLength(1);
    expect(saved.handles![0]!.handle).toBe(fresh);

    // La siguiente apertura con el mismo handle ya no espera ningún timeout.
    const again = await resolveFileIdentity(file(fresh, 'WORKSHOP.txt'), { handleTimeoutMs: 25 });
    expect(again).toEqual(id);
  });

  it('purga handles colgados de otros archivos en paralelo sin borrar sus registros de historial', async () => {
    const dead1 = makeHungHandle('uno.txt');
    const dead2 = makeHungHandle('dos.txt');
    const alive = makeHandle('ALIVE', 'dos.txt');
    mem.store.set('h-uno', {
      id: 'h-uno',
      name: 'uno.txt',
      lastOpened: 100,
      handle: dead1,
      handles: [{ key: 'h-uno', handle: dead1 }],
    });
    mem.store.set('h-dos', {
      id: 'h-dos',
      name: 'dos.txt',
      lastOpened: 200,
      handle: dead2,
      handles: [
        { key: 'k-alive', handle: alive },
        { key: 'k-dead', handle: dead2 },
      ],
    });

    const fresh = makeHandle('NEW', 'tres.txt');
    const started = Date.now();
    const id = await resolveFileIdentity(file(fresh, 'tres.txt'), { handleTimeoutMs: 30 });
    expect(Date.now() - started).toBeLessThan(200);
    expect(id.historyId).toBeTruthy();

    // `uno.txt` perdió su handle roto pero conserva su id de historial.
    const uno = mem.store.get('h-uno')!;
    expect(uno.id).toBe('h-uno');
    expect(uno.handle).toBeUndefined();
    expect(uno.handles).toBeUndefined();

    // `dos.txt` conserva solo el handle vivo.
    const dos = mem.store.get('h-dos')!;
    expect(dos.handle).toBe(alive);
    expect(dos.handles).toEqual([{ key: 'k-alive', handle: alive }]);
  });
});

describe('lastFile y forgetFile', () => {
  beforeEach(() => mem.store.clear());

  it('lastFile descarta handles colgados sin borrar el historial y devuelve el último vivo', async () => {
    const alive = makeHandle('ALIVE', 'viejo.txt');
    const dead = makeHungHandle('nuevo.txt');
    mem.store.set('h-old', {
      id: 'h-old',
      name: 'viejo.txt',
      lastOpened: 100,
      handle: alive,
      handles: [{ key: 'h-old', handle: alive }],
    });
    mem.store.set('h-new', {
      id: 'h-new',
      name: 'nuevo.txt',
      lastOpened: 200,
      handle: dead,
      handles: [{ key: 'h-new', handle: dead }],
    });

    const rec = await lastFile({ handleTimeoutMs: 25 });
    expect(rec?.id).toBe('h-old');
    // El registro del archivo con handle colgado sigue en la BD (para el historial), ya sin handle.
    const pruned = mem.store.get('h-new')!;
    expect(pruned.id).toBe('h-new');
    expect(pruned.name).toBe('nuevo.txt');
    expect(pruned.handle).toBeUndefined();
    expect(pruned.handles).toBeUndefined();
  });

  it('forgetFile olvida los handles pero conserva el registro de historial', async () => {
    const h = makeHandle('A', 'notas.txt');
    mem.store.set('h-notas', {
      id: 'h-notas',
      name: 'notas.txt',
      lastOpened: 100,
      handle: h,
      handles: [{ key: 'h-notas', handle: h }],
    });

    await forgetFile('h-notas');
    expect(await lastFile()).toBeNull();

    // Reabrir por nombre recupera el mismo historyId.
    const reopened = await resolveFileIdentity(file(makeHandle('B', 'notas.txt'), 'notas.txt'));
    expect(reopened.historyId).toBe('h-notas');
  });
});

describe('FsAccessAdapter.ensurePermission', () => {
  it('rechaza tras el timeout si queryPermission se queda colgado', async () => {
    await expect(FsAccessAdapter.ensurePermission(makeHungHandle(), 25)).rejects.toThrow(/timeout/i);
  });

  it('pide permiso si queryPermission devuelve prompt', async () => {
    const requestPermission = vi.fn(async () => 'granted' as const);
    const h = {
      queryPermission: async () => 'prompt' as const,
      requestPermission,
    } as unknown as FileSystemFileHandle;

    expect(await FsAccessAdapter.ensurePermission(h, 25)).toBe(true);
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });
});
