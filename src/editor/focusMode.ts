import { RangeSetBuilder, StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

/*
 * Focus mode, copiado de Folio (src/editor/focusMode.ts). Único cambio: en to-do cada salto de
 * línea separa párrafos (cada línea es un elemento), así que `paragraphAt` devuelve solo la línea
 * del cursor, no el bloque de líneas contiguas de Folio. Solo se activa en modo zen (ver zen.ts),
 * y el CSS que atenúa el texto cuelga de `html[data-zen]` (editor.css).
 */

const activeLine = Decoration.line({ class: 'cm-active-para' });

export interface ParagraphRange {
  fromLine: number;
  toLine: number;
}

/** La línea del documento que contiene el cursor: en folio cada línea es un párrafo. */
export function paragraphAt(state: EditorState, pos: number): ParagraphRange {
  const n = state.doc.lineAt(pos).number;
  return { fromLine: n, toLine: n };
}

/** Marca (o desmarca) que el usuario ha colocado el cursor dentro del texto. */
export const setCursorPlaced = StateEffect.define<boolean>();

/**
 * Si el usuario ha colocado el cursor dentro del texto. Arranca en `false` (al cargar, todo el
 * texto se ve tenue y sin cursor aunque la selección esté en la primera línea). Pasa a `true`
 * al hacer clic sobre una línea, al escribir, al pulsar una tecla de edición/navegación o con un
 * salto programático (cambio de tab); vuelve a `false` con un clic fuera del texto.
 */
export const cursorPlaced = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setCursorPlaced)) value = e.value;
    if (tr.docChanged && (tr.isUserEvent('input') || tr.isUserEvent('delete'))) value = true;
    // Selección movida programáticamente (cambio de tab, cursor al final al abrirla).
    // Las del teclado llevan `select` y se arman desde keydown; las del ratón, desde mousedown.
    if (tr.selection && !tr.isUserEvent('select')) value = true;
    return value;
  },
});

/**
 * Hay un párrafo que resaltar solo si el usuario ha colocado el cursor y la línea del cursor
 * tiene texto. En una línea en blanco no hay párrafo, así que todo el texto se ve tenue.
 */
export function hasActiveParagraph(state: EditorState): boolean {
  if (!state.field(cursorPlaced)) return false;
  return state.doc.lineAt(state.selection.main.head).text.trim() !== '';
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      const toggled = u.startState.field(cursorPlaced) !== u.state.field(cursorPlaced);
      if (toggled || u.selectionSet || u.docChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView): DecorationSet {
      if (!hasActiveParagraph(view.state)) return Decoration.none;
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

/** Elemento `.cm-line` del editor sobre el que cae el evento, o `null` si cae en márgenes o padding. */
function lineElementAt(view: EditorView, target: EventTarget | null): Element | null {
  const lineEl = target instanceof Element ? target.closest('.cm-line') : null;
  return lineEl && view.contentDOM.contains(lineEl) ? lineEl : null;
}

const MODIFIER_KEYS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'CapsLock', 'Escape']);

/**
 * Clics con el ratón. Se escucha sobre `view.dom` (todo el `.cm-editor`) en fase de captura y no
 * vía `EditorView.domEventHandlers`, porque CodeMirror solo registra esos manejadores en
 * `.cm-content`: un clic en los márgenes laterales cae en `.cm-scroller` y nunca llegaría a ellos.
 */
const mousePlugin = ViewPlugin.fromClass(
  class {
    constructor(private view: EditorView) {
      view.dom.addEventListener('mousedown', this.onMouseDown, { capture: true });
    }
    destroy() {
      this.view.dom.removeEventListener('mousedown', this.onMouseDown, { capture: true });
    }
    private onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const { view } = this;
      const setPlaced = (v: boolean) => {
        if (view.state.field(cursorPlaced) !== v) view.dispatch({ effects: setCursorPlaced.of(v) });
      };
      if (lineElementAt(view, event.target)) {
        // Clic sobre una línea (con texto o en blanco): CodeMirror coloca el cursor con normalidad.
        setPlaced(true);
        return;
      }
      // Clic en los márgenes o en el padding: el cursor se retira del texto. Se cancela el evento
      // para que ni el navegador ni CodeMirror muevan la selección o inicien una selección por
      // arrastre. El editor conserva (o recibe) el foco para que al teclear el cursor reaparezca.
      setPlaced(false);
      event.preventDefault();
      if (!view.hasFocus) view.focus();
    };
  },
);

// Observador (no manejador): se ejecuta siempre, aunque el keymap ya haya consumido la tecla.
const keyObserver = EditorView.domEventObservers({
  keydown(event, view) {
    // Cualquier tecla de edición o navegación vuelve a colocar el cursor. Se excluyen los
    // modificadores sueltos, Escape y los atajos con Cmd/Ctrl (menú, tema, tamaño…).
    if (MODIFIER_KEYS.has(event.key) || event.metaKey || event.ctrlKey) return;
    if (!view.state.field(cursorPlaced)) view.dispatch({ effects: setCursorPlaced.of(true) });
  },
});

const focusModeClass = EditorView.editorAttributes.of((view) => {
  const classes = ['cm-focus-mode'];
  if (view.state.field(cursorPlaced)) classes.push('cm-cursor-placed');
  if (hasActiveParagraph(view.state)) classes.push('cm-focus-active');
  return { class: classes.join(' ') };
});

export function focusMode() {
  return [cursorPlaced, plugin, mousePlugin, keyObserver, focusModeClass];
}
