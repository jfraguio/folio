import { el } from './el';
import type { TodoFileRecord } from '../persistence/db';

export interface StartScreenOptions {
  degraded: boolean;
  mobile: boolean;
  last: TodoFileRecord | null;
  onOpen: () => void;
  onCreate: () => void;
  onContinue: (rec: TodoFileRecord) => void;
}

export function renderStartScreen(root: HTMLElement, o: StartScreenOptions): void {
  root.replaceChildren(
    el(
      'main',
      { class: 'start' },
      el(
        'div',
        { class: 'start__actions' },
        el('button', { class: 'start__action', on: { click: o.onOpen } }, 'OPEN'),
        el('button', { class: 'start__action', on: { click: o.onCreate } }, 'NEW'),
        o.last &&
          el(
            'button',
            { class: 'start__action start__action--secondary', on: { click: () => o.onContinue(o.last!) } },
            `CONTINUE «${o.last.name.replace(/\.(md|markdown)$/i, '')}»`,
          ),
      ),
      o.degraded &&
        el(
          'p',
          { class: 'start__note' },
          'Tu navegador no permite guardar directamente en el archivo. to-do guardará un borrador local y podrás descargar el .md cuando quieras. Para la experiencia completa, usa Chrome o Edge.',
        ),
      o.mobile && el('p', { class: 'start__note' }, 'to-do está pensado para escritorio.'),
    ),
  );
}
