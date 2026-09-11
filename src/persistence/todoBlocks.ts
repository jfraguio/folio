/**
 * Formato del `.md` de to-do.
 *
 * El documento son las 10 tabs, separadas por marcadores `[todo:tab N]` en línea propia.
 * Las tabs vacías no se escriben; un archivo sin marcadores se carga entero en la tab 1.
 * Al final, como comentario HTML, viaja el diccionario personal:
 *
 *   [todo:tab 1]
 *   Contenido de la primera tab.
 *   [todo:tab 4]
 *   Contenido de la cuarta tab.
 *
 *   <!-- todo:diccionario
 *   Palabras que el corrector ortográfico de to-do acepta, una por línea.
 *   Este bloque lo mantiene to-do; no forma parte del texto.
 *
 *   Aldebarán
 *   Kaelith
 *   -->
 *
 * El bloque del diccionario: marcador, líneas de descripción, una línea vacía y el contenido.
 * Si no está al final (o mal cerrado), se trata como texto normal y no se pierde nada.
 * Sin palabras no se escribe el bloque. Un "-->" dentro del diccionario se escapa como "--\>".
 */

/** Número de tabs (espacios de texto) de la aplicación. */
export const TAB_COUNT = 10;

const TAB_RE = /(^|\n)\[todo:tab (\d+)\]\n/g;

const DICTIONARY = {
  marker: 'diccionario',
  description: [
    'Palabras que el corrector ortográfico de to-do acepta, una por línea.',
    'Este bloque lo mantiene to-do; no forma parte del texto.',
  ],
};

export interface TodoDocument {
  /** Espacios de texto, siempre TAB_COUNT elementos ('' los vacíos). */
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
  return tabs
    .map((t, i) => (t.trim() ? `[todo:tab ${i + 1}]\n${t.replace(/\n+$/, '')}` : ''))
    .filter(Boolean)
    .join('\n');
}

function parseTabs(text: string): string[] {
  const tabs: string[] = Array.from({ length: TAB_COUNT }, () => '');
  if (!text) return tabs;
  const marks = [...text.matchAll(TAB_RE)];
  if (marks.length === 0 || (marks[0]!.index ?? 0) > 0) {
    // Sin marcador inicial (texto plano cualquiera o editado a mano): todo a la primera tab.
    tabs[0] = text;
    return tabs;
  }
  marks.forEach((m, k) => {
    const start = (m.index ?? 0) + m[0].length;
    const next = marks[k + 1];
    const end = next ? (next.index ?? 0) : text.length;
    const idx = Number(m[2]) - 1;
    // Al escribir se recorta el salto final de cada tab; al leer, solo el último contenido
    // puede arrastrar el salto que quedó antes del bloque de diccionario: se descarta.
    let content = text.slice(start, end);
    if (!next && content.endsWith('\n')) content = content.slice(0, -1);
    if (idx >= 0 && idx < TAB_COUNT) tabs[idx] += content;
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
