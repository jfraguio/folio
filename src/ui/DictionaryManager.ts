import { el, clear } from './el';
import { openOverlay } from './Palette';
import type { PersonalDictionary } from '../persistence/dictionary';

export function openDictionaryManager(dict: PersonalDictionary, onChange: () => void, restoreFocus?: () => void): void {
  const words = el('div', { class: 'dict' });
  const render = () => {
    clear(words);
    const list = dict.list();
    if (!list.length) {
      words.appendChild(el('span', { class: 'panel__meta' }, 'El diccionario personal está vacío.'));
      return;
    }
    for (const w of list) {
      words.appendChild(
        el(
          'button',
          {
            class: 'dict__word',
            title: 'Quitar del diccionario',
            on: {
              click: async () => {
                await dict.remove(w);
                onChange();
                render();
              },
            },
          },
          w,
        ),
      );
    }
  };
  const panel = el(
    'div',
    { class: 'panel' },
    el('div', { class: 'panel__footer', style: { borderTop: 'none', borderBottom: '1px solid var(--panel-border)' } }, 'Diccionario personal · pulsa una palabra para quitarla'),
    words,
    el('div', { class: 'panel__actions' }, el('button', { class: 'btn btn--quiet', on: { click: () => handle.close() } }, 'Cerrar')),
  );
  const handle = openOverlay(panel, undefined, restoreFocus);
  render();
}
