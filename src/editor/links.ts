import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

/**
 * Enlaces clicables en el editor. El documento sigue siendo texto plano (no se toca);
 * solo se decoran las URLs visibles para que ⌘/Ctrl+clic las abra en una pestaña nueva.
 * Un clic simple sobre un enlace coloca el cursor con normalidad (no navega).
 */

/** URL web: http(s)://... o www...., hasta un espacio o el final de la línea. */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'()]+/giu;

const linkMark = Decoration.mark({ class: 'cm-link' });

function build(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    URL_RE.lastIndex = 0;
    for (const m of text.matchAll(URL_RE)) {
      const wf = from + m.index!;
      b.add(wf, wf + m[0].length, linkMark);
    }
  }
  return b.finish();
}

/** URL completa bajo una posición del documento (añade https:// a las que empiezan por www.). */
export function urlAt(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos);
  URL_RE.lastIndex = 0;
  for (const m of line.text.matchAll(URL_RE)) {
    const from = line.from + m.index!;
    const to = from + m[0].length;
    if (pos >= from && pos <= to) {
      const raw = m[0];
      return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    }
  }
  return null;
}

export function links() {
  const openOnClick = EditorView.domEventHandlers({
    mousedown(event, view) {
      // Solo ⌘/Ctrl + clic izquierdo sobre un enlace; el resto sigue el comportamiento normal.
      if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) return;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return;
      const url = urlAt(view, pos);
      if (!url) return;
      event.preventDefault();
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  });

  const plugin = ViewPlugin.fromClass(
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

  return [plugin, openOnClick];
}
