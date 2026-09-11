import { describe, expect, it } from 'vitest';
import { tabTitle } from '../src/ui/TabBar';

describe('tabTitle', () => {
  it('una tab vacía se llama por su número', () => {
    expect(tabTitle('', 0)).toBe('1');
    expect(tabTitle('   \n  ', 4)).toBe('5');
    expect(tabTitle('', 9)).toBe('10');
  });

  it('una tab con contenido usa su primera palabra', () => {
    expect(tabTitle('Compra semanal\nLeche', 0)).toBe('Compra');
    expect(tabTitle('Ideas para el proyecto', 2)).toBe('Ideas');
  });

  it('la primera palabra muy larga se recorta con puntos suspensivos', () => {
    // Más de 16 caracteres: 15 + '…'
    expect(tabTitle('Supercalifragilisticoespialidoso resto', 0)).toBe('Supercalifragil…');
    expect(tabTitle('1234567890123456 exactos', 0)).toBe('1234567890123456');
    expect(tabTitle('12345678901234567 pasa', 0)).toBe('123456789012345…');
  });

  it('acepta apóstrofos y guiones internos', () => {
    expect(tabTitle("l'hora del te", 0)).toBe("l'hora");
    expect(tabTitle('anti-héroe y más', 0)).toBe('anti-héroe');
  });
});
