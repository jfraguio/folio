import { el } from './el';
import { openOverlay } from './Menu';

export interface PasswordDialogOptions {
  title: string;
  confirmLabel: string;
  restoreFocus?: () => void;
}

/**
 * Pide una contraseña sin sacarla del panel. El valor solo vive en el campo hasta que se pulsa
 * «Desencriptar»: no se guarda en prefs, ni en el historial, ni en IndexedDB.
 */
export function openPasswordDialog(o: PasswordDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const input = el('input', {
      class: 'secret-input',
      type: 'password',
      attrs: {
        'aria-label': 'Contraseña',
        placeholder: 'Contraseña',
        autocomplete: 'off',
        autocapitalize: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
      },
    });
    const cancel = el(
      'button',
      {
        class: 'btn btn--quiet',
        type: 'button',
        on: {
          click: () => {
            settle(null);
            handle.close();
          },
        },
      },
      'Cancelar',
    );
    const confirm = el('button', { class: 'btn btn--primary', type: 'submit' }, o.confirmLabel);

    const form = el(
      'form',
      { class: 'panel', attrs: { novalidate: '' } },
      el('div', { class: 'panel__header' }, o.title),
      el('div', { class: 'panel__body' }, input),
      el('div', { class: 'panel__actions' }, cancel, confirm),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value) {
        input.focus();
        return;
      }
      settle(input.value);
      handle.close();
    });

    const handle = openOverlay(form, {
      onClose: () => settle(null),
      restoreFocus: o.restoreFocus,
    });
    input.focus();
  });
}
