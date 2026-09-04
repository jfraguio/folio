import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { buildIndex, chapterAt } from '../src/editor/chapters';
import { paragraphAt } from '../src/editor/focusMode';
import { countWords } from '../src/text/words';

const state = (doc: string) => EditorState.create({ doc, extensions: [markdown()] });

describe('countWords', () => {
  it('cuenta palabras ignorando encabezados y separadores', () => {
    expect(countWords('# Capítulo 1\n\nEl hombre llegó.\n\n***\n\nNo había nadie.')).toBe(6);
  });
  it('trata apóstrofos y guiones internos como una palabra', () => {
    expect(countWords("l'amour anglo-saxón 1984")).toBe(3);
  });
});

describe('buildIndex', () => {
  it('detecta capítulos H1 con su conteo de palabras', () => {
    const idx = buildIndex(state('# Uno\n\nuna dos tres\n\n# Dos\n\ncuatro cinco\n'));
    expect(idx.chapters.map((c) => [c.title, c.level, c.words])).toEqual([
      ['Uno', 1, 3],
      ['Dos', 1, 2],
    ]);
    expect(idx.totalWords).toBe(5);
  });

  it('anida escenas H2 bajo su capítulo y las cierra en el siguiente H1', () => {
    const idx = buildIndex(state('# Cap\n\nintro\n\n## Escena A\n\na a\n\n## Escena B\n\nb b b\n\n# Otro\n\nz'));
    const titles = idx.chapters.map((c) => `${c.level}:${c.title}:${c.words}`);
    expect(titles).toEqual(['1:Cap:6', '2:Escena A:2', '2:Escena B:3', '1:Otro:1']);
  });

  it('ignora # dentro de bloques de código', () => {
    const idx = buildIndex(state('# Real\n\n```\n# no soy capítulo\n```\n'));
    expect(idx.chapters.map((c) => c.title)).toEqual(['Real']);
  });

  it('añade un capítulo implícito "Inicio" si hay texto antes del primer H1', () => {
    const idx = buildIndex(state('Prólogo suelto.\n\n# Uno\n\nx'));
    expect(idx.chapters[0]).toMatchObject({ title: 'Inicio', implicit: true, words: 2 });
  });

  it('devuelve "Inicio" cuando no hay encabezados', () => {
    const idx = buildIndex(state('solo texto'));
    expect(idx.chapters).toHaveLength(1);
    expect(idx.chapters[0]?.implicit).toBe(true);
  });

  it('el destino de navegación es el primer párrafo tras el encabezado', () => {
    const doc = '# Uno\n\n\nTexto.';
    const idx = buildIndex(state(doc));
    expect(idx.chapters[0]?.target).toBe(doc.indexOf('Texto'));
  });

  it('chapterAt localiza el capítulo por posición', () => {
    const doc = '# A\n\naaa\n\n# B\n\nbbb';
    const idx = buildIndex(state(doc));
    expect(chapterAt(idx, doc.indexOf('bbb'))?.title).toBe('B');
    expect(chapterAt(idx, 2)?.title).toBe('A');
  });
});

describe('paragraphAt', () => {
  it('delimita el bloque de líneas no vacías', () => {
    const doc = 'l1\nl2\n\nl4\nl5\nl6\n\nl8';
    const s = state(doc);
    expect(paragraphAt(s, doc.indexOf('l5'))).toEqual({ fromLine: 4, toLine: 6 });
    expect(paragraphAt(s, doc.indexOf('l1'))).toEqual({ fromLine: 1, toLine: 2 });
    expect(paragraphAt(s, doc.indexOf('l8'))).toEqual({ fromLine: 8, toLine: 8 });
  });
  it('una línea vacía es su propio párrafo', () => {
    const s = state('a\n\nb');
    expect(paragraphAt(s, 2)).toEqual({ fromLine: 2, toLine: 2 });
  });
});

describe('novela nueva', () => {
  it('el destino del capítulo por defecto es el final del documento (deja línea en blanco)', () => {
    const doc = '# Capítulo 1\n\n';
    const idx = buildIndex(state(doc));
    expect(idx.chapters[0]?.target).toBe(doc.length);
  });
});
