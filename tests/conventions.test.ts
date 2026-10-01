import { describe, expect, it } from 'vitest';
import { URL_RE, WORD_RE, isDone, isHeading } from '../src/text/conventions';
import { countWords } from '../src/text/words';

const words = (s: string) => [...s.matchAll(WORD_RE)].map((m) => m[0]);
const urls = (s: string) => [...s.matchAll(URL_RE)].map((m) => m[0]);

describe('convenciones de texto', () => {
  it('WORD_RE acepta letras con acentos, dígitos y apóstrofos/guiones internos', () => {
    expect(words('¡Hola, Kaelith! 42 añó')).toEqual(['Hola', 'Kaelith', '42', 'añó']);
    expect(words("l'artista i-lla")).toEqual(["l'artista", 'i-lla']);
  });

  it('URL_RE reconoce http(s) y www., hasta un separador', () => {
    // La puntuación final forma parte del match (comportamiento de siempre).
    expect(urls('mira https://folio.example/a?b=1 y www.x.org.')).toEqual([
      'https://folio.example/a?b=1',
      'www.x.org.',
    ]);
  });

  it('título y línea resuelta usan la misma definición que el editor', () => {
    expect(isHeading('#Compra')).toBe(true); // el editor lo pinta como título
    expect(isHeading('  # Compra')).toBe(true);
    expect(isHeading('no # es título')).toBe(false);
    expect(isDone('-- hecho')).toBe(true);
    expect(isDone('  --hecho')).toBe(true);
    expect(isDone('---')).toBe(false); // separador
  });

  it('el contador excluye títulos (también "#Palabra") y separadores', () => {
    expect(countWords('# Compra\nleche y pan')).toBe(3); // «Compra» no cuenta
    expect(countWords('#Compra\nleche')).toBe(1);
    expect(countWords('texto\n---\nmás')).toBe(2);
  });
});
