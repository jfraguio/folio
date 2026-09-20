import { el } from './el';
import { TAB_COUNT } from '../persistence/todoBlocks';

/** Título de la tab: la primera palabra de su contenido, o su número si está vacía. */
export function tabTitle(text: string, index: number): string {
  const word = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u)?.[0];
  return word ? (word.length > 16 ? word.slice(0, 15) + '…' : word) : String(index + 1);
}

export interface TabBarOptions {
  /** Contenidos actuales de las tabs (se leen en cada render; su longitud es el número de tabs). */
  tabs: string[];
  onSelect: (index: number) => void;
}

/**
 * Barra superior con las tabs. Siempre visible y discreta, sin botones de crear ni quitar:
 * las tabs no son un panel, son la aplicación. Hay entre 1 y TAB_COUNT tabs; crearlas y
 * quitarlas se hace desde el menú («Crear tab», «Eliminar tab N»), y la barra solo refleja
 * el número que haya.
 *
 * Los botones se reutilizan entre renders y `render()` solo actualiza texto y estado: así el
 * desplazamiento horizontal de la barra (en móvil) no se pierde con cada tecla pulsada.
 */
export class TabBar {
  readonly root: HTMLElement;
  private active = 0;
  private readonly buttons: HTMLButtonElement[] = [];

  constructor(private readonly o: TabBarOptions) {
    this.root = el('div', { class: 'tab-bar', attrs: { role: 'tablist' } });
    // El CSS reparte el ancho a partir del máximo de tabs: cada hueco mide lo mismo haya las
    // que haya, así al crear una tab las demás no se mueven.
    this.root.style.setProperty('--tab-count', String(TAB_COUNT));
    this.render();
  }

  setActive(index: number): void {
    this.active = index;
    this.render();
    this.scrollActiveIntoView();
  }

  /** Relee los contenidos y redibuja (tras escribir, cambiar de tab, crear o quitar una, o cargar). */
  render(): void {
    const count = Math.max(1, Math.min(TAB_COUNT, this.o.tabs.length));
    // Ajustar el número de botones al de tabs, reutilizando los existentes.
    while (this.buttons.length < count) {
      const k = this.buttons.length;
      const btn = el('button', {
        class: 'tab-bar__tab',
        attrs: { role: 'tab' },
        on: { click: () => this.o.onSelect(k) },
      });
      this.buttons.push(btn);
      this.root.appendChild(btn);
    }
    while (this.buttons.length > count) this.buttons.pop()!.remove();

    for (let k = 0; k < count; k++) {
      const btn = this.buttons[k]!;
      const text = this.o.tabs[k] ?? '';
      const title = tabTitle(text, k);
      const isActive = k === this.active;
      if (btn.textContent !== title) btn.textContent = title;
      btn.classList.toggle('tab-bar__tab--active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.title = text.trim() ? `Tab ${k + 1}: ${title}` : `Tab ${k + 1}`;
    }
  }

  /**
   * Centra la tab activa en la barra cuando esta se desplaza en horizontal (móvil). En
   * escritorio todas las tabs caben y el navegador no tiene nada que desplazar.
   */
  scrollActiveIntoView(): void {
    const btn = this.buttons[this.active];
    if (!btn || this.root.scrollWidth <= this.root.clientWidth) return;
    if (typeof btn.scrollIntoView !== 'function') return;
    btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
}
