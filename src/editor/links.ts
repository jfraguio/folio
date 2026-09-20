import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

/**
 * Enlaces clicables en el editor. El documento sigue siendo texto plano (no se toca);
 * solo se decoran las URLs visibles para que ⌘/Ctrl+clic las abra en una pestaña nueva.
 * Un clic simple sobre un enlace coloca el cursor con normalidad (no navega).
 *
 * En táctil no hay modificadores: un toque sobre un enlace lo abre si el editor no tenía el
 * foco (se está leyendo). Si se estaba escribiendo, el toque coloca el cursor como siempre;
 * para editar una URL basta con tocar antes en cualquier otro punto del texto.
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

/** Abre la URL en una pestaña nueva. Un <a> sintético funciona también desde `touchend` en Safari iOS. */
function openUrl(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function links() {
  /** Toque en curso: dónde empezó y si el editor ya tenía el foco. */
  let touch: { x: number; y: number; focused: boolean } | null = null;

  const openOnClick = EditorView.domEventHandlers({
    mousedown(event, view) {
      // Solo ⌘/Ctrl + clic izquierdo sobre un enlace; el resto sigue el comportamiento normal.
      if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) return;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return;
      const url = urlAt(view, pos);
      if (!url) return;
      event.preventDefault();
      openUrl(url);
    },
    touchstart(event, view) {
      const t = event.touches[0];
      touch = event.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, focused: view.hasFocus } : null;
    },
    touchend(event, view) {
      const start = touch;
      touch = null;
      const t = event.changedTouches[0];
      if (!start || start.focused || !t) return;
      // Un desplazamiento es scroll, no un toque.
      if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 8) return;
      const pos = view.posAtCoords({ x: t.clientX, y: t.clientY });
      if (pos === null) return;
      const url = urlAt(view, pos);
      if (!url) return;
      // Cancela el clic emulado: ni se enfoca el editor ni se levanta el teclado.
      event.preventDefault();
      openUrl(url);
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
