import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorView, Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

/** Estilo de sintaxis Markdown: marcadores atenuados, énfasis real, sin colores. */
const highlight = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-md-heading1' },
  { tag: tags.heading2, class: 'cm-md-heading2' },
  { tag: tags.heading3, class: 'cm-md-heading3' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], class: 'cm-md-heading3' },
  { tag: tags.processingInstruction, class: 'cm-md-mark' },
  { tag: tags.emphasis, class: 'cm-md-emphasis' },
  { tag: tags.strong, class: 'cm-md-strong' },
  { tag: tags.contentSeparator, class: 'cm-md-hr' },
]);

const headingLine = Decoration.line({ class: 'cm-md-heading-line' });

/** Añade espacio superior a las líneas de encabezado (decoración de línea, no CSS por hijos). */
const headingLines = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView): DecorationSet {
      const b = new RangeSetBuilder<Decoration>();
      const tree = syntaxTree(view.state);
      for (const { from, to } of view.visibleRanges) {
        tree.iterate({
          from,
          to,
          enter: (n) => {
            if (n.name.startsWith('ATXHeading')) {
              const line = view.state.doc.lineAt(n.from);
              if (line.from > 0) b.add(line.from, line.from, headingLine);
              return false;
            }
            return undefined;
          },
        });
      }
      return b.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

export function folioTheme() {
  return [
    syntaxHighlighting(highlight),
    headingLines,
    EditorView.theme({}),
    EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
  ];
}
