import { describe, expect, it } from 'vitest';
import { replacementFor } from '../src/editor/typography';

describe('replacementFor (sustituciones del modo zen)', () => {
  it('un segundo guion convierte «--» en raya', () => {
    expect(replacementFor('ab-', '-')).toEqual({ insert: '—', deleteBack: 1 });
  });

  it('un guion suelto, o un tercero tras «--», se deja tal cual', () => {
    expect(replacementFor('ab', '-')).toBeNull();
    expect(replacementFor('', '-')).toBeNull();
    expect(replacementFor('a--', '-')).toBeNull();
    // Tras la raya ya insertada, un guion no vuelve a disparar la sustitución.
    expect(replacementFor('a—', '-')).toBeNull();
  });

  it('las comillas abren (« ) al principio de palabra', () => {
    for (const before of ['', 'hola ', 'hola\n', '(', '[', '{', '—', 'a-']) {
      expect(replacementFor(before, '"'), JSON.stringify(before)).toEqual({ insert: '«', deleteBack: 0 });
    }
  });

  it('las comillas cierran ( ») al final de palabra', () => {
    for (const before of ['hola', 'hola.', 'año', '42', '«']) {
      expect(replacementFor(before, '"'), JSON.stringify(before)).toEqual({ insert: '»', deleteBack: 0 });
    }
  });

  it('cualquier otro carácter pasa sin tocar', () => {
    expect(replacementFor('ab', 'c')).toBeNull();
    expect(replacementFor('..', '.')).toBeNull(); // la elipsis de Folio no forma parte del modo zen
    expect(replacementFor("ab", "'")).toBeNull();
  });
});
