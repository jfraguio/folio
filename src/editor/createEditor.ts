import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightSpecialChars, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, insertTab } from '@codemirror/commands';
import { spellCompartment } from './spellcheck';
import { links } from './links';
import { strikethrough } from './strikethrough';
import { zen, zenCompartment } from './zen';

export interface EditorConfig {
  /** Extensiones extra (p. ej. el `updateListener` de la sesión). */
  extra?: Extension[];
  /** Extensión inicial del compartimento de ortografía (vacía si está desactivado). */
  spell?: Extension;
  /** Modo zen (sustituciones al teclear y focus mode). Desactivado por defecto. */
  zen?: boolean;
}

export interface EditorOptions extends EditorConfig {
  parent: HTMLElement;
  doc: string;
}

/**
 * Extensiones del editor, comunes a todos los estados. Se recrean en cada `EditorState` (una por
 * tab) para que cada uno tenga su propio historial, cursor y selección.
 */
export function editorExtensions(o: EditorConfig = {}): Extension[] {
  return [
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
  ];
}

/** Un estado de editor para un documento, con su propio historial y sus extensiones. */
export function createEditorState(doc: string, o: EditorConfig = {}): EditorState {
  return EditorState.create({ doc, extensions: editorExtensions(o) });
}

export function createEditor(o: EditorOptions): EditorView {
  return new EditorView({ state: createEditorState(o.doc, o), parent: o.parent });
}
