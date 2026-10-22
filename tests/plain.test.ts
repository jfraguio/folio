import { describe, expect, it } from 'vitest';
import { exportFileName, findHeadings, headingText, plainInline, toPlainText } from '../src/text/plain';

describe('plainInline', () => {
  it('quita énfasis, tachado y código', () => {
    expect(plainInline('**negrita**, *cursiva*, __otra__, _más_ y ~~tachado~~')).toBe(
      'negrita, cursiva, otra, más y tachado',
    );
    expect(plainInline('***las dos*** y **con _anidada_ dentro**')).toBe('las dos y con anidada dentro');
    expect(plainInline('usa `npm run dev` o ``a `b` c``')).toBe('usa npm run dev o a `b` c');
  });

  it('no toca asteriscos ni guiones bajos que no son énfasis', () => {
    expect(plainInline('2*3*4 = 24')).toBe('2*3*4 = 24');
    expect(plainInline('nombre_de_archivo.txt')).toBe('nombre_de_archivo.txt');
    expect(plainInline('5 * 3 y 4 * 2')).toBe('5 * 3 y 4 * 2');
  });

  it('el código y los escapes se dejan literales', () => {
    expect(plainInline('`**no**`')).toBe('**no**');
    expect(plainInline('\\*no es cursiva\\*')).toBe('*no es cursiva*');
  });

  it('enlaces: solo el texto o «texto (url)»', () => {
    expect(plainInline('ver [la web](https://a.org) hoy')).toBe('ver la web hoy');
    expect(plainInline('ver [la web](https://a.org) hoy', { urls: true })).toBe('ver la web (https://a.org) hoy');
    // Si el texto ya es la URL no se repite.
    expect(plainInline('[a.org](https://a.org/)', { urls: true })).toBe('a.org');
    expect(plainInline('![un gato](gato.png) <https://b.org>', { urls: true })).toBe('un gato https://b.org');
    // Un enlace con un esquema peligroso no es un enlace: se deja tal cual.
    expect(plainInline('[x](javascript:alert)', { urls: true })).toBe('[x](javascript:alert)');
  });
});

describe('toPlainText', () => {
  it('quita las convenciones de folio: títulos y tareas hechas', () => {
    expect(toPlainText('# Semana\n-- Llamar al banco\nComprar pan\n  --  Sangrada')).toBe(
      'Semana\nLlamar al banco\nComprar pan\n  Sangrada',
    );
    expect(toPlainText('### Título ###\n#Pegado')).toBe('Título\nPegado');
  });

  it('quita marcas de bloque: citas, separadores, tareas, viñetas y código', () => {
    const md = [
      '> cita **fuerte**',
      '---',
      '- [ ] pendiente',
      '- [x] hecha',
      '* viñeta',
      '+ otra',
      '- normal',
      '1. numerada',
      '```js',
      'const a = **b**;',
      '```',
      'Título',
      '======',
    ].join('\n');
    expect(toPlainText(md)).toBe(
      [
        'cita fuerte',
        '',
        '- pendiente',
        '- hecha',
        '- viñeta',
        '- otra',
        '- normal',
        '1. numerada',
        'const a = **b**;',
        'Título',
        '',
      ].join('\n'),
    );
  });

  it('respeta líneas en blanco y sangrías', () => {
    expect(toPlainText('a\n\n\tb  \n')).toBe('a\n\n\tb\n');
  });
});

describe('títulos', () => {
  it('headingText quita los # y las marcas', () => {
    expect(headingText('## **Lunes** [cita](https://a.org)')).toBe('Lunes cita');
    expect(headingText('#')).toBe('');
  });

  it('findHeadings: en orden, con su línea, sin los vacíos ni las tareas hechas', () => {
    const text = '# Lunes\ntexto\n#\n-- # no\n  ## Martes\n# Lunes';
    expect(findHeadings(text)).toEqual([
      { line: 1, text: 'Lunes' },
      { line: 5, text: 'Martes' },
      { line: 6, text: 'Lunes' },
    ]);
    // También con un iterable de líneas (doc.iterLines()).
    expect(findHeadings(text.split('\n')[Symbol.iterator]())).toHaveLength(3);
  });
});

describe('exportFileName', () => {
  it('usa la primera palabra (como la barra de tabs, sin recortar)', () => {
    expect(exportFileName('# Compra semanal\nLeche', 'Pestaña 1')).toBe('Compra.txt');
    expect(exportFileName('Supercalifragilístico largo', 'Pestaña 1')).toBe('Supercalifragilístico.txt');
  });

  it('sin palabras, el nombre de reserva', () => {
    expect(exportFileName('---\n# ', 'Pestaña 2')).toBe('Pestaña 2.txt');
  });
});
