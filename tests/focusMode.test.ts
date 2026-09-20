import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { cursorPlaced, hasActiveParagraph, paragraphAt, setCursorPlaced } from '../src/editor/focusMode';

const DOC = 'Uno\nDos\n\nTres\n   \nCuatro\nCinco';
const state = (doc = DOC, anchor = 0) => EditorState.create({ doc, selection: { anchor }, extensions: [cursorPlaced] });

describe('paragraphAt', () => {
  it('cada línea es un párrafo: un salto de línea separa párrafos aunque no haya línea en blanco', () => {
    const s = state();
    expect(paragraphAt(s, 0)).toEqual({ fromLine: 1, toLine: 1 }); // «Uno»
    expect(paragraphAt(s, s.doc.line(2).from)).toEqual({ fromLine: 2, toLine: 2 }); // «Dos», pegada a «Uno»
    expect(paragraphAt(s, s.doc.line(4).from)).toEqual({ fromLine: 4, toLine: 4 }); // «Tres»
    expect(paragraphAt(s, s.doc.line(7).to)).toEqual({ fromLine: 7, toLine: 7 }); // «Cinco», pegada a «Cuatro»
  });

  it('una línea en blanco (aunque tenga espacios) también es una línea', () => {
    const s = state();
    expect(paragraphAt(s, s.doc.line(3).from)).toEqual({ fromLine: 3, toLine: 3 });
    expect(paragraphAt(s, s.doc.line(5).from)).toEqual({ fromLine: 5, toLine: 5 });
  });
});

describe('cursorPlaced', () => {
  it('arranca sin cursor colocado: al abrir todo el texto se ve completo', () => {
    const s = state();
    expect(s.field(cursorPlaced)).toBe(false);
    expect(hasActiveParagraph(s)).toBe(false);
  });

  it('escribir o borrar coloca el cursor', () => {
    const typed = state().update({ changes: { from: 0, insert: 'a' }, userEvent: 'input.type' }).state;
    expect(typed.field(cursorPlaced)).toBe(true);
    const deleted = state().update({ changes: { from: 0, to: 1 }, userEvent: 'delete.backward' }).state;
    expect(deleted.field(cursorPlaced)).toBe(true);
  });

  it('una selección programática (cambio de tab) coloca el cursor; una del ratón/teclado, no por sí sola', () => {
    const jumped = state().update({ selection: { anchor: 5 } }).state;
    expect(jumped.field(cursorPlaced)).toBe(true);
    const pointer = state().update({ selection: { anchor: 5 }, userEvent: 'select.pointer' }).state;
    expect(pointer.field(cursorPlaced)).toBe(false);
  });

  it('el efecto setCursorPlaced lo pone y lo quita (clic en el texto / en los márgenes)', () => {
    const on = state().update({ effects: setCursorPlaced.of(true) }).state;
    expect(on.field(cursorPlaced)).toBe(true);
    expect(hasActiveParagraph(on)).toBe(true);
    const off = on.update({ effects: setCursorPlaced.of(false) }).state;
    expect(off.field(cursorPlaced)).toBe(false);
    expect(hasActiveParagraph(off)).toBe(false);
  });

  it('con el cursor en una línea en blanco no hay párrafo activo: todo se ve tenue', () => {
    const s = state();
    const blank = s.update({ selection: { anchor: s.doc.line(3).from }, effects: setCursorPlaced.of(true) }).state;
    expect(blank.field(cursorPlaced)).toBe(true);
    expect(hasActiveParagraph(blank)).toBe(false);
  });
});
