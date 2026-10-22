import { el, clear } from './el';

export interface MenuItem {
  id: string;
  label: string;
  /** Texto secundario a la derecha (atajo…). */
  meta?: string;
  /** Fila solo informativa (p. ej. el estado del guardado): no se selecciona ni se resalta. */
  info?: boolean;
}

export interface MenuOptions {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  /**
   * Entradas secundarias: no se ven de entrada. Si hay alguna, al final de la lista aparece «Más…»;
   * al elegirla, el menú sigue abierto y esa fila se sustituye por ellas.
   */
  more?: MenuItem[];
  /**
   * Teclas interceptadas con el menú abierto (antes del buscador).
   * Si devuelve true, el menú se cierra y la tecla no llega al input.
   */
  onKey?: (e: KeyboardEvent) => boolean;
  /** Texto si la lista está vacía (por defecto, «Nada que mostrar»). */
  empty?: string;
}

/** Etiqueta de la fila que despliega las entradas secundarias (`MenuOptions.more`). */
export const MORE_LABEL = 'Más…';
const MORE_ID = '__more';

let current: { close: () => void } | null = null;
/**
 * Overlay recién cerrado que sigue en el DOM hasta el siguiente frame. Si en ese tiempo se abre
 * otro panel (p. ej. «Títulos» desde el menú), lo sustituye sin animación: el velo no llega a
 * desaparecer y no hay parpadeo entre un panel y el siguiente.
 */
let lingering: HTMLElement | null = null;

export function closeOverlay(): void {
  current?.close();
}

export function isOverlayOpen(): boolean {
  return current !== null;
}

/** Monta un overlay genérico con cierre por Esc y clic fuera; devuelve el nodo del panel. */
export interface OverlayOptions {
  onClose?: () => void;
  restoreFocus?: () => void;
  /** Paneles que ocupan casi toda la altura (diccionario, historial). */
  tall?: boolean;
}

export function openOverlay(panel: HTMLElement, o: OverlayOptions = {}): { close: () => void } {
  closeOverlay();
  // Sustituye a un panel que se acaba de cerrar: sin la entrada animada, para que el velo no parpadee.
  const instant = lingering !== null;
  lingering?.remove();
  lingering = null;
  const overlay = el(
    'div',
    {
      class: ['overlay', o.tall && 'overlay--tall', instant && 'overlay--instant'].filter(Boolean).join(' '),
      attrs: { role: 'dialog', 'aria-modal': 'true' },
    },
    panel,
  );
  // El foco no debe salir del panel: con Tab se cicla dentro (patrón de diálogo modal).
  const trapFocus = (e: KeyboardEvent) => {
    const items = [
      ...panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      trapFocus(e);
    }
  };
  const close = () => {
    if (current?.close !== close) return;
    // Se quita en el siguiente frame (antes de pintar), no ya: si lo que cierra el panel abre otro
    // en el mismo instante, este lo reemplaza sin que se vea el texto sin velo (ver `lingering`).
    // Mientras tanto no responde a nada: los manejadores ya no están y deja pasar los clics.
    overlay.style.pointerEvents = 'none';
    lingering = overlay;
    requestAnimationFrame(() => {
      if (lingering !== overlay) return;
      overlay.remove();
      lingering = null;
    });
    document.removeEventListener('keydown', onKey, true);
    current = null;
    o.onClose?.();
    o.restoreFocus?.();
  };
  // Cierre al pulsar fuera del panel. Se espera al `click` (no a `pointerdown`): si el overlay
  // desapareciera antes, el resto del toque caería sobre el editor y lo enfocaría (teclado).
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  // Un clic en el panel no debe mover la selección del documento: si lo hiciera, al cerrar el
  // overlay el navegador dejaría el caret al principio del editor y CodeMirror lo tomaría por un
  // movimiento del usuario. Los campos de texto (si los hubiera) sí necesitan el comportamiento nativo.
  overlay.addEventListener('mousedown', (e) => {
    if (!(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) e.preventDefault();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  current = { close };
  return current;
}

/**
 * El menú de la aplicación: una lista navegable con flechas y Enter, sin buscador.
 * Cierre con Esc o clic fuera. Es el único menú de folio (la lista de «Títulos» es otro uso de él).
 */
export function openMenu(o: MenuOptions, restoreFocus?: () => void): void {
  const list = el('ul', { class: 'panel__list', tabIndex: -1, attrs: { role: 'listbox' } });
  const panel = el('div', { class: 'panel' }, list);

  const filtered: MenuItem[] = o.more?.length ? [...o.items, { id: MORE_ID, label: MORE_LABEL }] : [...o.items];
  const selectable = (i: number) => filtered[i] !== undefined && !filtered[i]!.info;
  /** Siguiente fila seleccionable a partir de `from` en la dirección `dir`, o `from` si no hay. */
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < filtered.length; i += dir) if (selectable(i)) return i;
    return from;
  };
  let active = selectable(0) ? 0 : step(0, 1);

  const render = () => {
    clear(list);
    if (filtered.length === 0) {
      list.appendChild(el('li', { class: 'panel__empty' }, o.empty ?? 'Nada que mostrar'));
      return;
    }
    filtered.forEach((item, i) => {
      const li = el(
        'li',
        {
          class: ['panel__item', item.info && 'panel__item--info', i === active && 'panel__item--active']
            .filter(Boolean)
            .join(' '),
          attrs: {
            role: 'option',
            'aria-selected': String(i === active),
            ...(item.info ? { 'aria-disabled': 'true' } : {}),
          },
          on: {
            click: () => {
              if (!item.info) select(item);
            },
            // Solo el ratón resalta al pasar por encima; el dedo que hace scroll no.
            pointermove: (e) => {
              if (e.pointerType === 'mouse' && !item.info && active !== i) {
                active = i;
                render();
              }
            },
          },
        },
        el('span', { class: 'panel__label' }, item.label),
        item.meta ? el('span', { class: 'panel__meta' }, item.meta) : null,
      );
      list.appendChild(li);
    });
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  };

  const select = (item: MenuItem) => {
    // «Más…» no cierra el menú: despliega en su sitio las entradas secundarias y activa la primera.
    if (item.id === MORE_ID) {
      const i = filtered.indexOf(item);
      filtered.splice(i, 1, ...(o.more ?? []));
      active = selectable(i) ? i : step(i, 1);
      render();
      list.focus();
      return;
    }
    handle.close();
    o.onSelect(item);
  };

  list.addEventListener('keydown', (e) => {
    if (o.onKey?.(e)) {
      e.preventDefault();
      handle.close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = step(active, 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = step(active, -1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[active];
      if (item && !item.info) select(item);
    }
  });

  const handle = openOverlay(panel, { restoreFocus });
  render();
  list.focus();
}
