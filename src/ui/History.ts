import { el, clear, formatDateTime } from './el';
import { openOverlay } from './Menu';
import { notice } from './Notice';
import { saveToNewFile } from '../fs/download';
import { FOLIO_EXTENSION, FOLIO_MIME } from '../fs/FileAdapter';
import { getVersion, listVersionsMeta, versionFileName, type VersionMeta } from '../persistence/backups';
import type { BackupRecord } from '../persistence/db';
import { formatNumber } from '../text/words';

export interface HistoryOptions {
  /** Guarda una versión del texto actual, ahora. Devuelve `null` si no ha cambiado desde la última. */
  saveNow: () => Promise<BackupRecord | null>;
  restoreFocus?: () => void;
}

/**
 * Historial: versiones del archivo guardadas en IndexedDB (ver persistence/backups.ts).
 * Lista, descarga y «Guardar versión». A propósito no hay «restaurar»: una versión nunca vuelve al
 * editor ni al archivo desde aquí; se descarga y se abre como cualquier otro .txt.
 */
export function openHistory(todoId: string, fileName: string, o: HistoryOptions): void {
  const list = el('div', { class: 'history' });
  const header = el('div', { class: 'panel__header' }, 'Historial');
  const saveBtn = el(
    'button',
    {
      class: 'btn btn--primary',
      title: 'Guarda ahora una versión del texto actual, sin esperar a la siguiente automática (si ha cambiado)',
      on: {
        click: async () => {
          saveBtn.disabled = true;
          try {
            const saved = await o.saveNow();
            if (saved) {
              notice('Versión guardada.');
              await render();
            } else {
              notice('Sin cambios desde la última versión.');
            }
          } catch (e) {
            notice('No se pudo guardar la versión.');
            console.error(e);
          } finally {
            saveBtn.disabled = false;
          }
        },
      },
    },
    'Guardar versión',
  );
  const panel = el(
    'div',
    { class: 'panel panel--tall' },
    header,
    list,
    el(
      'div',
      { class: 'panel__actions' },
      // Hueco a la izquierda que empuja los botones a la derecha (reservado para futura información).
      el('span', { class: 'panel__meta', style: { marginRight: 'auto' } }),
      el('button', { class: 'btn btn--quiet', on: { click: () => handle.close() } }, 'Cerrar'),
      saveBtn,
    ),
  );
  const handle = openOverlay(panel, { restoreFocus: o.restoreFocus, tall: true });

  const render = async () => {
    let versions: VersionMeta[];
    try {
      // Solo metadatos: el texto de cada versión se lee al pulsar «Descargar».
      versions = await listVersionsMeta(todoId);
    } catch (e) {
      clear(list);
      list.appendChild(el('span', { class: 'panel__meta' }, 'No se pudo leer el historial.'));
      console.error(e);
      return;
    }
    clear(list);
    header.textContent = versions.length === 1 ? 'Historial · 1 versión' : `Historial · ${versions.length} versiones`;
    if (!versions.length) {
      list.appendChild(el('span', { class: 'panel__meta' }, 'Todavía no hay versiones de este archivo.'));
      return;
    }
    for (const v of versions) {
      const name = versionFileName(fileName, v);
      list.appendChild(
        el(
          'div',
          { class: 'history__row' },
          el('span', { class: 'history__date' }, formatDateTime(v.ts)),
          el('span', { class: 'history__words' }, `${formatNumber(v.words)} palabras`),
          el(
            'button',
            {
              class: 'btn history__download',
              title: name,
              on: {
                click: async () => {
                  try {
                    const full: BackupRecord | undefined = await getVersion(todoId, v.ts);
                    if (!full) {
                      notice('La versión ya no está disponible.');
                      return;
                    }
                    const saved = await saveToNewFile(full.text, name, {
                      description: 'Texto',
                      mime: FOLIO_MIME,
                      extension: FOLIO_EXTENSION,
                    });
                    if (saved) notice(`Versión guardada en ${saved}`);
                  } catch (e) {
                    notice('No se pudo descargar la versión.');
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
  };

  void render();
}
