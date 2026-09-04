/** Tokenización compartida por contador de palabras y corrector. */

export const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

const HEADING_RE = /^\s{0,3}#{1,6}\s/;
const HR_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

/** Cuenta palabras excluyendo líneas de encabezado y separadores. */
export function countWords(text: string): number {
  let n = 0;
  for (const line of text.split('\n')) {
    if (HEADING_RE.test(line) || HR_RE.test(line)) continue;
    const m = line.match(WORD_RE);
    if (m) n += m.length;
  }
  return n;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n);
}

export function isHeadingLine(line: string): boolean {
  return HEADING_RE.test(line);
}

export function isHrLine(line: string): boolean {
  return HR_RE.test(line);
}
