import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_INTERVAL_MS,
  HISTORY_KEEP,
  VersionHistory,
  listVersions,
  saveVersion,
  saveVersionIfDue,
  sha256,
  versionFileName,
} from '../src/persistence/backups';
import { getDB, resetDBForTests } from '../src/persistence/db';

/** Borra la BD entre tests: cierra la conexión viva y la elimina. */
async function clearDB(): Promise<void> {
  await resetDBForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('to-do');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('deleteDatabase bloqueado'));
  });
  await resetDBForTests();
}

const T0 = new Date('2026-09-11T10:00:00').getTime();
const HOUR = 60 * 60 * 1000;

describe('historial de versiones', () => {
  beforeEach(clearDB);

  it('guarda la primera versión y no otra hasta pasada una hora', async () => {
    expect(await saveVersionIfDue('id1', 'v1', T0)).not.toBeNull();
    expect(await saveVersionIfDue('id1', 'v2', T0 + 30 * 60_000)).toBeNull();
    expect(await saveVersionIfDue('id1', 'v2', T0 + HOUR - 1)).toBeNull();
    expect(await saveVersionIfDue('id1', 'v2', T0 + HOUR)).not.toBeNull();
    const all = await listVersions('id1');
    expect(all.map((v) => v.text)).toEqual(['v2', 'v1']); // más reciente primero
  });

  it('al abrir tras más de una hora se guarda una versión de inmediato', async () => {
    await saveVersion('id1', 'ayer', T0);
    // «Apertura» al día siguiente: hace más de una hora de la última → se guarda ya.
    expect(await saveVersionIfDue('id1', 'hoy', T0 + 24 * HOUR)).not.toBeNull();
    expect(await listVersions('id1')).toHaveLength(2);
  });

  it('no guarda si el hash del texto coincide con el de la versión más reciente (ni automática ni manual)', async () => {
    const first = await saveVersion('id1', 'igual', T0);
    expect(first?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await saveVersionIfDue('id1', 'igual', T0 + 2 * HOUR)).toBeNull();
    expect(await saveVersion('id1', 'igual', T0 + 3 * HOUR)).toBeNull(); // manual
    expect(await listVersions('id1')).toHaveLength(1);
  });

  it('compara solo con la más reciente: volver a un texto anterior sí genera versión', async () => {
    await saveVersion('id1', 'a', T0);
    await saveVersion('id1', 'b', T0 + 1000);
    expect(await saveVersion('id1', 'a', T0 + 2000)).not.toBeNull();
    expect(await listVersions('id1')).toHaveLength(3);
  });

  it('saveVersion guarda aunque no haya pasado una hora si el texto cambió', async () => {
    await saveVersion('id1', 'x', T0);
    await saveVersion('id1', 'y', T0 + 1000);
    expect(await listVersions('id1')).toHaveLength(2);
  });

  it('sha256 es determinista y sensible a cualquier cambio', async () => {
    expect(await sha256('hola')).toBe(await sha256('hola'));
    expect(await sha256('hola')).not.toBe(await sha256('hola '));
    expect(await sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('conserva solo las HISTORY_KEEP más recientes', async () => {
    for (let i = 0; i < HISTORY_KEEP + 3; i++) await saveVersion('id1', `texto ${i}`, T0 + i * HOUR);
    const all = await listVersions('id1');
    expect(all).toHaveLength(HISTORY_KEEP);
    expect(all[0]!.text).toBe(`texto ${HISTORY_KEEP + 2}`);
    expect(all.at(-1)!.text).toBe('texto 3');
  });

  it('las versiones de archivos distintos no se mezclan', async () => {
    await saveVersion('id1', 'del uno', T0);
    await saveVersion('id2', 'del dos', T0);
    expect(await listVersions('id1')).toHaveLength(1);
    expect(await listVersions('id2')).toHaveLength(1);
  });

  it('cuenta las palabras de las tabs', async () => {
    const v = await saveVersion('id1', 'una dos tres', T0);
    expect(v?.words).toBe(3);
  });

  it('versionFileName sugiere <nombre> — <fecha> <hora>.txt (también para un .md antiguo)', () => {
    const ts = new Date('2026-09-11T14:05:00').getTime();
    expect(versionFileName('to-do.txt', { ts })).toBe('to-do — 2026-09-11 14.05.txt');
    expect(versionFileName('to-do.md', { ts })).toBe('to-do — 2026-09-11 14.05.txt');
    expect(versionFileName('notas', { ts })).toBe('notas — 2026-09-11 14.05.txt');
  });

  describe('VersionHistory (temporizador de sesión)', () => {
    // Sin fake timers: fake-indexeddb necesita los reales. El reloj se inyecta y el temporizador se
    // comprueba espiando setInterval.
    afterEach(() => vi.restoreAllMocks());

    it('con la aplicación abierta tres horas guarda tres versiones', async () => {
      let clock = T0;
      let text = 'apertura';
      const h = new VersionHistory('id1', () => text, { now: () => clock });
      await h.saveIfDue(); // apertura
      for (let i = 1; i <= 3; i++) {
        clock += HISTORY_INTERVAL_MS; // pasa una hora…
        text = `hora ${i}`;
        await h.saveIfDue(); // …y salta el temporizador
      }
      const all = await listVersions('id1');
      expect(all.map((v) => v.text)).toEqual(['hora 3', 'hora 2', 'hora 1', 'apertura']);
    });

    it('start() programa el guardado cada HISTORY_INTERVAL_MS y dispose() lo cancela', () => {
      const setSpy = vi.spyOn(globalThis, 'setInterval');
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');
      const h = new VersionHistory('id1', () => 'x');
      h.start();
      h.start(); // idempotente
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(setSpy.mock.calls[0]![1]).toBe(HISTORY_INTERVAL_MS);
      h.dispose();
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('saveNow guarda sin esperar, pero no si el texto no ha cambiado', async () => {
      let clock = T0;
      let text = 'ahora';
      const h = new VersionHistory('id1', () => text, { now: () => clock });
      expect(await h.saveNow()).not.toBeNull();
      clock += 1000;
      expect(await h.saveNow()).toBeNull(); // mismo hash
      text = 'después';
      expect(await h.saveNow()).not.toBeNull();
      expect(await listVersions('id1')).toHaveLength(2);
    });
  });

  it('migra las copias de la versión 1 de la BD (clave [todoId, day]) conservándolas', async () => {
    await resetDBForTests();
    // BD antigua tal y como la creaba la v1.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('to-do', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('files', { keyPath: 'id' }).createIndex('lastOpened', 'lastOpened');
        db.createObjectStore('drafts', { keyPath: 'todoId' });
        db.createObjectStore('backups', { keyPath: ['todoId', 'day'] }).createIndex('todoId', 'todoId');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('backups', 'readwrite');
        tx.objectStore('backups').put({ todoId: 'id1', day: '2026-09-10', ts: T0 - 24 * HOUR, text: 'antigua', words: 1 });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const db = await getDB(); // abre en v2 y migra
    expect(db.version).toBe(2);
    const all = await listVersions('id1');
    expect(all).toHaveLength(1);
    expect(all[0]!.text).toBe('antigua');
    expect(all[0]!.ts).toBe(T0 - 24 * HOUR);
    expect(all[0]!.hash).toBeUndefined(); // la v1 no guardaba hash
    // Sin hash guardado, se calcula al vuelo: el mismo texto no genera versión.
    expect(await saveVersion('id1', 'antigua', T0)).toBeNull();
    // Y el store nuevo funciona con la clave por instante.
    await saveVersion('id1', 'nueva', T0);
    expect(await listVersions('id1')).toHaveLength(2);
  });
});
