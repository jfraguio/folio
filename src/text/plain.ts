import { DONE_RE, HEADING_RE, HR_RE, linkHref, WORD_RE } from './conventions';

/*
 * Texto plano legible a partir del texto de una tab: sin las convenciones de folio (`#` de los
 * títulos, `--` de las tareas hechas) ni las marcas de Markdown que se hayan colado (énfasis,
 * código, citas, enlaces, separadores…). Lo usan «Títulos» (las etiquetas del menú) y
 * «Exportar pestaña» (el .txt descargado).
 */

/** Carácter de uso privado que no aparece al escribir: delimita los fragmentos protegidos. */
const MARK = '\uE000';
const PROTECTED_RE = new RegExp(`${MARK}(\\d+)${MARK}`, 'g');

/** Caracteres que Markdown permite escapar con `\`. */
const ESCAPE_RE = /\\([\\`*_{}[\]()#+\-.!>~|<])/g;
/** Código en línea: `x`, ``x``… (el mismo número de comillas abre y cierra). */
const CODE_RE = /(`+)([^`\n]|[^`\n][\s\S]*?[^`\n])\1(?!`)/g;
/** Imagen: ![alt](url "título"). Se queda el texto alternativo. */
const IMAGE_RE = /!\[([^[\]\n]*)\]\(([^\s()]+)(?:\s+"[^"\n]*")?\)/g;
/** Enlace: [texto](url "título"). */
const LINK_RE = /\[([^[\]\n]+)\]\(([^\s()]+)(?:\s+"[^"\n]*")?\)/g;
/** Enlace automático: <https://…>. */
const AUTOLINK_RE = /<((?:https?:\/\/|mailto:)[^\s<>]+)>/gi;

/**
 * Énfasis (`***`, `**`, `*`, `___`, `__`, `_`) y tachado (`~~`). Solo cuando la marca no está pegada
 * a una letra o un número por fuera (así `2*3*4` o `nombre_de_archivo` no se tocan) y el texto de
 * dentro no empieza ni acaba en espacio.
 */
const EMPHASIS_RE = /(?<![\p{L}\p{N}\\])(\*{1,3}|_{1,3}|~~)(?=\S)([^\n]*?\S)\1(?![\p{L}\p{N}])/gu;

/** Prefijos de línea. */
const HEADING_PREFIX_RE = /^[ \t]*#+[ \t]*/;
const HEADING_CLOSING_RE = /[ \t]+#+[ \t]*$/;
const DONE_PREFIX_RE = /^([ \t]*)--[ \t]*/;
const QUOTE_PREFIX_RE = /^([ \t]*)(?:>[ \t]?)+/;
const TASK_PREFIX_RE = /^([ \t]*)[-*+][ \t]+\[[ xX]\][ \t]+/;
const BULLET_PREFIX_RE = /^([ \t]*)[*+][ \t]+/;
const FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})/;
/** Subrayado de un título «setext» (`===`). Los de `---` ya son separadores (HR_RE). */
const SETEXT_RE = /^[ \t]{0,3}=+[ \t]*$/;

export interface InlineOptions {
  /** Añade la URL tras el texto de cada enlace: «texto (url)». Si no, queda solo el texto. */
  urls?: boolean;
}

/** Quita las marcas en línea (énfasis, código, enlaces, imágenes, escapes) de un fragmento de texto. */
export function plainInline(text: string, o: InlineOptions = {}): string {
  // Lo que no debe volver a procesarse (el contenido del código, los caracteres escapados) se
  // aparta y se repone al final.
  const kept: string[] = [];
  const keep = (s: string) => `${MARK}${kept.push(s) - 1}${MARK}`;

  let s = text
    .replace(CODE_RE, (_, _ticks: string, code: string) => keep(code))
    .replace(ESCAPE_RE, (_, ch: string) => keep(ch))
    .replace(IMAGE_RE, (_, alt: string) => alt)
    .replace(LINK_RE, (whole, label: string, url: string) => {
      const href = linkHref(url);
      if (!o.urls || !href) return href ? label : whole;
      return sameTarget(label, url) ? label : `${label} (${url})`;
    })
    .replace(AUTOLINK_RE, (_, url: string) => url);

  // El énfasis puede anidarse (**negrita con _cursiva_**): se repite hasta que no quede nada.
  for (let prev = ''; prev !== s;) {
    prev = s;
    s = s.replace(EMPHASIS_RE, (_, _mark: string, inner: string) => inner);
  }
  return s.replace(PROTECTED_RE, (_, i: string) => kept[Number(i)] ?? '');
}

/** ¿El texto del enlace ya es su URL (con o sin esquema)? Entonces no hace falta repetirla. */
function sameTarget(label: string, url: string): boolean {
  const bare = (u: string) => u.replace(/^(?:https?:\/\/|mailto:|tel:)/i, '').replace(/\/$/, '');
  return bare(label) === bare(url);
}

/** Texto de un título (`# Semana` → `Semana`), ya sin marcas. Vacío si el título no tiene texto. */
export function headingText(line: string): string {
  return plainInline(line.replace(HEADING_PREFIX_RE, '').replace(HEADING_CLOSING_RE, '')).trim();
}

/** Texto plano legible de una tab (ver la cabecera del módulo). Respeta líneas y sangrías. */
export function toPlainText(text: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of text.split('\n')) {
    const f = FENCE_RE.exec(line)?.[1];
    if (fence !== null) {
      // Dentro de un bloque de código el texto se deja tal cual; la valla de cierre desaparece.
      if (f && f[0] === fence[0] && f.length >= fence.length && !line.slice(line.indexOf(f) + f.length).trim())
        fence = null;
      else out.push(line);
      continue;
    }
    if (f) {
      fence = f;
      continue;
    }
    out.push(plainLine(line));
  }
  return out.join('\n');
}

function plainLine(line: string): string {
  // Un separador (---, ***) o el subrayado de un título se quedan en una línea en blanco.
  if (HR_RE.test(line) || SETEXT_RE.test(line)) return '';
  // Una línea hecha («--») tiene prioridad sobre un título, como en el editor.
  if (DONE_RE.test(line)) return plainBody(line.replace(DONE_PREFIX_RE, '$1'));
  if (HEADING_RE.test(line)) return headingText(line);
  return plainBody(line);
}

/** Cuerpo de una línea normal: sin la marca de cita, con viñetas uniformes y sin marcas en línea. */
function plainBody(line: string): string {
  const s = line.replace(QUOTE_PREFIX_RE, '$1').replace(TASK_PREFIX_RE, '$1- ').replace(BULLET_PREFIX_RE, '$1- ');
  return plainInline(s, { urls: true }).replace(/[ \t]+$/, '');
}

/** Un título de la tab: su línea (desde 1) y su texto, ya sin marcas. */
export interface Heading {
  line: number;
  text: string;
}

/**
 * Títulos de una tab, en orden. Son las líneas que el editor pinta como título (`#` al principio y
 * no `--`); se omiten las que no tienen texto (un `#` suelto). Acepta un texto o sus líneas (p. ej.
 * `doc.iterLines()` de CodeMirror, para no copiar el documento entero).
 */
export function findHeadings(source: string | Iterable<string>): Heading[] {
  const lines = typeof source === 'string' ? source.split('\n') : source;
  const out: Heading[] = [];
  let n = 0;
  for (const line of lines) {
    n++;
    if (DONE_RE.test(line) || !HEADING_RE.test(line)) continue;
    const text = headingText(line);
    if (text) out.push({ line: n, text });
  }
  return out;
}

/**
 * Nombre del .txt exportado: el título de la tab (su primera palabra, el mismo cálculo que
 * `tabTitle` en la barra, pero sin recortar) o `fallback` si no tiene ninguna. Las palabras solo llevan letras, números, apóstrofos
 * y guiones, así que el nombre siempre es válido.
 */
export function exportFileName(text: string, fallback: string): string {
  const word = text.match(WORD_RE)?.[0];
  return `${word ?? fallback}.txt`;
}
