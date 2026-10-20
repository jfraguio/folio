import { describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { clipboardContent } from '../src/editor/copy';

/** Estado con la selección dada como pares [anchor, head] (o un cursor si son iguales). */
const copy = (doc: string, ranges: Array<[number, number]>) =>
  clipboardContent(
    EditorState.create({
      doc,
      selection: EditorSelection.create(ranges.map(([a, b]) => EditorSelection.range(a, b))),
      extensions: [EditorState.allowMultipleSelections.of(true)],
    }),
  );

describe('copiar con enlaces', () => {
  const DOC = 'Mira [esta web](https://example.com) hoy';

  it('un enlace entero: markdown en texto plano y <a href> en HTML', () => {
    expect(copy(DOC, [[0, DOC.length]])).toEqual({
      text: DOC,
      html: 'Mira <a href="https://example.com">esta web</a> hoy',
    });
  });

  it('un enlace copiado a medias sigue siendo enlace, también en texto plano', () => {
    const from = DOC.indexOf('esta');
    expect(copy(DOC, [[from, from + 4]])).toEqual({
      text: '[esta](https://example.com)',
      html: '<a href="https://example.com">esta</a>',
    });
    // Desde el texto anterior hasta media palabra del enlace.
    expect(copy(DOC, [[0, from + 4]])).toEqual({
      text: 'Mira [esta](https://example.com)',
      html: 'Mira <a href="https://example.com">esta</a>',
    });
  });

  it('sin enlaces no se toca el portapapeles', () => {
    expect(copy('hola mundo', [[0, 4]])).toBeNull();
    expect(copy(DOC, [[0, 4]])).toBeNull(); // «Mira», fuera del enlace
  });

  it('solo un trozo de la sintaxis (URL desplegada) va tal cual; si es una URL, como enlace', () => {
    const from = DOC.indexOf('https');
    expect(copy(DOC, [[from, from + 'https://example.com'.length]])).toEqual({
      text: 'https://example.com',
      html: '<a href="https://example.com">https://example.com</a>',
    });
    const b = DOC.indexOf('](');
    expect(copy(DOC, [[b, b + 2]])).toBeNull();
  });

  it('las URLs sueltas también van como enlace (las www. con https://)', () => {
    expect(copy('ver www.x.org ya', [[0, 16]])).toEqual({
      text: 'ver www.x.org ya',
      html: 'ver <a href="https://www.x.org">www.x.org</a> ya',
    });
  });

  it('varias líneas van con <br>; sin selección se copia la línea entera, como CodeMirror', () => {
    const doc = 'uno\n[dos](https://d.org)\ntres';
    expect(copy(doc, [[0, doc.length]])!.html).toBe('uno<br><a href="https://d.org">dos</a><br>tres');
    expect(copy(doc, [[6, 6]])).toEqual({
      text: '[dos](https://d.org)',
      html: '<a href="https://d.org">dos</a>',
    });
    expect(copy(doc, [[1, 1]])).toBeNull(); // la línea «uno» no tiene enlaces
  });

  it('escapa el HTML y conserva tabuladores y espacios seguidos', () => {
    const doc = '\t<b> & [a "b"](https://x.org/?q=1&r=2)  fin';
    expect(copy(doc, [[0, doc.length]])!.html).toBe(
      '&nbsp;&nbsp;&nbsp;&nbsp;&lt;b&gt; &amp; <a href="https://x.org/?q=1&amp;r=2">a &quot;b&quot;</a> &nbsp;fin',
    );
  });

  it('un enlace con esquema peligroso no se convierte', () => {
    expect(copy('[x](javascript:alert)', [[0, 21]])).toBeNull();
  });

  it('varias selecciones se unen con saltos de línea', () => {
    const doc = '[a](https://a.org) b [c](https://c.org)';
    expect(
      copy(doc, [
        [0, 18],
        [21, doc.length],
      ]),
    ).toEqual({
      text: '[a](https://a.org)\n[c](https://c.org)',
      html: '<a href="https://a.org">a</a><br><a href="https://c.org">c</a>',
    });
  });
});
