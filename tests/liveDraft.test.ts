import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LiveDraft } from '../src/persistence/liveDraft';
import { getDB, resetDBForTests } from '../src/persistence/db';

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

describe('LiveDraft', () => {
  beforeEach(clearDB);
  afterEach(async () => {
    await getDB().then((db) => db.close());
    await resetDBForTests();
  });

  it('guarda el texto y el hash de la base al vaciar, y los recupera por la clave', async () => {
    const d = new LiveDraft(
      'fileKey1',
      () => 'con cambios',
      () => 'hash-base',
    );
    d.schedule();
    await d.flush();
    const rec = await LiveDraft.read('fileKey1');
    expect(rec?.text).toBe('con cambios');
    expect(rec?.baseHash).toBe('hash-base');
  });

  it('no serializa en schedule: getText se llama al vaciar', async () => {
    let calls = 0;
    const d = new LiveDraft('k', () => {
      calls++;
      return 'x';
    });
    d.schedule();
    expect(calls).toBe(0);
    await d.flush();
    expect(calls).toBe(1);
  });

  it('clear borra el borrador de esa clave', async () => {
    const d = new LiveDraft('fileKey1', () => 'x');
    d.schedule();
    await d.flush();
    await d.clear();
    expect(await LiveDraft.read('fileKey1')).toBeUndefined();
  });
});
