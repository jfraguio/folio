// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { TabBar, type TabBarOptions } from '../src/ui/TabBar';
import { TAB_COUNT } from '../src/persistence/todoBlocks';

const make = (tabs: string[], extra: Partial<TabBarOptions> = {}) => new TabBar({ tabs, onSelect: () => {}, ...extra });

const tabsOf = (bar: TabBar) => [...bar.root.querySelectorAll<HTMLElement>('button[role="tab"]')];

describe('TabBar', () => {
  it('pinta un botón por tab con rol tab y marca la activa', () => {
    const bar = make(['Compra', '', 'Ideas']);
    const buttons = tabsOf(bar);
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.textContent)).toEqual(['Compra', '2', 'Ideas']);
    expect(buttons[0]!.getAttribute('aria-selected')).toBe('true');
    expect(buttons[0]!.classList.contains('tab-bar__tab--active')).toBe(true);
    expect(buttons[1]!.getAttribute('aria-selected')).toBe('false');
  });

  it('render() actualiza los botones existentes en vez de recrearlos (no pierde el scroll)', () => {
    const tabs = ['Uno', 'Dos'];
    const bar = make(tabs);
    const before = tabsOf(bar);
    tabs[0] = 'Otro';
    tabs[1] = 'Cuatro';
    bar.render();
    const after = tabsOf(bar);
    expect(after).toEqual(before); // mismos nodos
    expect(after.map((b) => b.textContent)).toEqual(['Otro', 'Cuatro']);
  });

  it('render() añade o quita botones cuando cambia el número de tabs', () => {
    const tabs = ['a'];
    const bar = make(tabs);
    expect(tabsOf(bar)).toHaveLength(1);
    tabs.push('', '');
    bar.render();
    expect(tabsOf(bar).map((b) => b.textContent)).toEqual(['a', '2', '3']);
    tabs.splice(1, 2);
    bar.render();
    expect(tabsOf(bar)).toHaveLength(1);
  });

  it('la barra solo contiene tabs: crear y quitar se hace desde el menú', () => {
    const bar = make(['a', '']);
    bar.setActive(1);
    expect([...bar.root.children].every((n) => n.getAttribute('role') === 'tab')).toBe(true);
  });

  it('setActive cambia la tab marcada y centra la activa si la barra desborda', () => {
    const tabs = Array.from({ length: TAB_COUNT }, () => '');
    const bar = make(tabs);
    const scrolled: Element[] = [];
    for (const b of tabsOf(bar)) {
      b.scrollIntoView = function () {
        scrolled.push(this);
      };
    }
    // Sin desbordamiento (escritorio): no hay nada que desplazar.
    Object.defineProperty(bar.root, 'scrollWidth', { value: 300, configurable: true });
    Object.defineProperty(bar.root, 'clientWidth', { value: 300, configurable: true });
    bar.setActive(2);
    expect(tabsOf(bar)[2]!.getAttribute('aria-selected')).toBe('true');
    expect(tabsOf(bar)[0]!.getAttribute('aria-selected')).toBe('false');
    expect(scrolled).toHaveLength(0);

    // Con desbordamiento (móvil): se centra la activa.
    Object.defineProperty(bar.root, 'scrollWidth', { value: 900, configurable: true });
    bar.setActive(7);
    expect(scrolled).toEqual([tabsOf(bar)[7]]);
  });

  it('un clic en una tab llama a onSelect con su índice', () => {
    const onSelect = vi.fn();
    const bar = make(['a', 'b', 'c', 'd', 'e', 'f'], { onSelect });
    tabsOf(bar)[5]!.click();
    expect(onSelect).toHaveBeenCalledWith(5);
  });
});
