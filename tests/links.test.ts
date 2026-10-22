import { describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { linkCursor, linkIntegrity, linkSelection } from '../src/editor/links';
import { findLinks, isPastableUrl, linkHref, markdownLink, stripLinks } from '../src/text/conventions';
import { countWords } from '../src/text/words';

describe('enlaces Markdown [texto](url)', () => {
  it('findLinks da las posiciones del enlace, su texto y su URL', () => {
    const line = 'Mira [esta web](https://x.org/a) ya';
    const [l] = findLinks(line);
    expect(l).toBeDefined();
    expect(line.slice(l!.from, l!.to)).toBe('[esta web](https://x.org/a)');
    expect(line.slice(l!.textFrom, l!.textTo)).toBe('esta web');
    expect(line.slice(l!.urlFrom, l!.urlTo)).toBe('https://x.org/a');
    expect(l!.href).toBe('https://x.org/a');
  });

  it('varios enlaces en una línea; sin texto, con espacios en la URL o entre líneas no son enlaces', () => {
    expect(findLinks('[a](x.org) y [b](www.y.org)').map((l) => l.href)).toEqual(['https://x.org', 'https://www.y.org']);
    expect(findLinks('[](https://x.org)')).toEqual([]);
    expect(findLinks('[a](https://x.org/b c)')).toEqual([]);
    expect(findLinks('[a\nb](https://x.org)')).toEqual([]);
  });

  it('linkHref solo deja pasar esquemas seguros', () => {
    expect(linkHref('https://x.org')).toBe('https://x.org');
    expect(linkHref('mailto:a@b.es')).toBe('mailto:a@b.es');
    expect(linkHref('x.org/a')).toBe('https://x.org/a');
    expect(linkHref('javascript:alert(1)')).toBeNull();
    expect(linkHref('data:text/html,hola')).toBeNull();
    expect(findLinks('[malo](javascript:void)')).toEqual([]);
  });

  it('markdownLink codifica los paréntesis de la URL', () => {
    const md = markdownLink('Folio', 'https://es.wikipedia.org/wiki/Folio_(papel)');
    expect(md).toBe('[Folio](https://es.wikipedia.org/wiki/Folio_%28papel%29)');
    expect(findLinks(md)).toHaveLength(1);
  });

  it('isPastableUrl acepta una sola URL', () => {
    expect(isPastableUrl('https://x.org/a?b=1')).toBe(true);
    expect(isPastableUrl('www.x.org')).toBe(true);
    expect(isPastableUrl('mailto:a@b.es')).toBe(true);
    expect(isPastableUrl('hola https://x.org')).toBe(false);
    expect(isPastableUrl('x.org')).toBe(false);
  });

  it('stripLinks y el contador de palabras solo ven el texto del enlace', () => {
    expect(stripLinks('ver [esta web](https://x.org/a/b) hoy')).toBe('ver esta web hoy');
    expect(countWords('ver [esta web](https://x.org/a/b) hoy')).toBe(4);
  });
});

describe('pegar una URL sobre una selección', () => {
  // Con los mismos filtros que el editor real (protección de la sintaxis y cursor junto a enlaces):
  // sin ellos, una regresión en la que la protección deshace el cambio de URL pasaría inadvertida.
  const paste = (doc: string, ranges: Array<[number, number]>, url = 'https://x.org/(a)') => {
    const state = EditorState.create({
      doc,
      selection: EditorSelection.create(ranges.map(([a, b]) => EditorSelection.range(a, b))),
      extensions: [EditorState.allowMultipleSelections.of(true), linkIntegrity, linkCursor],
    });
    const spec = linkSelection(state, url);
    if (!spec) return null;
    const next = state.update(spec).state;
    return { doc: next.doc.toString(), head: next.selection.main.head };
  };

  it('convierte la palabra seleccionada en [palabra](url) y deja el cursor tras el enlace', () => {
    const r = paste('hola mundo', [[5, 10]]);
    expect(r!.doc).toBe('hola [mundo](https://x.org/%28a%29)');
    expect(r!.head).toBe(r!.doc.length);
  });

  it('los espacios de los bordes de la selección quedan fuera del enlace', () => {
    expect(paste('hola mundo', [[4, 10]])!.doc).toBe('hola [mundo](https://x.org/%28a%29)');
  });

  it('dentro del texto de un enlace, cambia su URL y deja el cursor tras el enlace', () => {
    const r = paste('ver [web](https://viejo.org) ya', [[5, 8]], 'https://nuevo.org');
    expect(r!.doc).toBe('ver [web](https://nuevo.org) ya');
    expect(r!.head).toBe('ver [web](https://nuevo.org)'.length);
    // También con una selección parcial del texto y junto a otro enlace nuevo.
    expect(
      paste(
        'uno [dos](https://a.org)',
        [
          [0, 3],
          [6, 7],
        ],
        'https://b.org',
      )!.doc,
    ).toBe('[uno](https://b.org) [dos](https://b.org)');
  });

  it('pegado normal si no hay selección, ocupa varias líneas, tiene corchetes o pisa un enlace a medias', () => {
    expect(paste('hola', [[2, 2]])).toBeNull();
    expect(paste('uno\ndos', [[0, 7]])).toBeNull();
    expect(paste('a [b] c', [[0, 7]])).toBeNull();
    expect(paste('x [web](https://a.org) y', [[0, 6]])).toBeNull();
    expect(paste('   ', [[0, 3]])).toBeNull();
  });

  it('con varias selecciones, enlaza cada una', () => {
    expect(
      paste(
        'uno dos',
        [
          [0, 3],
          [4, 7],
        ],
        'https://x.org',
      )!.doc,
    ).toBe('[uno](https://x.org) [dos](https://x.org)');
  });
});

describe('la sintaxis oculta de un enlace no se rompe al editar', () => {
  // "Mira [esta web](https://x.org) hoy": [ en 5, texto 6–14, ) acaba en 30.
  const DOC = 'Mira [esta web](https://x.org) hoy';
  const A = DOC.indexOf('[');
  const TF = A + 1;
  const TT = DOC.indexOf('](');
  const B = DOC.indexOf(')') + 1;

  /** Aplica un cambio como lo haría el usuario y devuelve el documento y el cursor resultantes. */
  const edit = (from: number, to: number, userEvent: string, insert = '', head = to) => {
    const state = EditorState.create({ doc: DOC, selection: { anchor: head }, extensions: [linkIntegrity] });
    const next = state.update({ changes: { from, to, insert }, userEvent }).state;
    return { doc: next.doc.toString(), head: next.selection.main.head };
  };

  it('Retroceso justo detrás del enlace borra la última letra de su texto (no el «)»)', () => {
    // CodeMirror borra todo el «](url)» atómico; el filtro lo cambia por la «b» de «web».
    const r = edit(TT, B, 'delete.backward', '', B);
    expect(r.doc).toBe('Mira [esta we](https://x.org) hoy');
    expect(r.head).toBe(B - 1); // sigue justo detrás del enlace
  });

  it('Suprimir justo delante borra la primera letra; Retroceso al principio del texto, la anterior al enlace', () => {
    expect(edit(A, TF, 'delete.forward', '', A).doc).toBe('Mira [sta web](https://x.org) hoy');
    expect(edit(A, TF, 'delete.backward', '', TF).doc).toBe('Mira[esta web](https://x.org) hoy');
    expect(edit(TT, B, 'delete.forward', '', TT).doc).toBe('Mira [esta web](https://x.org)hoy');
  });

  it('borrar todo el texto (o su última letra) borra el enlace entero', () => {
    const one = 'a [x](https://x.org) b';
    const state = EditorState.create({ doc: one, extensions: [linkIntegrity] });
    const tt = one.indexOf('](');
    const b = one.indexOf(')') + 1;
    expect(state.update({ changes: { from: tt, to: b }, userEvent: 'delete.backward' }).state.doc.toString()).toBe(
      'a  b',
    );
    expect(edit(TF, TT, 'delete.backward').doc).toBe('Mira  hoy');
  });

  it('borrar por palabras desde detrás del enlace deja el enlace con lo que queda de texto', () => {
    // Alt+Retroceso: CodeMirror borra «web» y el «](url)» atómico.
    expect(edit(DOC.indexOf('web'), B, 'delete.backward').doc).toBe('Mira [esta ](https://x.org) hoy');
  });

  it('una selección que pisa el enlace a medias borra lo que se ve y conserva la sintaxis', () => {
    // Seleccionado «web ho» (visible) = de la «w» a la «o», pasando por el «](url)» oculto.
    const from = DOC.indexOf('web');
    const to = DOC.indexOf('hoy') + 2;
    expect(edit(from, to, 'delete.backward').doc).toBe('Mira [esta ](https://x.org)y');
    // Escribir encima: lo tecleado queda detrás del enlace, con el cursor tras ello.
    const r = edit(from, to, 'input.type', 'X');
    expect(r.doc).toBe('Mira [esta ](https://x.org)Xy');
    expect(r.head).toBe(r.doc.indexOf('X') + 1);
  });

  it('deshacer, cargar del disco y otras transacciones que no son del usuario pasan tal cual', () => {
    expect(edit(TT, B, 'undo').doc).toBe('Mira [esta web hoy');
    const state = EditorState.create({ doc: DOC, extensions: [linkIntegrity] });
    expect(state.update({ changes: { from: TT, to: B } }).state.doc.toString()).toBe('Mira [esta web hoy');
  });
});

describe('el cursor junto a un enlace siempre avanza una letra visible', () => {
  const DOC = 'ab [cd](https://x.org) ef';
  const A = DOC.indexOf('[');
  const TF = A + 1;
  const TT = DOC.indexOf('](');
  const B = DOC.indexOf(')') + 1;
  /** Mueve el cursor como las flechas (`select`) o como un clic (`select.pointer`). */
  const move = (from: number, to: number, userEvent = 'select') =>
    EditorState.create({ doc: DOC, selection: { anchor: from }, extensions: [linkCursor] }).update({
      selection: { anchor: to },
      userEvent,
    }).state.selection.main.head;

  it('hacia la derecha: de delante del enlace a tras su primera letra; de antes de la última a detrás del enlace', () => {
    expect(move(A, TF)).toBe(TF + 1);
    expect(move(TT - 1, TT)).toBe(B);
  });

  it('hacia la izquierda: de detrás del enlace a antes de su última letra; de tras la primera a delante', () => {
    expect(move(B, TT)).toBe(TT - 1);
    expect(move(TF + 1, TF)).toBe(A);
  });

  it('con un clic en un borde, el cursor queda fuera del enlace, venga de donde venga', () => {
    expect(move(0, TF, 'select.pointer')).toBe(A);
    expect(move(DOC.length, TT, 'select.pointer')).toBe(B);
    expect(move(0, TT, 'select.pointer')).toBe(B);
  });
});
