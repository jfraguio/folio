/**
 * Formato del `.md` de to-do.
 *
 * El documento son las tabs (de 1 a TAB_COUNT), separadas por marcadores `[todo:tab N]` en
 * línea propia, donde N es la posición de la tab. Una tab vacía se escribe solo con su marcador,
 * para que siga existiendo al reabrir; un archivo con una única tab vacía queda vacío del todo.
 * Un archivo sin marcadores se carga entero en la tab 1.
 * Al final, como comentario HTML, viaja el diccionario personal:
 *
 *   [todo:tab 1]
 *   Contenido de la primera tab.
 *   [todo:tab 2]
 *   [todo:tab 3]
 *   Contenido de la tercera tab (la segunda está vacía).
 *
 *   <!-- todo:diccionario
 *   Palabras que el corrector ortográfico de to-do acepta, una por línea.
 *   Este bloque lo mantiene to-do; no forma parte del texto.
 *
 *   Aldebarán
 *   Kaelith
 *   -->
 *
 * Archivos anteriores (que omitían las tabs vacías): los huecos entre marcadores se leen como
 * tabs vacías, así nada cambia de sitio.
 *
 * El bloque del diccionario: marcador, líneas de descripción, una línea vacía y el contenido.
 * Si no está al final (o mal cerrado), se trata como texto normal y no se pierde nada.
 * Sin palabras no se escribe el bloque. Un "-->" dentro del diccionario se escapa como "--\>".
 */

/** Número máximo de tabs (espacios de texto) de la aplicación. */
export const TAB_COUNT = 10;

/** Marcador de tab: una línea entera. */
const TAB_RE = /^\[todo:tab (\d+)\]$/gm;

const DICTIONARY = {
  marker: 'diccionario',
  description: [
    'Palabras que el corrector ortográfico de to-do acepta, una por línea.',
    'Este bloque lo mantiene to-do; no forma parte del texto.',
  ],
};

export interface TodoDocument {
  /** Espacios de texto, de 1 a TAB_COUNT elementos ('' los vacíos). */
  tabs: string[];
  /** Palabras del diccionario personal (vacío si no hay). */
  words: string[];
}

export function splitDocument(text: string): TodoDocument {
  const dict = splitBlock(text, DICTIONARY.marker);
  const words = (dict.content ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/\s/.test(l));
  return { tabs: parseTabs(dict.body), words };
}

export function joinDocument(doc: TodoDocument): string {
  let out = serializeTabs(doc.tabs);
  if (doc.words.length) out = joinBlock(out, DICTIONARY.marker, DICTIONARY.description, escapeInner(doc.words.join('\n')));
  return out;
}

// ---------- pestañas ----------

function serializeTabs(tabs: string[]): string {
  // Una sola tab vacía es el documento vacío: un archivo nuevo sigue estando en blanco.
  if (tabs.length <= 1 && !(tabs[0] ?? '').trim()) return '';
  return tabs
    .slice(0, TAB_COUNT)
    .map((t, i) => (t.trim() ? `[todo:tab ${i + 1}]\n${t.replace(/\n+$/, '')}` : `[todo:tab ${i + 1}]`))
    .join('\n');
}

function parseTabs(text: string): string[] {
  if (!text) return [''];
  const marks = [...text.matchAll(TAB_RE)];
  if (marks.length === 0 || (marks[0]!.index ?? 0) > 0) {
    // Sin marcador inicial (texto plano cualquiera o editado a mano): todo a la primera tab.
    return [text];
  }
  // Tantas tabs como indique el marcador más alto: los huecos son tabs vacías.
  const highest = Math.max(...marks.map((m) => Number(m[1])));
  const count = Math.max(1, Math.min(TAB_COUNT, highest));
  const tabs: string[] = Array.from({ length: count }, () => '');
  marks.forEach((m, k) => {
    const start = (m.index ?? 0) + m[0].length;
    const next = marks[k + 1];
    const end = next ? (next.index ?? 0) : text.length;
    const idx = Number(m[1]) - 1;
    // Tras el marcador va un salto de línea (si hay algo después) y, antes del siguiente
    // marcador, el salto que los separa: ninguno de los dos es contenido. Al escribir se recorta
    // el salto final de cada tab; al leer, solo el último contenido puede arrastrar el salto que
    // quedó antes del bloque de diccionario: se descarta también.
    let content = text.slice(start, end);
    if (content.startsWith('\n')) content = content.slice(1);
    if (content.endsWith('\n')) content = content.slice(0, -1);
    if (idx >= 0 && idx < count) tabs[idx] += content;
  });
  return tabs;
}

// ---------- bloque de diccionario (genérico, al final del documento) ----------

function blockRe(marker: string): RegExp {
  // El interior no puede contener "-->": así el bloque nunca se cierra antes de tiempo.
  return new RegExp(`(^|\\n)<!-- todo:${marker}[^\\n]*\\n((?:(?!-->)[\\s\\S])*)-->\\n?$`);
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
  return { body: text.slice(0, m.index), content: unescapeInner(content) };
}

function joinBlock(body: string, marker: string, description: string[], content: string): string {
  const block = [`<!-- todo:${marker}`, ...description, '', content, '-->'].join('\n') + '\n';
  if (body === '') return block;
  return body + (body.endsWith('\n') ? '\n' : '\n\n') + block;
}

// Un "-->" dentro del contenido cerraría el comentario antes de tiempo.
const escapeInner = (s: string) => s.replace(/-->/g, '--\\>');
const unescapeInner = (s: string) => s.replace(/--\\>/g, '-->');
