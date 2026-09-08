import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getDB, resetDBForTests } from '../src/persistence/db';
import { LiveDraft } from '../src/persistence/liveDraft';
import { BACKUP_KEEP, backupFileName, listBackups, localDay, saveOpeningBackup } from '../src/persistence/backups';
import { PersonalDictionary, takeLegacyWords } from '../src/persistence/dictionary';
import { joinDocument, splitDocument, NOTE_TABS } from '../src/persistence/folioBlocks';
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

describe('copias de seguridad de apertura', () => {
  const day = (n: number) => new Date(2026, 8, n, 10, 0, 0).getTime(); // septiembre de 2026, 10:00 local

  it('guarda el texto del disco con su fecha y sus palabras, y lista de la más reciente a la más antigua', async () => {
    expect(await saveOpeningBackup('n1', '# Uno\n\nHola mundo.\n', day(1))).toBe(true);
    expect(await saveOpeningBackup('n1', '# Uno\n\nHola mundo entero.\n\n<!-- folio:notas\nd\n\n[folio:nota 1]\nmuchas palabras de notas\n-->\n', day(2))).toBe(true);
    const list = await listBackups('n1');
    expect(list.map((b) => [b.day, b.words, b.text.length > 0])).toEqual([
      ['2026-09-02', 3, true], // las notas no cuentan
      ['2026-09-01', 2, true],
    ]);
    expect(list[0]!.ts).toBe(day(2));
    expect(localDay(day(2))).toBe('2026-09-02');
    // otra novela no ve estas copias
    expect(await listBackups('n2')).toEqual([]);
  });

  it('una copia por día como mucho: la primera apertura del día', async () => {
    expect(await saveOpeningBackup('n1', 'mañana', day(1))).toBe(true);
    expect(await saveOpeningBackup('n1', 'tarde', day(1) + 6 * 3600_000)).toBe(false);
    expect((await listBackups('n1')).map((b) => b.text)).toEqual(['mañana']);
  });

  it('no guarda un contenido idéntico a una copia existente, aunque sea otro día', async () => {
    expect(await saveOpeningBackup('n1', 'A', day(1))).toBe(true);
    expect(await saveOpeningBackup('n1', 'A', day(2))).toBe(false);
    expect(await saveOpeningBackup('n1', 'B', day(3))).toBe(true);
    expect(await saveOpeningBackup('n1', 'A', day(4))).toBe(false); // vuelve a un estado ya guardado
    expect((await listBackups('n1')).map((b) => b.day)).toEqual(['2026-09-03', '2026-09-01']);
  });

  it(`conserva solo las ${BACKUP_KEEP} copias más recientes`, async () => {
    for (let n = 1; n <= BACKUP_KEEP + 3; n++) expect(await saveOpeningBackup('n1', `texto ${n}`, day(n))).toBe(true);
    const list = await listBackups('n1');
    expect(list).toHaveLength(BACKUP_KEEP);
    expect(list[0]!.text).toBe(`texto ${BACKUP_KEEP + 3}`);
    expect(list.at(-1)!.text).toBe('texto 4');
    // y la de otra novela no se ve afectada
    expect(await saveOpeningBackup('n2', 'otra', day(1))).toBe(true);
    expect(await listBackups('n2')).toHaveLength(1);
    expect(await listBackups('n1')).toHaveLength(BACKUP_KEEP);
  });

  it('nombre de descarga: novela y día', () => {
    expect(backupFileName('mi novela.md', { day: '2026-09-08' })).toBe('mi novela — 2026-09-08.md');
    expect(backupFileName('Otra.markdown', { day: '2026-01-01' })).toBe('Otra — 2026-01-01.md');
    expect(backupFileName('', { day: '2026-01-01' })).toBe('novela — 2026-01-01.md');
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
  const tabs = (...t: string[]) => Array.from({ length: NOTE_TABS }, (_, i) => t[i] ?? '');
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

  it('diez espacios de notas dentro del mismo bloque; los vacíos no se escriben', () => {
    expect(NOTE_TABS).toBe(10);
    const md = joinDocument(doc(novel, tabs('Uno\n', '', 'Tres\n\ncon párrafos\n', '', '', 'Seis', '', '', '', 'Diez')));
    expect(md).toContain('\n\n[folio:nota 1]\nUno\n\n[folio:nota 3]\nTres\n\ncon párrafos\n\n[folio:nota 6]\nSeis\n[folio:nota 10]\nDiez\n-->');
    expect(md).not.toContain('[folio:nota 2]');
    expect(md).not.toContain('[folio:nota 4]');
    expect(md).not.toContain('[folio:nota 5]');
    expect(md).not.toContain('[folio:nota 7]');
    expect(md).not.toContain('[folio:nota 9]');
    expect(splitDocument(md)).toEqual(doc(novel, tabs('Uno\n', '', 'Tres\n\ncon párrafos\n', '', '', 'Seis', '', '', '', 'Diez')));
    // un marcador fuera de rango se ignora
    const over = 'Hola\n\n<!-- folio:notas\nd\n\n[folio:nota 11]\nFuera\n-->\n';
    expect(splitDocument(over).notes).toEqual(tabs());
    // notas antiguas sin marcador de espacio: todo al primero
    const legacy = 'Hola\n\n<!-- folio:notas\nd\n\nTexto suelto\n-->\n';
    expect(splitDocument(legacy).notes).toEqual(tabs('Texto suelto'));
  });

  it('un archivo guardado con seis espacios se abre con diez (los nuevos vacíos) y se reescribe igual', () => {
    const six = `${novel}\n<!-- folio:notas\nd\n\n[folio:nota 1]\nUno\n[folio:nota 6]\nSeis\n-->\n`;
    const parsed = splitDocument(six);
    expect(parsed.notes).toHaveLength(NOTE_TABS);
    expect(parsed.notes).toEqual(tabs('Uno', '', '', '', '', 'Seis'));
    // al volver a guardar no aparecen marcadores para los espacios vacíos añadidos
    const md = joinDocument(parsed);
    expect(md).toContain('[folio:nota 1]\nUno\n[folio:nota 6]\nSeis\n-->');
    expect(md).not.toMatch(/\[folio:nota (7|8|9|10)\]/);
    expect(splitDocument(md).notes).toEqual(parsed.notes);
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
    expect(tabTitle('', 5)).toBe('6');
    expect(tabTitle('Escaleta general\n1. Llegada', 0)).toBe('Escaleta');
    expect(tabTitle('# Kaelith: ficha', 1)).toBe('Kaelith');
    expect(tabTitle("d'Artagnan y otros", 1)).toBe("d'Artagnan");
    expect(tabTitle('Supercalifragilístico', 0)).toBe('Supercalifragil…');
  });
});
