import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * Sustituciones al teclear del modo zen (las de Folio, `src/editor/typography.ts`):
 *  --  → —   (raya)
 *  "   → « al principio de palabra, » al final
 *
 * Devuelve qué insertar y cuántos caracteres borrar hacia atrás, o `null` si no hay sustitución.
 * `before` son los caracteres justo antes del cursor (bastan tres).
 */
export function replacementFor(before: string, typed: string): { insert: string; deleteBack: number } | null {
  if (typed === '-' && before.endsWith('-') && !before.endsWith('--')) {
    return { insert: '—', deleteBack: 1 };
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

/** Las sustituciones como extensión; el modo zen las activa y desactiva (ver zen.ts). */
export function typography(): Extension {
  return handler;
}
