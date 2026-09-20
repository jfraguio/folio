// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from '../src/ui/TabBar';
import { TAB_COUNT } from '../src/persistence/todoBlocks';

describe('TabBar', () => {
  it('pinta TAB_COUNT botones con rol tab y marca la activa', () => {
    const tabs = ['Compra', '', 'Ideas'];
    const bar = new TabBar({ tabs, onSelect: () => {} });
    const buttons = bar.root.querySelectorAll('button[role="tab"]');
    expect(buttons).toHaveLength(TAB_COUNT);
    expect(buttons[0]!.textContent).toBe('Compra');
    expect(buttons[1]!.textContent).toBe('2');
    expect(buttons[2]!.textContent).toBe('Ideas');
    expect(buttons[0]!.getAttribute('aria-selected')).toBe('true');
    expect(buttons[0]!.classList.contains('tab-bar__tab--active')).toBe(true);
    expect(buttons[1]!.getAttribute('aria-selected')).toBe('false');
  });

  it('render() actualiza los botones existentes en vez de recrearlos (no pierde el scroll)', () => {
    const tabs = ['Uno'];
    const bar = new TabBar({ tabs, onSelect: () => {} });
    const before = [...bar.root.children];
    tabs[0] = 'Otro';
    tabs[3] = 'Cuatro';
    bar.render();
    const after = [...bar.root.children];
    expect(after).toEqual(before); // mismos nodos
    expect(after[0]!.textContent).toBe('Otro');
    expect(after[3]!.textContent).toBe('Cuatro');
  });

  it('setActive cambia la tab marcada y centra la activa si la barra desborda', () => {
    const bar = new TabBar({ tabs: [], onSelect: () => {} });
    const scrolled: Element[] = [];
    for (const b of bar.root.children) {
      (b as HTMLElement).scrollIntoView = function () {
        scrolled.push(this);
      };
    }
    // Sin desbordamiento (escritorio): no hay nada que desplazar.
    Object.defineProperty(bar.root, 'scrollWidth', { value: 300, configurable: true });
    Object.defineProperty(bar.root, 'clientWidth', { value: 300, configurable: true });
    bar.setActive(2);
    expect(bar.root.children[2]!.getAttribute('aria-selected')).toBe('true');
    expect(bar.root.children[0]!.getAttribute('aria-selected')).toBe('false');
    expect(scrolled).toHaveLength(0);

    // Con desbordamiento (móvil): se centra la activa.
    Object.defineProperty(bar.root, 'scrollWidth', { value: 900, configurable: true });
    bar.setActive(7);
    expect(scrolled).toEqual([bar.root.children[7]]);
  });

  it('un clic en una tab llama a onSelect con su índice', () => {
    const onSelect = vi.fn();
    const bar = new TabBar({ tabs: [], onSelect });
    (bar.root.children[5] as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith(5);
  });
});
