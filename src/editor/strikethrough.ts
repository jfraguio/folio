import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

/**
 * TO-DOs resueltos: una línea que empieza por "--" (tras espacios o tabulaciones
 * opcionales) se muestra tachada entera. El documento sigue siendo texto plano.
 *
 * Títulos: una línea que empieza por "#" (tras espacios o tabulaciones opcionales)
 * se muestra en el rojo habitual (el de las palabras erróneas).
 */

/** Línea resuelta: "--" tras espacios/tabs opcionales, delante de la primera palabra.
 *  No se tachan las que tienen más de dos guiones ("---", "-------": separadores). */
const DONE_RE = /^[ \t]*--(?!-)/;
/** Línea de título: "#" tras espacios/tabs opcionales. */
const HEADING_RE = /^[ \t]*#/;

const doneLine = Decoration.line({ class: 'cm-done' });
const headingLine = Decoration.line({ class: 'cm-heading' });

/** Cuenta las líneas resueltas (las que empiezan por "--") de un texto. */
export function countDone(text: string): number {
  let n = 0;
  for (const line of text.split('\n')) {
    if (DONE_RE.test(line)) n++;
  }
  return n;
}

export function strikethrough() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

function build(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      // Una línea "--" tiene prioridad sobre una "#" si ambas pudieran coincidir.
      if (DONE_RE.test(line.text)) b.add(line.from, line.from, doneLine);
      else if (HEADING_RE.test(line.text)) b.add(line.from, line.from, headingLine);
      pos = line.to + 1;
    }
  }
  return b.finish();
}
