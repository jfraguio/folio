/** Tokenización compartida por el contador de palabras (historial) y el corrector. */
import { HR_RE, WORD_RE, isHeading } from './conventions';

export { WORD_RE } from './conventions';

/** Cuenta palabras excluyendo líneas de encabezado y separadores. */
export function countWords(text: string): number {
  let n = 0;
  for (const line of text.split('\n')) {
    if (isHeading(line) || HR_RE.test(line)) continue;
    const m = line.match(WORD_RE);
    if (m) n += m.length;
  }
  return n;
}

const NUMBER = new Intl.NumberFormat('es-ES');

export function formatNumber(n: number): string {
  return NUMBER.format(n);
}
