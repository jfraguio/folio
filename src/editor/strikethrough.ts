import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

/**
 * TO-DOs resueltos: una línea que empieza por "--" se muestra tachada entera.
 * El documento sigue siendo texto plano; solo es una decoración visual.
 */

/** Línea resuelta: empieza por "--" (con espacios opcionales delante no; es literal "--..."). */
const DONE_RE = /^--/;

const doneLine = Decoration.line({ class: 'cm-done' });

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
      if (DONE_RE.test(line.text)) b.add(line.from, line.from, doneLine);
      pos = line.to + 1;
    }
  }
  return b.finish();
}
