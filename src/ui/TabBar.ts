import { el } from './el';
import { TAB_COUNT, type Tab } from '../persistence/todoBlocks';

/** Título de la tab: la primera palabra de su contenido, o su número si está vacía. */
export function tabTitle(text: string, index: number): string {
  const word = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u)?.[0];
  return word ? (word.length > 16 ? word.slice(0, 15) + '…' : word) : String(index + 1);
}

export interface TabBarOptions {
  /** Tabs actuales (se leen en cada render; su longitud es el número de tabs). */
  tabs: Tab[];
  /** `sub` es -1 para una tab principal, o el índice de la subtab dentro de la tab `tab`. */
  onSelect: (tab: number, sub: number) => void;
}

/**
 * Barra superior con las tabs. Siempre visible y discreta, sin botones de crear ni quitar:
 * las tabs no son un panel, son la aplicación. Hay entre 1 y TAB_COUNT tabs; crearlas y
 * quitarlas se hace desde el menú («Crear pestaña», «Eliminar pestaña N»), y la barra solo refleja
 * el número que haya.
 *
 * Tras las tabs principales, separadas por un hueco y con fondo más oscuro, van las subtabs de
 * la tab abierta (de 0 a TAB_COUNT). Al cambiar de tab principal cambian las subtabs que se ven.
 *
 * Los botones se reutilizan entre renders y `render()` solo actualiza texto y estado: así el
 * desplazamiento horizontal de la barra no se pierde con cada tecla pulsada.
 */
export class TabBar {
  readonly root: HTMLElement;
  /** Tira desplazable con los botones; `root` es la franja fija que la contiene. */
  private readonly strip: HTMLElement;
  private activeTab = 0;
  private activeSub = -1;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly subButtons: HTMLButtonElement[] = [];

  constructor(private readonly o: TabBarOptions) {
    this.strip = el('div', { class: 'tab-bar__strip', attrs: { role: 'tablist' } });
    this.root = el('div', { class: 'tab-bar' }, this.strip);
    // El CSS reparte el ancho a partir del máximo de tabs: cada hueco mide lo mismo haya las
    // que haya, así al crear una tab las demás no se mueven.
    this.root.style.setProperty('--tab-count', String(TAB_COUNT));
    this.render();
  }

  /** Marca como activa la tab `tab` (y su subtab `sub`, o ninguna con -1). */
  setActive(tab: number, sub = -1): void {
    this.activeTab = tab;
    this.activeSub = sub;
    this.render();
    this.scrollActiveIntoView();
  }

  /** Relee los contenidos y redibuja (tras escribir, cambiar de tab, crear o quitar una, o cargar). */
  render(): void {
    const count = Math.max(1, Math.min(TAB_COUNT, this.o.tabs.length));
    this.fit(this.buttons, count, (k) => this.o.onSelect(k, -1), 'tab-bar__tab');
    for (let k = 0; k < count; k++) {
      const text = this.o.tabs[k]?.text ?? '';
      this.paint(this.buttons[k]!, text, k, k === this.activeTab && this.activeSub < 0, `Tab ${k + 1}`);
    }

    const subs = this.o.tabs[this.activeTab]?.subs ?? [];
    const subCount = Math.min(TAB_COUNT, subs.length);
    // Los botones de subtab se reutilizan al cambiar de tab principal: el padre se lee al hacer clic.
    this.fit(this.subButtons, subCount, (k) => this.o.onSelect(this.activeTab, k), 'tab-bar__tab tab-bar__tab--sub');
    for (let k = 0; k < subCount; k++) {
      this.paint(this.subButtons[k]!, subs[k] ?? '', k, k === this.activeSub, `Subpestaña ${k + 1} de la tab ${this.activeTab + 1}`);
    }
  }

  /**
   * Ajusta el número de botones de una lista al de tabs, reutilizando los existentes. Las subtabs
   * van siempre detrás de las principales: los botones de subtab se añaden al final, y los de tab
   * principal justo antes del primero de subtab.
   */
  private fit(list: HTMLButtonElement[], count: number, select: (k: number) => void, className: string): void {
    while (list.length < count) {
      const k = list.length;
      const btn = el('button', { class: className, attrs: { role: 'tab' }, on: { click: () => select(k) } });
      list.push(btn);
      if (list === this.buttons && this.subButtons[0]) this.strip.insertBefore(btn, this.subButtons[0]);
      else this.strip.appendChild(btn);
    }
    while (list.length > count) list.pop()!.remove();
  }

  private paint(btn: HTMLButtonElement, text: string, index: number, isActive: boolean, name: string): void {
    const title = tabTitle(text, index);
    if (btn.textContent !== title) btn.textContent = title;
    btn.classList.toggle('tab-bar__tab--active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
    btn.title = text.trim() ? `${name}: ${title}` : name;
  }

  /**
   * Centra la tab activa en la tira cuando esta se desplaza en horizontal (hay más tabs y
   * subtabs de las que caben). Si todo cabe, el navegador no tiene nada que desplazar.
   */
  scrollActiveIntoView(): void {
    const btn = this.activeSub >= 0 ? this.subButtons[this.activeSub] : this.buttons[this.activeTab];
    if (!btn || this.strip.scrollWidth <= this.strip.clientWidth) return;
    if (typeof btn.scrollIntoView !== 'function') return;
    btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
}
