import { el } from './el';
import { openOverlay } from './Palette';

export interface DialogAction {
  label: string;
  primary?: boolean;
  quiet?: boolean;
  onClick: () => void | Promise<void>;
}

/** Diálogo mínimo: título opcional, párrafos y botones. Solo para decisiones inevitables. */
export function openDialog(paragraphs: string[], actions: DialogAction[], restoreFocus?: () => void): void {
  const body = el('div', { class: 'panel__body' }, ...paragraphs.map((p) => el('p', {}, p)));
  const buttons = actions.map((a) =>
    el(
      'button',
      {
        class: ['btn', a.primary && 'btn--primary', a.quiet && 'btn--quiet'].filter(Boolean).join(' '),
        on: {
          click: async () => {
            handle.close();
            await a.onClick();
          },
        },
      },
      a.label,
    ),
  );
  const panel = el('div', { class: 'panel' }, body, el('div', { class: 'panel__actions' }, ...buttons));
  const handle = openOverlay(panel, undefined, restoreFocus);
  (buttons.find((_, i) => actions[i]?.primary) ?? buttons[0])?.focus();
}
