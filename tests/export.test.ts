import { describe, expect, it } from 'vitest';
import { markdownToTxt } from '../src/export/toTxt';
import { replacementFor, paragraphBreakFor } from '../src/editor/typography';
import { EditorState } from '@codemirror/state';
import { normalizeText } from '../src/fs/FileAdapter';

describe('markdownToTxt', () => {
  it('convierte encabezados, énfasis y separadores', () => {
    const md = '# Capítulo 1\n\nEl *hombre* llegó **tarde**.\n\n***\n\nOtra escena.\n\n# Capítulo 2\n\nFin.\n';
    expect(markdownToTxt(md)).toBe(
      'Capítulo 1\n\nEl hombre llegó tarde.\n\n* * *\n\nOtra escena.\n\n\nCapítulo 2\n\nFin.\n',
    );
  });

  it('mantiene los saltos de línea duros dentro de un párrafo', () => {
    expect(markdownToTxt('uno  \ndos')).toBe('uno\ndos\n');
  });

  it('H2 no añade la línea extra de los capítulos', () => {
    expect(markdownToTxt('# A\n\nx\n\n## B\n\ny')).toBe('A\n\nx\n\nB\n\ny\n');
  });

  it('descarta HTML y conserva texto de enlaces', () => {
    expect(markdownToTxt('<div>no</div>\n\nver [aquí](http://x)')).toBe('ver aquí\n');
  });
});

describe('tipografía española', () => {
  it('-- se convierte en raya', () => {
    expect(replacementFor('texto -', '-')).toEqual({ insert: '—', deleteBack: 1 });
    expect(replacementFor('texto', '-')).toBeNull();
  });
  it('comillas de apertura y cierre según contexto', () => {
    expect(replacementFor('', '"')).toEqual({ insert: '«', deleteBack: 0 });
    expect(replacementFor('dijo ', '"')).toEqual({ insert: '«', deleteBack: 0 });
    expect(replacementFor('hola', '"')).toEqual({ insert: '»', deleteBack: 0 });
  });
  it('tres puntos → puntos suspensivos', () => {
    expect(replacementFor('y..', '.')).toEqual({ insert: '…', deleteBack: 2 });
    expect(replacementFor('y.', '.')).toBeNull();
  });
});

describe('asistencia literaria: Enter', () => {
  const st = (doc: string) => EditorState.create({ doc });
  it('crea un párrafo nuevo (línea en blanco) al final de una línea con texto', () => {
    expect(paragraphBreakFor(st('Hola.'), 5, 5)).toBe('\n\n');
  });
  it('en mitad de una línea también separa en párrafos', () => {
    expect(paragraphBreakFor(st('Hola mundo'), 4, 4)).toBe('\n\n');
  });
  it('en una línea vacía añade solo un salto', () => {
    expect(paragraphBreakFor(st('Hola.\n\n'), 7, 7)).toBe('\n');
  });
  it('con selección reemplaza por un párrafo nuevo', () => {
    expect(paragraphBreakFor(st('Hola mundo'), 2, 7)).toBe('\n\n');
  });
});

describe('normalizeText', () => {
  it('quita BOM y normaliza CRLF', () => {
    expect(normalizeText('\uFEFFa\r\nb\rc')).toBe('a\nb\nc');
  });
});

describe('prettyShortcut', () => {
  it('formatea modificadores y teclas especiales', async () => {
    const { prettyShortcut, IS_MAC } = await import('../src/app/shortcuts');
    const mod = IS_MAC ? '⌘' : 'Ctrl+';
    expect(prettyShortcut('Mod-k')).toBe(`${mod}K`);
    expect(prettyShortcut('Mod--')).toBe(`${mod}−`);
    expect(prettyShortcut('Mod-=')).toBe(`${mod}+`);
    expect(prettyShortcut('Mod-Shift-f')).toBe(IS_MAC ? '⌘⇧F' : 'Ctrl+Shift+F');
  });
});
