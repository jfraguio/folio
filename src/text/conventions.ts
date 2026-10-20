/**
 * Convenciones de texto del formato de folio, en un único sitio. Antes estaban repetidas (y no
 * siempre coincidentes) en el editor, el contador de palabras y el corrector.
 */

/**
 * Palabra: letras (con sus marcas de acento), números y apóstrofos o guiones internos. El corrector
 * descarta aparte las que llevan dígitos (`shouldSkip`), pero así el tokenizador es el mismo.
 */
export const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu;

/** URL web: http(s)://… o www.…, hasta un espacio o un carácter de cierre. */
export const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'()]+/giu;

/**
 * Enlace con la sintaxis de Markdown: `[texto](url)`. El texto no puede llevar corchetes ni saltos
 * de línea y la URL no puede llevar espacios ni paréntesis (al crearlo se codifican, ver
 * `markdownLink`). Grupo 1: texto; grupo 2: URL.
 */
export const MD_LINK_RE = /\[([^[\]\n]+)\]\(([^\s()]+)\)/g;

/** Un enlace `[texto](url)` dentro de una línea, con las posiciones relativas a esa línea. */
export interface MarkdownLink {
  /** Del `[` al `)`, ambos incluidos. */
  from: number;
  to: number;
  /** Texto visible (entre los corchetes). */
  textFrom: number;
  textTo: number;
  /** URL tal cual está escrita (entre los paréntesis). */
  urlFrom: number;
  urlTo: number;
  /** Destino que se abre (ver `linkHref`). */
  href: string;
}

/**
 * Destino seguro de un enlace: http(s), mailto y tel se usan tal cual; sin esquema (`www.x.org`,
 * `x.org/a`) se les antepone https://; cualquier otro esquema (`javascript:`, `data:`, …) se
 * descarta y el texto no se trata como enlace.
 */
export function linkHref(url: string): string | null {
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return null;
  return `https://${url}`;
}

/** Enlaces `[texto](url)` válidos de una línea, en orden. */
export function findLinks(line: string): MarkdownLink[] {
  const out: MarkdownLink[] = [];
  MD_LINK_RE.lastIndex = 0;
  for (const m of line.matchAll(MD_LINK_RE)) {
    const href = linkHref(m[2]!);
    if (!href) continue;
    const from = m.index!;
    const textFrom = from + 1;
    const textTo = textFrom + m[1]!.length;
    const urlFrom = textTo + 2; // tras "]("
    const urlTo = urlFrom + m[2]!.length;
    out.push({ from, to: urlTo + 1, textFrom, textTo, urlFrom, urlTo, href });
  }
  return out;
}

/** Sustituye cada enlace `[texto](url)` por su texto (lo que se lee en pantalla). */
export function stripLinks(text: string): string {
  return text.replace(MD_LINK_RE, (whole, label: string, url: string) => (linkHref(url) ? label : whole));
}

/** ¿El texto (ya recortado) es una sola URL que se puede convertir en enlace al pegarla? */
export function isPastableUrl(text: string): boolean {
  return /^(?:https?:\/\/|www\.)[^\s<>"]+$/i.test(text) || /^mailto:[^\s<>"]+$/i.test(text);
}

/** URL lista para ir entre los paréntesis de un enlace: sus paréntesis se codifican para no cerrarlo antes de tiempo. */
export function encodeLinkUrl(url: string): string {
  return url.replace(/\(/g, '%28').replace(/\)/g, '%29');
}

/** Escribe `[texto](url)`. */
export function markdownLink(text: string, url: string): string {
  return `[${text}](${encodeLinkUrl(url)})`;
}

/** Título de folio: una línea que empieza por "#" (tras espacios o tabulaciones). */
export const HEADING_RE = /^[ \t]*#/;

/** Línea resuelta: "--" tras espacios/tabs, sin contar separadores ("---", "-----"). */
export const DONE_RE = /^[ \t]*--(?!-)/;

/** Separador markdown (---, ***, ___) que el contador de palabras ignora. */
export const HR_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

/** ¿La línea es un título? */
export const isHeading = (line: string): boolean => HEADING_RE.test(line);

/** ¿La línea está resuelta (tachada)? */
export const isDone = (line: string): boolean => DONE_RE.test(line);
