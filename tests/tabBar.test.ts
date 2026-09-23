// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { TabBar, type TabBarOptions } from '../src/ui/TabBar';
import { TAB_COUNT, type Tab } from '../src/persistence/todoBlocks';

/** Tab con texto y, opcionalmente, subtabs. */
const T = (text: string, subs: string[] = []): Tab => ({ text, subs });
const plain = (...texts: string[]) => texts.map((t) => T(t));

const make = (tabs: Tab[], extra: Partial<TabBarOptions> = {}) => new TabBar({ tabs, onSelect: () => {}, ...extra });

const tabsOf = (bar: TabBar) => [...bar.root.querySelectorAll<HTMLElement>('button[role="tab"]')];
const subsOf = (bar: TabBar) => tabsOf(bar).filter((b) => b.classList.contains('tab-bar__tab--sub'));
const mainsOf = (bar: TabBar) => tabsOf(bar).filter((b) => !b.classList.contains('tab-bar__tab--sub'));
const activeOf = (bar: TabBar) => tabsOf(bar).filter((b) => b.getAttribute('aria-selected') === 'true');

describe('TabBar', () => {
  it('pinta un botón por tab con rol tab y marca la activa', () => {
    const bar = make(plain('Compra', '', 'Ideas'));
    const buttons = tabsOf(bar);
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.textContent)).toEqual(['Compra', '2', 'Ideas']);
    expect(buttons[0]!.getAttribute('aria-selected')).toBe('true');
    expect(buttons[0]!.classList.contains('tab-bar__tab--active')).toBe(true);
    expect(buttons[1]!.getAttribute('aria-selected')).toBe('false');
  });

  it('render() actualiza los botones existentes en vez de recrearlos (no pierde el scroll)', () => {
    const tabs = plain('Uno', 'Dos');
    const bar = make(tabs);
    const before = tabsOf(bar);
    tabs[0]!.text = 'Otro';
    tabs[1]!.text = 'Cuatro';
    bar.render();
    const after = tabsOf(bar);
    expect(after).toEqual(before); // mismos nodos
    expect(after.map((b) => b.textContent)).toEqual(['Otro', 'Cuatro']);
  });

  it('render() añade o quita botones cuando cambia el número de tabs', () => {
    const tabs = plain('a');
    const bar = make(tabs);
    expect(tabsOf(bar)).toHaveLength(1);
    tabs.push(T(''), T(''));
    bar.render();
    expect(tabsOf(bar).map((b) => b.textContent)).toEqual(['a', '2', '3']);
    tabs.splice(1, 2);
    bar.render();
    expect(tabsOf(bar)).toHaveLength(1);
  });

  it('la barra solo contiene tabs (y el separador decorativo): crear y quitar se hace desde el menú', () => {
    const bar = make(plain('a', ''));
    bar.setActive(1);
    const strip = bar.root.querySelector('[role="tablist"]')!;
    const others = [...strip.children].filter((n) => n.getAttribute('role') !== 'tab');
    expect(others.map((n) => n.className)).toEqual(['tab-bar__divider']);
    expect(others[0]!.getAttribute('aria-hidden')).toBe('true');
  });

  it('setActive cambia la tab marcada y centra la activa si la tira desborda', () => {
    const tabs = Array.from({ length: TAB_COUNT }, () => T(''));
    const bar = make(tabs);
    const strip = bar.root.querySelector<HTMLElement>('[role="tablist"]')!;
    const scrolled: Element[] = [];
    for (const b of tabsOf(bar)) {
      b.scrollIntoView = function () {
        scrolled.push(this);
      };
    }
    // Sin desbordamiento: no hay nada que desplazar.
    Object.defineProperty(strip, 'scrollWidth', { value: 300, configurable: true });
    Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true });
    bar.setActive(2);
    expect(tabsOf(bar)[2]!.getAttribute('aria-selected')).toBe('true');
    expect(tabsOf(bar)[0]!.getAttribute('aria-selected')).toBe('false');
    expect(scrolled).toHaveLength(0);

    // Con desbordamiento: se centra la activa.
    Object.defineProperty(strip, 'scrollWidth', { value: 900, configurable: true });
    bar.setActive(7);
    expect(scrolled).toEqual([tabsOf(bar)[7]]);
  });

  it('un clic en una tab llama a onSelect con su índice y -1 (sin subtab)', () => {
    const onSelect = vi.fn();
    const bar = make(plain('a', 'b', 'c', 'd', 'e', 'f'), { onSelect });
    tabsOf(bar)[5]!.click();
    expect(onSelect).toHaveBeenCalledWith(5, -1);
  });

  describe('subtabs', () => {
    it('muestra tras las principales las subtabs de la tab abierta, y solo esas', () => {
      const tabs = [T('Novela', ['Capítulo', '']), T('Notas', ['Apuntes de notas'])];
      const bar = make(tabs);
      expect(mainsOf(bar).map((b) => b.textContent)).toEqual(['Novela', 'Notas']);
      expect(subsOf(bar).map((b) => b.textContent)).toEqual(['Capítulo', '2']);
      // Van detrás de las principales.
      expect(tabsOf(bar).map((b) => b.textContent)).toEqual(['Novela', 'Notas', 'Capítulo', '2']);

      bar.setActive(1);
      expect(subsOf(bar).map((b) => b.textContent)).toEqual(['Apuntes']);
      expect(activeOf(bar).map((b) => b.textContent)).toEqual(['Notas']);
    });

    it('una tab sin subtabs no muestra ninguna', () => {
      const bar = make([T('a', ['s']), T('b')]);
      bar.setActive(1);
      expect(subsOf(bar)).toHaveLength(0);
    });

    it('una barra vertical separa las principales de las subtabs, y solo se ve si hay subtabs', () => {
      const tabs = [T('a', ['s1', 's2']), T('b')];
      const bar = make(tabs);
      const strip = bar.root.querySelector('[role="tablist"]')!;
      const divider = strip.querySelector<HTMLElement>('.tab-bar__divider')!;
      const order = () => [...strip.children].map((n) => n.textContent || '|');
      expect(order()).toEqual(['a', 'b', '|', 's1', 's2']);
      expect(divider.hidden).toBe(false);

      bar.setActive(1); // la tab b no tiene subtabs
      expect(divider.hidden).toBe(true);

      // Al crear una tab principal, queda antes del separador.
      tabs.push(T('c'));
      bar.setActive(0);
      expect(order()).toEqual(['a', 'b', 'c', '|', 's1', 's2']);
      expect(divider.hidden).toBe(false);
    });

    it('setActive(tab, sub) marca solo la subtab, no su tab madre', () => {
      const bar = make([T('a', ['s1', 's2'])]);
      bar.setActive(0, 1);
      expect(activeOf(bar).map((b) => b.textContent)).toEqual(['s2']);
      expect(mainsOf(bar)[0]!.getAttribute('aria-selected')).toBe('false');
    });

    it('con una subtab abierta, su tab madre (y solo ella) lleva el fondo de las subtabs', () => {
      const bar = make([T('a', ['s1']), T('b', ['t1'])]);
      const parents = () => mainsOf(bar).filter((b) => b.classList.contains('tab-bar__tab--parent')).map((b) => b.textContent);
      expect(parents()).toEqual([]); // la tab a está abierta: ya lleva el resalte de activa
      bar.setActive(1, 0);
      expect(parents()).toEqual(['b']);
      bar.setActive(0, 0);
      expect(parents()).toEqual(['a']);
      bar.setActive(1);
      expect(parents()).toEqual([]);
    });

    it('un clic en una subtab llama a onSelect con la tab madre actual y el índice de la subtab', () => {
      const onSelect = vi.fn();
      const bar = make([T('a', ['s1']), T('b', ['t1', 't2'])], { onSelect });
      subsOf(bar)[0]!.click();
      expect(onSelect).toHaveBeenLastCalledWith(0, 0);
      // Al cambiar de tab madre, los botones de subtab (reutilizados) apuntan a la nueva madre.
      bar.setActive(1);
      subsOf(bar)[1]!.click();
      expect(onSelect).toHaveBeenLastCalledWith(1, 1);
    });

    it('al añadir una tab principal, su botón queda antes de las subtabs', () => {
      const tabs = [T('a', ['s1'])];
      const bar = make(tabs);
      tabs.push(T('b'));
      bar.render();
      expect(tabsOf(bar).map((b) => b.textContent)).toEqual(['a', 'b', 's1']);
    });

    it('centra la subtab activa si la tira desborda', () => {
      const bar = make([T('a', ['s1', 's2'])]);
      const strip = bar.root.querySelector<HTMLElement>('[role="tablist"]')!;
      const scrolled: Element[] = [];
      for (const b of tabsOf(bar)) {
        b.scrollIntoView = function () {
          scrolled.push(this);
        };
      }
      Object.defineProperty(strip, 'scrollWidth', { value: 900, configurable: true });
      Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true });
      bar.setActive(0, 1);
      expect(scrolled).toEqual([subsOf(bar)[1]]);
    });
  });
});
