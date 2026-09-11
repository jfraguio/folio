import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightSpecialChars, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { todoTheme } from './theme';
import { spellCompartment } from './spellcheck';
import { links } from './links';

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
      markdown(),
      todoTheme(),
      links(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      spellCompartment.of(o.spell ?? []),
      ...(o.extra ?? []),
    ],
  });
  return new EditorView({ state, parent: o.parent });
}
