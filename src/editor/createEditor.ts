import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightSpecialChars, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, insertTab } from '@codemirror/commands';
import { spellCompartment } from './spellcheck';
import { links } from './links';
import { strikethrough } from './strikethrough';

export interface EditorOptions {
  parent: HTMLElement;
  doc: string;
  extra?: Extension[];
  /** Extensión inicial del compartimento de ortografía (vacía si está desactivado). */
  spell?: Extension;
}

export function createEditor(o: EditorOptions): EditorView {
  const state = EditorState.create({
    doc: o.doc,
    extensions: [
      history(),
      drawSelection(),
      highlightSpecialChars(),
      EditorView.lineWrapping,
      // Sin interpretación de Markdown: el texto se muestra tal cual (plano).
      links(),
      strikethrough(),
      EditorState.tabSize.of(4),
      keymap.of([{ key: 'Tab', run: insertTab }, ...defaultKeymap, ...historyKeymap]),
      spellCompartment.of(o.spell ?? []),
      ...(o.extra ?? []),
    ],
  });
  return new EditorView({ state, parent: o.parent });
}
