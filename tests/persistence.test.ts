import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { resetDBForTests } from '../src/persistence/db';
import { LiveDraft } from '../src/persistence/liveDraft';
import { PersonalDictionary } from '../src/persistence/dictionary';

beforeEach(() => {
  // Base de datos limpia por test.
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDBForTests();
});

describe('LiveDraft', () => {
  it('persiste el último texto y se puede limpiar', async () => {
    const d = new LiveDraft('n1');
    d.schedule('uno');
    d.schedule('dos');
    await d.flush();
    expect((await LiveDraft.read('n1'))?.text).toBe('dos');
    await d.clear();
    expect(await LiveDraft.read('n1')).toBeUndefined();
  });
});

describe('PersonalDictionary', () => {
  it('añade, elimina y persiste palabras', async () => {
    const d = new PersonalDictionary('es');
    await d.load();
    await d.add('Folio');
    await d.add('Zaratustra');
    expect(d.has('Folio')).toBe(true);
    await d.add('Nuevo');
    expect(d.list()).toEqual(['Folio', 'Nuevo', 'Zaratustra']);
    await d.remove('Nuevo');

    const again = new PersonalDictionary('es');
    await again.load();
    expect(again.list()).toEqual(['Folio', 'Zaratustra']);

    const en = new PersonalDictionary('en');
    await en.load();
    expect(en.list()).toEqual([]);
  });
});
