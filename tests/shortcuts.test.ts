import { describe, expect, it } from 'vitest';
import { comboOf, IS_MAC } from '../src/app/shortcuts';

/** Evento de teclado mínimo; en tests no hay teclado real. */
const ev = (p: Partial<KeyboardEvent> & { key: string }): KeyboardEvent =>
  ({
    code: '',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    getModifierState: () => false,
    ...p,
  }) as KeyboardEvent;

describe('comboOf', () => {
  it('AltGr no es un atajo: el símbolo (@, #, |, ~) tiene que llegar al editor', () => {
    const at = ev({
      key: '@',
      code: 'Digit2',
      ctrlKey: true,
      altKey: true,
      getModifierState: (k) => k === 'AltGraph',
    });
    expect(comboOf(at)).toBe('');
  });

  it('sin anunciar AltGraph, un Ctrl+Alt cuyo carácter no es el dígito físico tampoco es subtab', () => {
    if (IS_MAC) return;
    const at = ev({ key: '@', code: 'Digit2', ctrlKey: true, altKey: true });
    expect(comboOf(at)).toBe('');
  });

  it('Ctrl+Alt+dígito sigue siendo el atajo de subtab', () => {
    const sub = ev({ key: '2', code: 'Digit2', ctrlKey: !IS_MAC, metaKey: IS_MAC, altKey: true });
    expect(comboOf(sub)).toBe('Mod-Alt-2');
  });

  it('Ctrl+dígito sigue siendo el atajo de tab', () => {
    const tab = ev({ key: '1', code: 'Digit1', ctrlKey: !IS_MAC, metaKey: IS_MAC });
    expect(comboOf(tab)).toBe('Mod-1');
  });
});
