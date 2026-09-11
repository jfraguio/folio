import { el, clear } from './el';
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
 */
export class TabBar {
  readonly root: HTMLElement;
  private active = 0;

  constructor(private readonly o: TabBarOptions) {
    this.root = el('div', { class: 'tab-bar', attrs: { role: 'tablist' } });
    // El CSS reparte el ancho entre las tabs a partir de este número.
    this.root.style.setProperty('--tab-count', String(TAB_COUNT));
    this.render();
  }

  setActive(index: number): void {
    this.active = index;
    this.render();
  }

  /** Relee los contenidos y redibuja (tras escribir, cambiar de tab o cargar). */
  render(): void {
    clear(this.root);
    for (let k = 0; k < TAB_COUNT; k++) {
      const text = this.o.tabs[k] ?? '';
      const title = tabTitle(text, k);
      this.root.appendChild(
        el(
          'button',
          {
            class: k === this.active ? 'tab-bar__tab tab-bar__tab--active' : 'tab-bar__tab',
            attrs: {
              role: 'tab',
              'aria-selected': String(k === this.active),
              title: text.trim() ? `Tab ${k + 1}: ${title}` : `Tab ${k + 1}`,
            },
            on: { click: () => this.o.onSelect(k) },
          },
          title,
        ),
      );
    }
  }
}
