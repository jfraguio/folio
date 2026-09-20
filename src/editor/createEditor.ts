import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightSpecialChars, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, insertTab } from '@codemirror/commands';
import { spellCompartment } from './spellcheck';
import { links } from './links';
import { strikethrough } from './strikethrough';
import { zen, zenCompartment } from './zen';

export interface EditorOptions {
  parent: HTMLElement;
  doc: string;
  extra?: Extension[];
  /** Extensión inicial del compartimento de ortografía (vacía si está desactivado). */
  spell?: Extension;
  /** Modo zen (sustituciones al teclear y focus mode). Desactivado por defecto. */
  zen?: boolean;
}

export function createEditor(o: EditorOptions): EditorView {
  const state = EditorState.create({
    doc: o.doc,
    extensions: [
      history(),
      drawSelection(),
      highlightSpecialChars(),
      EditorView.lineWrapping,
      // El corrector es el propio (nspell): sin el subrayado nativo por encima. En móvil, además,
      // el autocorrector y las mayúsculas automáticas del teclado reescribirían lo que se teclea.
      EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
      // Sin interpretación de Markdown: el texto se muestra tal cual (plano).
      links(),
      strikethrough(),
      EditorState.tabSize.of(4),
      keymap.of([{ key: 'Tab', run: insertTab }, ...defaultKeymap, ...historyKeymap]),
      spellCompartment.of(o.spell ?? []),
      zenCompartment.of(zen(o.zen ?? false)),
      ...(o.extra ?? []),
    ],
  });
  return new EditorView({ state, parent: o.parent });
}
