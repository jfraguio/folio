import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getDB, resetDBForTests } from '../src/persistence/db';
import { LiveDraft } from '../src/persistence/liveDraft';
import { PersonalDictionary, takeLegacyWords } from '../src/persistence/dictionary';
import { joinDictionaryBlock, splitDictionaryBlock } from '../src/persistence/dictionaryBlock';
import { markdownToTxt } from '../src/export/toTxt';

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
  it('añade, elimina, ordena y notifica', () => {
    const d = new PersonalDictionary();
    const seen: string[][] = [];
    d.onChange((w) => seen.push(w));
    d.load(['Zaratustra']);
    expect(d.add('Folio')).toBe(true);
    expect(d.add('Folio')).toBe(false); // duplicado: sin cambio
    expect(d.add('dos palabras')).toBe(false);
    expect(d.has('Folio')).toBe(true);
    expect(d.list()).toEqual(['Folio', 'Zaratustra']);
    d.remove('Zaratustra');
    expect(d.list()).toEqual(['Folio']);
    expect(seen).toEqual([['Folio', 'Zaratustra'], ['Folio']]);
  });

  it('migra y borra las palabras heredadas de IndexedDB', async () => {
    const db = await getDB();
    await db.put('dictionary', { lang: 'es', words: ['Kaelith'] });
    expect(await takeLegacyWords('es')).toEqual(['Kaelith']);
    expect(await takeLegacyWords('es')).toEqual([]);
  });
});

describe('bloque del diccionario en el .md', () => {
  const novel = '# Capítulo 1\n\nKaelith miró a Aldebarán.\n';

  it('sin palabras el archivo no cambia', () => {
    expect(joinDictionaryBlock(novel, [])).toBe(novel);
    expect(splitDictionaryBlock(novel)).toEqual({ body: novel, words: [] });
  });

  it('serializa como comentario HTML al final y recupera texto y palabras', () => {
    const md = joinDictionaryBlock(novel, ['Aldebarán', 'Kaelith']);
    expect(md.startsWith(novel + '\n<!-- folio:diccionario\n')).toBe(true);
    expect(md.endsWith('\nAldebarán\nKaelith\n-->\n')).toBe(true);
    expect(splitDictionaryBlock(md)).toEqual({ body: novel, words: ['Aldebarán', 'Kaelith'] });
  });

  it('el texto sin salto final se separa igual y el resultado es estable', () => {
    const md = joinDictionaryBlock('Texto', ['a']);
    const once = splitDictionaryBlock(md);
    expect(once).toEqual({ body: 'Texto\n', words: ['a'] });
    expect(joinDictionaryBlock(once.body, once.words)).toBe(md);
    expect(splitDictionaryBlock(joinDictionaryBlock('', ['a']))).toEqual({ body: '', words: ['a'] });
  });

  it('ignora la descripción, líneas vacías y espacios; tolera CRLF ya normalizado', () => {
    const md = 'Hola\n\n<!-- folio:diccionario\nEsto es una descripción con espacios.\n\n  Uno  \n\nDos\n-->\n';
    expect(splitDictionaryBlock(md)).toEqual({ body: 'Hola\n', words: ['Uno', 'Dos'] });
  });

  it('un bloque que no está al final o no está cerrado se trata como texto normal', () => {
    const mid = '<!-- folio:diccionario\nUno\n-->\n\nMás texto.\n';
    expect(splitDictionaryBlock(mid)).toEqual({ body: mid, words: [] });
    const open = 'Hola\n\n<!-- folio:diccionario\nUno\n';
    expect(splitDictionaryBlock(open)).toEqual({ body: open, words: [] });
  });

  it('la exportación a TXT no incluye el bloque', () => {
    const md = joinDictionaryBlock(novel, ['Aldebarán', 'Kaelith']);
    expect(markdownToTxt(md)).toBe('Capítulo 1\n\nKaelith miró a Aldebarán.\n');
  });
});
