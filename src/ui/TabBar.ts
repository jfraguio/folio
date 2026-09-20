import { el } from './el';
import { TAB_COUNT } from '../persistence/todoBlocks';

/** Título de la tab: la primera palabra de su contenido, o su número si está vacía. */
export function tabTitle(text: string, index: number): string {
  const word = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u)?.[0];
  return word ? (word.length > 16 ? word.slice(0, 15) + '…' : word) : String(index + 1);
}

export interface TabBarOptions {
  /** Contenidos actuales de las tabs (se leen en cada render). */
  tabs: string[];
  onSelect: (index: number) => void;
}

/**
 * Barra superior con las TAB_COUNT tabs. Siempre visible, discreta, sin botón de cierre:
 * las tabs no son un panel, son la aplicación.
 *
 * Los botones se crean una sola vez y `render()` solo actualiza su texto y estado: así el
 * desplazamiento horizontal de la barra (en móvil) no se pierde con cada tecla pulsada.
 */
export class TabBar {
  readonly root: HTMLElement;
  private active = 0;
  private readonly buttons: HTMLButtonElement[] = [];

  constructor(private readonly o: TabBarOptions) {
    this.root = el('div', { class: 'tab-bar', attrs: { role: 'tablist' } });
    // El CSS reparte el ancho entre las tabs a partir de este número.
    this.root.style.setProperty('--tab-count', String(TAB_COUNT));
    for (let k = 0; k < TAB_COUNT; k++) {
      const btn = el('button', {
        class: 'tab-bar__tab',
        attrs: { role: 'tab' },
        on: { click: () => this.o.onSelect(k) },
      });
      this.buttons.push(btn);
      this.root.appendChild(btn);
    }
    this.render();
  }

  setActive(index: number): void {
    this.active = index;
    this.render();
    this.scrollActiveIntoView();
  }

  /** Relee los contenidos y redibuja (tras escribir, cambiar de tab o cargar). */
  render(): void {
    for (let k = 0; k < TAB_COUNT; k++) {
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
