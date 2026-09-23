/**
 * Formato del archivo de folio (`.txt`; los `.md` anteriores tienen el mismo contenido).
 * Los marcadores conservan el prefijo `todo:` del nombre anterior de la app, para que los
 * archivos existentes se sigan leyendo igual.
 *
 * El documento son las tabs (de 1 a TAB_COUNT), separadas por marcadores `[todo:tab N]` en
 * línea propia, donde N es la posición de la tab. Cada tab puede tener hasta TAB_COUNT subtabs,
 * con marcador `[todo:tab N.M]` (M = posición de la subtab), que van justo después del
 * contenido de su tab. Una tab o subtab vacía se escribe solo con su marcador, para que siga
 * existiendo al reabrir; un archivo con una única tab vacía y sin subtabs queda vacío del todo.
 * Un archivo sin marcadores se carga entero en la tab 1.
 * Al final, como comentario HTML, viaja el diccionario personal:
 *
 *   [todo:tab 1]
 *   Contenido de la primera tab.
 *   [todo:tab 1.1]
 *   Contenido de la primera subtab de la primera tab.
 *   [todo:tab 1.2]
 *   [todo:tab 2]
 *   [todo:tab 3]
 *   Contenido de la tercera tab (la segunda está vacía, y la subtab 1.2 también).
 *
 *   <!-- todo:diccionario
 *   Palabras que el corrector ortográfico de folio acepta, una por línea.
 *   Este bloque lo mantiene folio; no forma parte del texto.
 *
 *   Aldebarán
 *   Kaelith
 *   -->
 *
 * Archivos anteriores (que omitían las tabs vacías): los huecos entre marcadores se leen como
 * tabs vacías, así nada cambia de sitio. Una versión anterior de la aplicación (sin subtabs)
 * lee los marcadores `N.M` como texto de la tab N: no se pierde nada.
 *
 * El bloque del diccionario: marcador, líneas de descripción, una línea vacía y el contenido.
 * Si no está al final (o mal cerrado), se trata como texto normal y no se pierde nada.
 * Sin palabras no se escribe el bloque. Un "-->" dentro del diccionario se escapa como "--\>".
 */

/** Número máximo de tabs (espacios de texto) de la aplicación, y de subtabs por tab. */
export const TAB_COUNT = 10;

/** Marcador de tab (`[todo:tab N]`) o de subtab (`[todo:tab N.M]`): una línea entera. */
const TAB_RE = /^\[todo:tab (\d+)(?:\.(\d+))?\]$/gm;

const DICTIONARY = {
  marker: 'diccionario',
  description: [
    'Palabras que el corrector ortográfico de folio acepta, una por línea.',
    'Este bloque lo mantiene folio; no forma parte del texto.',
  ],
};

/** Una tab: su texto y sus subtabs (de 0 a TAB_COUNT textos). */
export interface Tab {
  text: string;
  subs: string[];
}

export interface TodoDocument {
  /** Espacios de texto, de 1 a TAB_COUNT elementos. */
  tabs: Tab[];
  /** Palabras del diccionario personal (vacío si no hay). */
  words: string[];
}

/** Una tab vacía, sin subtabs. */
export const emptyTab = (): Tab => ({ text: '', subs: [] });

/** Todos los textos del documento (tabs y subtabs), en el orden del archivo. */
export function allTexts(tabs: Tab[]): string[] {
  return tabs.flatMap((t) => [t.text, ...t.subs]);
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

function serializeTabs(tabs: Tab[]): string {
  // Una sola tab vacía y sin subtabs es el documento vacío: un archivo nuevo sigue estando en blanco.
  if (tabs.length <= 1 && !(tabs[0]?.text ?? '').trim() && !(tabs[0]?.subs.length ?? 0)) return '';
  const block = (marker: string, t: string) => (t.trim() ? `${marker}\n${t.replace(/\n+$/, '')}` : marker);
  return tabs
    .slice(0, TAB_COUNT)
    .flatMap((tab, i) => [
      block(`[todo:tab ${i + 1}]`, tab.text),
      ...tab.subs.slice(0, TAB_COUNT).map((s, j) => block(`[todo:tab ${i + 1}.${j + 1}]`, s)),
    ])
    .join('\n');
}

function parseTabs(text: string): Tab[] {
  if (!text) return [emptyTab()];
  const marks = [...text.matchAll(TAB_RE)];
  if (marks.length === 0 || (marks[0]!.index ?? 0) > 0) {
    // Sin marcador inicial (texto plano cualquiera o editado a mano): todo a la primera tab.
    return [{ text, subs: [] }];
  }
  // Tantas tabs como indique el marcador más alto: los huecos son tabs vacías. Lo mismo con las
  // subtabs de cada tab.
  const highest = Math.max(...marks.map((m) => Number(m[1])));
  const count = Math.max(1, Math.min(TAB_COUNT, highest));
  const tabs: Tab[] = Array.from({ length: count }, emptyTab);
  for (const m of marks) {
    const idx = Number(m[1]) - 1;
    if (idx < 0 || idx >= count || m[2] === undefined) continue;
    const subs = tabs[idx]!.subs;
    const need = Math.min(TAB_COUNT, Number(m[2]));
    while (subs.length < need) subs.push('');
  }
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
    if (idx < 0 || idx >= count) return;
    const tab = tabs[idx]!;
    if (m[2] === undefined) {
      tab.text += content;
      return;
    }
    const sub = Number(m[2]) - 1;
    if (sub >= 0 && sub < tab.subs.length) tab.subs[sub] += content;
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
