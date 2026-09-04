/**
 * Bloques de Folio dentro del propio `.md`.
 *
 * Son comentarios HTML al final del archivo, en este orden: notas y después diccionario.
 * Invisibles en cualquier visor Markdown, ignorados por el índice de capítulos, el contador
 * y la exportación a TXT, y nunca llegan al editor (se separan al leer y se unen al guardar).
 *
 *   <!-- folio:notas
 *   Notas de trabajo de Folio para esta novela (escaleta, ideas, personajes…).
 *   Este bloque lo mantiene Folio; no forma parte del texto y no se incluye al exportar.
 *
 *   Texto libre de las notas.
 *   -->
 *
 *   <!-- folio:diccionario
 *   Palabras que el corrector ortográfico de Folio acepta en esta novela, una por línea.
 *   Este bloque lo mantiene Folio; no forma parte del texto y no se incluye al exportar.
 *
 *   Aldebarán
 *   Kaelith
 *   -->
 *
 * Cada bloque empieza con su marcador, unas líneas de descripción, una línea vacía y el
 * contenido. Si un bloque no está al final (o mal cerrado), se trata como texto normal y
 * no se pierde nada. Sin contenido no se escribe el bloque.
 */

const FOOTNOTE = 'Este bloque lo mantiene Folio; no forma parte del texto y no se incluye al exportar.';

const NOTES = {
  marker: 'notas',
  description: ['Notas de trabajo de Folio para esta novela (escaleta, ideas, personajes…).', FOOTNOTE],
};

const DICTIONARY = {
  marker: 'diccionario',
  description: ['Palabras que el corrector ortográfico de Folio acepta en esta novela, una por línea.', FOOTNOTE],
};

export interface NovelDocument {
  /** Texto de la novela sin los bloques. */
  body: string;
  /** Notas de trabajo ('' si no hay). */
  notes: string;
  /** Palabras del diccionario personal (vacío si no hay). */
  words: string[];
}

export function splitDocument(text: string): NovelDocument {
  const dict = splitBlock(text, DICTIONARY.marker);
  const notes = splitBlock(dict.body, NOTES.marker);
  const words = (dict.content ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/\s/.test(l));
  return { body: notes.body, notes: notes.content === null ? '' : unescapeNotes(notes.content), words };
}

export function joinDocument(doc: NovelDocument): string {
  let out = doc.body;
  if (doc.notes.trim()) out = joinBlock(out, NOTES.marker, NOTES.description, escapeNotes(doc.notes));
  if (doc.words.length) out = joinBlock(out, DICTIONARY.marker, DICTIONARY.description, doc.words.join('\n'));
  return out;
}

// ---------- genérico ----------

function blockRe(marker: string): RegExp {
  // El interior no puede contener "-->": así un bloque nunca se traga a otro.
  return new RegExp(`(^|\\n)<!-- folio:${marker}[^\\n]*\\n((?:(?!-->)[\\s\\S])*)-->\\n?$`);
}

/** Separa un bloque situado al final. `content` es null si no hay bloque. */
function splitBlock(text: string, marker: string): { body: string; content: string | null } {
  const m = blockRe(marker).exec(text);
  if (!m) return { body: text, content: null };
  // Lo que hay entre el marcador y "-->": descripción, línea vacía, contenido, salto final.
  let inner = m[2] ?? '';
  if (inner.endsWith('\n')) inner = inner.slice(0, -1);
  const sep = inner.indexOf('\n\n');
  const content = sep === -1 ? inner : inner.slice(sep + 2);
  // El salto que precede al bloque es el separador que añade joinBlock; no pertenece al texto.
  return { body: text.slice(0, m.index), content };
}

function joinBlock(body: string, marker: string, description: string[], content: string): string {
  const block = [`<!-- folio:${marker}`, ...description, '', content, '-->'].join('\n') + '\n';
  if (body === '') return block;
  return body + (body.endsWith('\n') ? '\n' : '\n\n') + block;
}

// Un "-->" dentro de las notas cerraría el comentario antes de tiempo.
const escapeNotes = (s: string) => s.replace(/-->/g, '--\\>');
const unescapeNotes = (s: string) => s.replace(/--\\>/g, '-->');
