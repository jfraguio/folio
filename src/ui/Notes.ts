import { el } from './el';
import { openOverlay } from './Palette';

/** Bloc de notas de la novela: texto libre que se guarda en el .md fuera del texto (ver folioBlocks.ts). */
export function openNotes(initial: string, onChange: (notes: string) => void, restoreFocus?: () => void): void {
  const textarea = el('textarea', {
    class: 'notes__text',
    attrs: { placeholder: 'Escaleta, ideas, personajes… Solo lo ves tú; no forma parte de la novela.', spellcheck: 'false' },
    on: { input: () => onChange(textarea.value) },
  });
  textarea.value = initial;
  const panel = el(
    'div',
    { class: 'panel panel--tall panel--notes' },
    el('div', { class: 'panel__footer', style: { borderTop: 'none', borderBottom: '1px solid var(--panel-border)' } }, 'Notas · se guardan con la novela'),
    textarea,
    el('div', { class: 'panel__actions' }, el('button', { class: 'btn btn--quiet', on: { click: () => handle.close() } }, 'Cerrar')),
  );
  const handle = openOverlay(panel, { restoreFocus, tall: true });
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}
