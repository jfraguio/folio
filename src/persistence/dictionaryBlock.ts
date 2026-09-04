/**
 * Bloque del diccionario personal dentro del propio `.md`.
 *
 * Es un comentario HTML al final del archivo: invisible en cualquier visor Markdown,
 * ignorado por el índice de capítulos, el contador y la exportación a TXT, y nunca
 * llega al editor (se separa al leer y se vuelve a unir al guardar).
 *
 *   <!-- folio:diccionario
 *   Palabras que el corrector ortográfico de Folio acepta en esta novela, una por línea.
 *   Este bloque lo mantiene Folio; no forma parte del texto y no se incluye al exportar.
 *
 *   Aldebarán
 *   Kaelith
 *   -->
 *
 * Dentro del bloque, una línea es una palabra si no contiene espacios; las líneas con
 * espacios (la descripción) y las vacías se ignoran. Si el bloque no está al final o está
 * mal cerrado, se trata como texto normal y no se pierde nada.
 */

const MARKER = '<!-- folio:diccionario';
const DESCRIPTION = [
  'Palabras que el corrector ortográfico de Folio acepta en esta novela, una por línea.',
  'Este bloque lo mantiene Folio; no forma parte del texto y no se incluye al exportar.',
];

const BLOCK_RE = /(^|\n)<!-- folio:diccionario[^\n]*\n([\s\S]*?)-->\n?$/;

export interface SplitDocument {
  /** Texto de la novela sin el bloque. */
  body: string;
  /** Palabras del bloque (vacío si no había bloque). */
  words: string[];
}

export function splitDictionaryBlock(text: string): SplitDocument {
  const m = BLOCK_RE.exec(text);
  if (!m) return { body: text, words: [] };
  const words = (m[2] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/\s/.test(l));
  // El salto que precede al bloque es el separador que añade joinDictionaryBlock; no pertenece al texto.
  return { body: text.slice(0, m.index), words };
}

export function joinDictionaryBlock(body: string, words: string[]): string {
  if (words.length === 0) return body;
  const block = [MARKER, ...DESCRIPTION, '', ...words, '-->'].join('\n') + '\n';
  if (body === '') return block;
  return body + (body.endsWith('\n') ? '\n' : '\n\n') + block;
}
