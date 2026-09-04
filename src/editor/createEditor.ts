import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightSpecialChars, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { folioTheme } from './theme';
import { focusMode } from './focusMode';
import { typewriter, typewriterCompartment } from './typewriter';
import { spanishTypography, typographyCompartment } from './typography';
import { spellCompartment } from './spellcheck';
import { prefs } from '../persistence/prefs';

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
      folioTheme(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      focusMode(),
      typewriterCompartment.of(typewriter(prefs.get('typewriter'))),
      typographyCompartment.of(spanishTypography(prefs.get('typographyEs'))),
      spellCompartment.of(o.spell ?? []),
      ...(o.extra ?? []),
    ],
  });
  return new EditorView({ state, parent: o.parent });
}

/** Coloca el cursor y desplaza la vista dejando la línea cerca del tercio superior. */
export function jumpTo(view: EditorView, pos: number): void {
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: window.innerHeight * 0.3 }),
  });
  view.focus();
}
