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
