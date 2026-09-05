import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getDB, resetDBForTests } from '../src/persistence/db';
import { LiveDraft } from '../src/persistence/liveDraft';
import { PersonalDictionary, takeLegacyWords } from '../src/persistence/dictionary';
import { joinDocument, splitDocument } from '../src/persistence/folioBlocks';
import { markdownToTxt } from '../src/export/toTxt';
import { tabTitle } from '../src/ui/Notes';

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

describe('bloques de Folio en el .md (notas y diccionario)', () => {
  const novel = '# Capítulo 1\n\nKaelith miró a Aldebarán.\n';
  const tabs = (a = '', b = '', c = '') => [a, b, c];
  const doc = (body: string, notes: string | string[] = '', words: string[] = []) => ({
    body,
    notes: typeof notes === 'string' ? tabs(notes) : notes,
    words,
  });

  it('sin notas ni palabras el archivo no cambia', () => {
    expect(joinDocument(doc(novel))).toBe(novel);
    expect(joinDocument(doc(novel, tabs('   \n', '', '\n')))).toBe(novel);
    expect(splitDocument(novel)).toEqual(doc(novel));
  });

  it('serializa el diccionario como comentario HTML al final y lo recupera', () => {
    const md = joinDocument(doc(novel, '', ['Aldebarán', 'Kaelith']));
    expect(md.startsWith(novel + '\n<!-- folio:diccionario\n')).toBe(true);
    expect(md.endsWith('\n\nAldebarán\nKaelith\n-->\n')).toBe(true);
    expect(splitDocument(md)).toEqual(doc(novel, '', ['Aldebarán', 'Kaelith']));
  });

  it('serializa las notas antes del diccionario y recupera ambos', () => {
    const notes = 'Escaleta\n\n1. Llegada\n2. Huida\n';
    const md = joinDocument(doc(novel, notes, ['Kaelith']));
    expect(md.indexOf('<!-- folio:notas')).toBeLessThan(md.indexOf('<!-- folio:diccionario'));
    expect(splitDocument(md)).toEqual(doc(novel, notes, ['Kaelith']));
    // solo notas
    expect(splitDocument(joinDocument(doc(novel, notes)))).toEqual(doc(novel, notes));
  });

  it('tres espacios de notas dentro del mismo bloque; los vacíos no se escriben', () => {
    const md = joinDocument(doc(novel, tabs('Uno\n', '', 'Tres\n\ncon párrafos')));
    expect(md).toContain('\n\n[folio:nota 1]\nUno\n\n[folio:nota 3]\nTres\n\ncon párrafos\n-->');
    expect(md).not.toContain('[folio:nota 2]');
    expect(splitDocument(md)).toEqual(doc(novel, tabs('Uno\n', '', 'Tres\n\ncon párrafos')));
    // notas antiguas sin marcador de espacio: todo al primero
    const legacy = 'Hola\n\n<!-- folio:notas\nd\n\nTexto suelto\n-->\n';
    expect(splitDocument(legacy).notes).toEqual(tabs('Texto suelto'));
  });

  it('las notas pueden contener "-->" sin romper el comentario', () => {
    const notes = 'a --> b';
    const md = joinDocument(doc(novel, notes));
    expect(md.indexOf('-->')).toBe(md.lastIndexOf('-->'));
    expect(splitDocument(md).notes).toEqual(tabs(notes));
    expect(markdownToTxt(md)).toBe('Capítulo 1\n\nKaelith miró a Aldebarán.\n');
  });

  it('el texto sin salto final se separa igual y el resultado es estable', () => {
    const md = joinDocument(doc('Texto', 'n', ['a']));
    const once = splitDocument(md);
    expect(once).toEqual(doc('Texto\n', 'n', ['a']));
    expect(joinDocument(once)).toBe(md);
    expect(splitDocument(joinDocument(doc('', 'n', ['a'])))).toEqual(doc('', 'n', ['a']));
  });

  it('en el diccionario ignora la descripción, líneas vacías y espacios', () => {
    const md = 'Hola\n\n<!-- folio:diccionario\nEsto es una descripción con espacios.\n\n  Uno  \n\nDos\n-->\n';
    expect(splitDocument(md)).toEqual(doc('Hola\n', '', ['Uno', 'Dos']));
  });

  it('un bloque que no está al final o no está cerrado se trata como texto normal', () => {
    const mid = '<!-- folio:diccionario\nUno\n-->\n\nMás texto.\n';
    expect(splitDocument(mid)).toEqual(doc(mid));
    const open = 'Hola\n\n<!-- folio:notas\n\nUno\n';
    expect(splitDocument(open)).toEqual(doc(open));
    // notas después del diccionario: orden incorrecto, las notas quedan como texto
    const swapped = joinDocument(doc(joinDocument(doc('Hola', '', ['a'])), 'n'));
    expect(splitDocument(swapped).words).toEqual([]);
  });

  it('la exportación a TXT no incluye ningún bloque', () => {
    const md = joinDocument(doc(novel, 'Notas secretas', ['Aldebarán', 'Kaelith']));
    expect(markdownToTxt(md)).toBe('Capítulo 1\n\nKaelith miró a Aldebarán.\n');
  });
});

describe('título de pestaña de notas', () => {
  it('primera palabra de la nota o su número', () => {
    expect(tabTitle('', 0)).toBe('1');
    expect(tabTitle('  \n\n', 2)).toBe('3');
    expect(tabTitle('Escaleta general\n1. Llegada', 0)).toBe('Escaleta');
    expect(tabTitle('# Kaelith: ficha', 1)).toBe('Kaelith');
    expect(tabTitle("d'Artagnan y otros", 1)).toBe("d'Artagnan");
    expect(tabTitle('Supercalifragilístico', 0)).toBe('Supercalifragil…');
  });
});
