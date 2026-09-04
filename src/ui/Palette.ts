import { el, clear } from './el';

export interface PaletteItem {
  id: string;
  label: string;
  /** Texto secundario a la derecha (contador, atajo…). */
  meta?: string;
  nested?: boolean;
  current?: boolean;
  /** Texto adicional para el filtrado. */
  keywords?: string;
}

export interface PaletteOptions {
  /** Si se omite, la paleta no muestra campo de búsqueda; se navega con flechas y Enter. */
  placeholder?: string;
  items: PaletteItem[];
  footer?: string;
  initialActiveId?: string;
  onSelect: (item: PaletteItem) => void;
  onClose?: () => void;
}

let current: { close: () => void } | null = null;

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
  /** Paneles que ocupan casi toda la altura (notas, diccionario). */
  tall?: boolean;
}

export function openOverlay(panel: HTMLElement, o: OverlayOptions = {}): { close: () => void } {
  closeOverlay();
  const overlay = el(
    'div',
    { class: o.tall ? 'overlay overlay--tall' : 'overlay', attrs: { role: 'dialog', 'aria-modal': 'true' } },
    panel,
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  const close = () => {
    if (current?.close !== close) return;
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    current = null;
    o.onClose?.();
    o.restoreFocus?.();
  };
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  current = { close };
  return current;
}

function matches(item: PaletteItem, q: string): boolean {
  if (!q) return true;
  const hay = `${item.label} ${item.keywords ?? ''}`.toLowerCase();
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const h = norm(hay);
  return norm(q)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => h.includes(part));
}

export function openPalette(o: PaletteOptions, restoreFocus?: () => void): void {
  const searchable = o.placeholder !== undefined;
  const input = searchable
    ? el('input', { class: 'panel__input', placeholder: o.placeholder, attrs: { autocomplete: 'off', spellcheck: 'false' } })
    : null;
  const list = el('ul', { class: 'panel__list', tabIndex: -1, attrs: { role: 'listbox' } });
  const footer = o.footer ? el('div', { class: 'panel__footer' }, o.footer) : null;
  const panel = el('div', { class: 'panel' }, input, list, footer);

  let filtered: PaletteItem[] = o.items;
  let active = 0;

  const render = () => {
    clear(list);
    if (filtered.length === 0) {
      list.appendChild(el('li', { class: 'panel__empty' }, 'Nada que mostrar'));
      return;
    }
    filtered.forEach((item, i) => {
      const li = el(
        'li',
        {
          class: [
            'panel__item',
            item.nested && 'panel__item--nested',
            item.current && 'panel__item--current',
            i === active && 'panel__item--active',
          ]
            .filter(Boolean)
            .join(' '),
          attrs: { role: 'option', 'aria-selected': String(i === active) },
          on: {
            click: () => select(item),
            mousemove: () => {
              if (active !== i) {
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

  const select = (item: PaletteItem) => {
    handle.close();
    o.onSelect(item);
  };

  input?.addEventListener('input', () => {
    filtered = o.items.filter((it) => matches(it, input.value));
    active = 0;
    render();
  });
  const keyTarget: HTMLElement = input ?? list;
  keyTarget.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, filtered.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[active];
      if (item) select(item);
    }
  });

  if (o.initialActiveId) {
    const idx = o.items.findIndex((i) => i.id === o.initialActiveId);
    if (idx >= 0) active = idx;
  }

  const handle = openOverlay(panel, { onClose: o.onClose, restoreFocus });
  render();
  (input ?? list).focus();
}
