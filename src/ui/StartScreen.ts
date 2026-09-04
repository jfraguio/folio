import { el } from './el';
import type { NovelRecord } from '../persistence/db';

export interface StartScreenOptions {
  degraded: boolean;
  mobile: boolean;
  last: NovelRecord | null;
  onOpen: () => void;
  onCreate: () => void;
  onContinue: (rec: NovelRecord) => void;
}

export function renderStartScreen(root: HTMLElement, o: StartScreenOptions): void {
  root.replaceChildren(
    el(
      'main',
      { class: 'start' },
      el(
        'div',
        { class: 'start__actions' },
        el('button', { class: 'start__action', on: { click: o.onOpen } }, 'Abrir'),
        el('button', { class: 'start__action', on: { click: o.onCreate } }, 'Nuevo'),
        o.last &&
          el(
            'button',
            { class: 'start__action start__action--secondary', on: { click: () => o.onContinue(o.last!) } },
            `Continuar «${o.last.name.replace(/\.(md|markdown)$/i, '')}»`,
          ),
      ),
      o.degraded &&
        el(
          'p',
          { class: 'start__note' },
          'Tu navegador no permite guardar directamente en el archivo. Folio guardará un borrador local y podrás descargar el .md cuando quieras. Para la experiencia completa, usa Chrome o Edge.',
        ),
      o.mobile && el('p', { class: 'start__note' }, 'Folio está pensado para escritorio.'),
    ),
  );
}
