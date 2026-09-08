import { el, clear, formatDateTime } from './el';
import { openOverlay } from './Palette';
import { notice } from './Notice';
import { saveToNewFile } from '../fs/FallbackAdapter';
import { backupFileName, listBackups } from '../persistence/backups';
import { formatNumber } from '../text/words';

/**
 * Historial: copias de seguridad de apertura de la novela (ver persistence/backups.ts).
 * Solo lista y descarga. A propósito no hay «restaurar»: una copia nunca vuelve al editor ni al .md.
 */
export function openHistory(novelId: string, novelName: string, restoreFocus?: () => void): void {
  const list = el('div', { class: 'history' });
  const header = el('div', { class: 'panel__footer', style: { borderTop: 'none', borderBottom: '1px solid var(--panel-border)' } }, 'Historial');
  const panel = el(
    'div',
    { class: 'panel panel--tall' },
    header,
    list,
    el('div', { class: 'panel__actions' }, el('button', { class: 'btn btn--quiet', on: { click: () => handle.close() } }, 'Cerrar')),
  );
  const handle = openOverlay(panel, { restoreFocus, tall: true });

  void listBackups(novelId).then(
    (backups) => {
      clear(list);
      header.textContent = backups.length === 1 ? 'Historial · 1 copia' : `Historial · ${backups.length} copias`;
      if (!backups.length) {
        list.appendChild(el('span', { class: 'panel__meta' }, 'Todavía no hay copias de esta novela.'));
        return;
      }
      for (const b of backups) {
        const name = backupFileName(novelName, b);
        list.appendChild(
          el(
            'div',
            { class: 'history__row' },
            el('span', { class: 'history__date' }, formatDateTime(b.ts)),
            el('span', { class: 'history__words' }, `${formatNumber(b.words)} palabras`),
            el(
              'button',
              {
                class: 'btn history__download',
                title: name,
                on: {
                  click: async () => {
                    try {
                      const saved = await saveToNewFile(b.text, name, { description: 'Markdown', mime: 'text/markdown', extension: '.md' });
                      if (saved) notice(`Copia guardada en ${saved}`);
                    } catch (e) {
                      notice('No se pudo guardar la copia.');
                      console.error(e);
                    }
                  },
                },
              },
              'Descargar',
            ),
          ),
        );
      }
    },
    (e) => {
      clear(list);
      list.appendChild(el('span', { class: 'panel__meta' }, 'No se pudo leer el historial.'));
      console.error(e);
    },
  );
}
