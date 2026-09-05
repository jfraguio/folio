import { el, clear } from './el';
import { openOverlay } from './Palette';
import { NOTE_TABS } from '../persistence/folioBlocks';

let lastTab = 0;

/** Título de la pestaña: la primera palabra de la nota, o su número si está vacía. */
export function tabTitle(text: string, index: number): string {
  const word = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u)?.[0];
  return word ? (word.length > 16 ? word.slice(0, 15) + '…' : word) : String(index + 1);
}

/**
 * Bloc de notas de la novela: NOTE_TABS espacios de texto libre que se guardan en el .md
 * fuera del texto (ver folioBlocks.ts).
 */
export function openNotes(notes: string[], onChange: (index: number, text: string) => void, restoreFocus?: () => void): void {
  let active = lastTab;
  const textarea = el('textarea', {
    class: 'notes__text',
    attrs: { spellcheck: 'false' },
    on: {
      input: () => {
        notes[active] = textarea.value;
        onChange(active, textarea.value);
        renderTabs();
      },
    },
  });
  const tabs = el('div', { class: 'notes__tabs', attrs: { role: 'tablist' } });

  const renderTabs = () => {
    clear(tabs);
    for (let k = 0; k < NOTE_TABS; k++) {
      tabs.appendChild(
        el(
          'button',
          {
            class: k === active ? 'notes__tab notes__tab--active' : 'notes__tab',
            attrs: { role: 'tab', 'aria-selected': String(k === active) },
            on: { click: () => show(k) },
          },
          tabTitle(notes[k] ?? '', k),
        ),
      );
    }
  };

  const show = (i: number) => {
    active = lastTab = i;
    textarea.value = notes[i] ?? '';
    renderTabs();
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  };

  const panel = el(
    'div',
    { class: 'panel panel--tall panel--notes' },
    el(
      'div',
      { class: 'panel__footer notes__header', style: { borderTop: 'none', borderBottom: '1px solid var(--panel-border)' } },
      el('span', {}, 'Notas'),
      tabs,
    ),
    textarea,
    el('div', { class: 'panel__actions' }, el('button', { class: 'btn btn--quiet', on: { click: () => handle.close() } }, 'Cerrar')),
  );
  const handle = openOverlay(panel, { restoreFocus, tall: true });
  show(active);
}
