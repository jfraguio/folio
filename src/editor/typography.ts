import { Compartment, EditorSelection, Prec, type EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { insertNewline } from '@codemirror/commands';

/**
 * Asistencia literaria al teclear:
 *  --    → —   (raya)
 *  "     → « o » según contexto
 *  ...   → …
 *  Enter → nuevo párrafo (línea en blanco); Shift+Enter → salto de línea simple
 */
export function replacementFor(before: string, typed: string): { insert: string; deleteBack: number } | null {
  if (typed === '-' && before.endsWith('-') && !before.endsWith('--')) {
    return { insert: '—', deleteBack: 1 };
  }
  if (typed === '.' && before.endsWith('..') && !before.endsWith('...')) {
    return { insert: '…', deleteBack: 2 };
  }
  if (typed === '"') {
    const prev = before.at(-1) ?? '';
    const opening = prev === '' || /[\s(\[{—\-\n]/.test(prev);
    return { insert: opening ? '«' : '»', deleteBack: 0 };
  }
  return null;
}

const handler = EditorView.inputHandler.of((view, from, to, text) => {
  if (text.length !== 1) return false;
  const before = view.state.doc.sliceString(Math.max(0, from - 3), from);
  const r = replacementFor(before, text);
  if (!r) return false;
  view.dispatch({
    changes: { from: from - r.deleteBack, to, insert: r.insert },
    selection: { anchor: from - r.deleteBack + r.insert.length },
    userEvent: 'input.type',
    scrollIntoView: true,
  });
  return true;
});

/**
 * Texto a insertar con Enter: un párrafo nuevo ("\n\n") salvo que el cursor ya esté en una línea
 * vacía, en cuyo caso se añade una sola línea (permite espaciados manuales sin acumular saltos).
 */
export function paragraphBreakFor(state: EditorState, from: number, to: number): string {
  const line = state.doc.lineAt(from);
  const onEmptyLine = from === to && line.text.trim() === '';
  return onEmptyLine ? '\n' : '\n\n';
}

const insertParagraph = (view: EditorView): boolean => {
  const tr = view.state.changeByRange((range) => {
    const insert = paragraphBreakFor(view.state, range.from, range.to);
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length),
    };
  });
  view.dispatch(tr, { scrollIntoView: true, userEvent: 'input' });
  return true;
};

const paragraphKeymap = Prec.high(
  keymap.of([
    { key: 'Enter', run: insertParagraph },
    { key: 'Shift-Enter', run: insertNewline },
  ]),
);

export const typographyCompartment = new Compartment();

export function spanishTypography(enabled: boolean) {
  return enabled ? [handler, paragraphKeymap] : [];
}
