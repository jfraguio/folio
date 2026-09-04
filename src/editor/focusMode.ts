import { RangeSetBuilder, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

const activeLine = Decoration.line({ class: 'cm-active-para' });

export interface ParagraphRange {
  fromLine: number;
  toLine: number;
}

/** Bloque de líneas no vacías contiguas que contiene el cursor. */
export function paragraphAt(state: EditorState, pos: number): ParagraphRange {
  const doc = state.doc;
  const line = doc.lineAt(pos);
  if (line.text.trim() === '') return { fromLine: line.number, toLine: line.number };
  let from = line.number;
  let to = line.number;
  while (from > 1 && doc.line(from - 1).text.trim() !== '') from--;
  while (to < doc.lines && doc.line(to + 1).text.trim() !== '') to++;
  return { fromLine: from, toLine: to };
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.selectionSet || u.docChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView): DecorationSet {
      const b = new RangeSetBuilder<Decoration>();
      const { fromLine, toLine } = paragraphAt(view.state, view.state.selection.main.head);
      for (let n = fromLine; n <= toLine; n++) {
        b.add(view.state.doc.line(n).from, view.state.doc.line(n).from, activeLine);
      }
      return b.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

const focusModeClass = EditorView.editorAttributes.of({ class: 'cm-focus-mode' });

/** El focus mode está siempre activo: es parte de la identidad del editor, no una opción. */
export function focusMode() {
  return [plugin, focusModeClass];
}
