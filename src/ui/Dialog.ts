import { el } from './el';
import { openOverlay } from './Menu';

export interface DialogAction {
  /** Identificador que devuelve `openDialog` cuando se pulsa esta acción. */
  id: string;
  label: string;
  primary?: boolean;
  quiet?: boolean;
}

/**
 * Diálogo mínimo: párrafos y botones. Solo para decisiones inevitables. Devuelve el `id` de la
 * acción pulsada, o `null` si se cierra con Esc o con un clic fuera del panel. Resolver también al
 * cerrar evita que la apertura se quede colgada (y con ella el bloqueo del archivo).
 */
export function openDialog(
  paragraphs: string[],
  actions: DialogAction[],
  restoreFocus?: () => void,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (id: string | null) => {
      if (settled) return;
      settled = true;
      resolve(id);
    };
    const body = el('div', { class: 'panel__body' }, ...paragraphs.map((p) => el('p', {}, p)));
    const buttons = actions.map((a) =>
      el(
        'button',
        {
          class: ['btn', a.primary && 'btn--primary', a.quiet && 'btn--quiet'].filter(Boolean).join(' '),
          on: {
            click: () => {
              settle(a.id);
              handle.close();
            },
          },
        },
        a.label,
      ),
    );
    const panel = el('div', { class: 'panel' }, body, el('div', { class: 'panel__actions' }, ...buttons));
    const handle = openOverlay(panel, { onClose: () => settle(null), restoreFocus });
    (buttons.find((_, i) => actions[i]?.primary) ?? buttons[0])?.focus();
  });
}
