import { el } from './el';
import { stripTodoExtension } from '../fs/FileAdapter';
import type { TodoFileRecord } from '../persistence/db';

export interface StartScreenOptions {
  degraded: boolean;
  /** Dispositivo táctil: el aviso de modo degradado no debe sugerir cambiar de navegador. */
  touch?: boolean;
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
            `CONTINUE «${stripTodoExtension(o.last.name)}»`,
          ),
      ),
      o.degraded &&
        el(
          'p',
          { class: 'start__note' },
          o.touch
            ? 'En el móvil los cambios se guardan como borrador en este navegador; puedes descargar el .txt desde el menú cuando quieras.'
            : 'Tu navegador no permite guardar directamente en el archivo. folio guardará un borrador local y podrás descargar el .txt cuando quieras. Para la experiencia completa, usa Chrome o Edge.',
        ),
    ),
  );
}
