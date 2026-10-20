import type { EditorState } from '@codemirror/state';
import { ViewPlugin, type EditorView } from '@codemirror/view';
import { URL_RE, findLinks } from '../text/conventions';

/**
 * Copiar con enlaces. Al copiar o cortar, además del texto plano de siempre (con la sintaxis
 * `[texto](url)`, para que al pegar en folio el enlace se conserve), se deja en el portapapeles una
 * versión HTML en la que cada enlace es un `<a href>`. Las aplicaciones con formato (Teams, Outlook,
 * Word, Gmail, Slack…) pegan esa y el enlace llega clicable; las de solo texto siguen pegando el
 * texto plano.
 *
 * - El HTML no lleva estilos: el texto toma los de la aplicación de destino. Los saltos de línea
 *   van como `<br>`.
 * - Las URLs sueltas también van como enlace.
 * - Un enlace copiado a medias (p. ej. «esta» de «esta web») va como enlace con ese trozo de texto,
 *   también en el texto plano: `[esta](url)`.
 * - Si lo copiado no tiene ningún enlace, no se toca nada: el portapapeles queda como siempre.
 *
 * Lo demás lo sigue haciendo CodeMirror (copiar la línea entera si no hay selección, borrar al
 * cortar, varias selecciones…): esto solo completa lo que él escribe en el portapapeles.
 */

export interface ClipboardContent {
  /** Texto plano: el del documento, salvo los enlaces copiados a medias, que se completan. */
  text: string;
  /** Versión HTML con los enlaces como `<a href>`. */
  html: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Texto para el HTML: escapado y con tabuladores y espacios seguidos conservados (el HTML los colapsaría). */
const htmlText = (s: string): string =>
  escapeHtml(s).replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/ {2}/g, ' &nbsp;');

const anchor = (href: string, label: string): string => `<a href="${escapeHtml(href)}">${htmlText(label)}</a>`;

/** Trozo de texto sin enlaces Markdown: las URLs sueltas que contenga pasan a ser enlaces. */
function plainChunk(s: string): { html: string; links: number } {
  let html = '';
  let links = 0;
  let p = 0;
  URL_RE.lastIndex = 0;
  for (const m of s.matchAll(URL_RE)) {
    const raw = m[0];
    html += htmlText(s.slice(p, m.index)) + anchor(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`, raw);
    p = m.index! + raw.length;
    links++;
  }
  return { html: html + htmlText(s.slice(p)), links };
}

/** El trozo [a, b) de una línea, en texto plano y en HTML. */
function serializeSegment(line: string, a: number, b: number): ClipboardContent & { links: number } {
  let text = '';
  let html = '';
  let links = 0;
  let p = a;
  const pushPlain = (s: string) => {
    const c = plainChunk(s);
    text += s;
    html += c.html;
    links += c.links;
  };
  for (const l of findLinks(line)) {
    if (l.to <= a || l.from >= b) continue;
    if (l.from > p) pushPlain(line.slice(p, l.from));
    const url = line.slice(l.urlFrom, l.urlTo);
    if (a <= l.from && b >= l.to) {
      // El enlace entero.
      text += line.slice(l.from, l.to);
      html += anchor(l.href, line.slice(l.textFrom, l.textTo));
      links++;
    } else {
      // A medias: lo que se copie de su texto sigue siendo un enlace al mismo destino. Si solo se
      // ha copiado sintaxis (los corchetes o un trozo de la URL, con el enlace desplegado), va tal cual.
      const tf = Math.max(a, l.textFrom);
      const tt = Math.min(b, l.textTo);
      if (tt > tf) {
        const label = line.slice(tf, tt);
        text += `[${label}](${url})`;
        html += anchor(l.href, label);
        links++;
      } else {
        pushPlain(line.slice(Math.max(a, l.from), Math.min(b, l.to)));
      }
    }
    p = Math.min(b, l.to);
  }
  if (p < b) pushPlain(line.slice(p, b));
  return { text, html, links };
}

/** Del documento entre `from` y `to` (puede abarcar varias líneas). */
function serializeRange(state: EditorState, from: number, to: number): ClipboardContent & { links: number } {
  const parts: Array<ClipboardContent & { links: number }> = [];
  for (let pos = from; ;) {
    const line = state.doc.lineAt(pos);
    parts.push(serializeSegment(line.text, pos - line.from, Math.min(to, line.to) - line.from));
    if (line.to >= to) break;
    pos = line.to + 1;
  }
  return {
    text: parts.map((p) => p.text).join(state.lineBreak),
    html: parts.map((p) => p.html).join('<br>'),
    links: parts.reduce((n, p) => n + p.links, 0),
  };
}

/**
 * Lo que va al portapapeles al copiar la selección actual, o `null` si no lleva enlaces (entonces se
 * deja la copia normal de CodeMirror). Recorre lo mismo que copia CodeMirror: los rangos
 * seleccionados o, si todos están vacíos, las líneas enteras donde están los cursores.
 */
export function clipboardContent(state: EditorState): ClipboardContent | null {
  const chunks: Array<ClipboardContent & { links: number }> = [];
  const ranges = state.selection.ranges.filter((r) => !r.empty);
  if (ranges.length) {
    for (const r of ranges) chunks.push(serializeRange(state, r.from, r.to));
  } else {
    let upto = -1;
    for (const { from } of state.selection.ranges) {
      const line = state.doc.lineAt(from);
      if (line.number > upto) chunks.push(serializeRange(state, line.from, line.to));
      upto = line.number;
    }
  }
  if (!chunks.some((c) => c.links > 0)) return null;
  // Sin `<meta charset>`: el navegador ya lo añade al pasar el HTML al portapapeles del sistema.
  return {
    text: chunks.map((c) => c.text).join(state.lineBreak),
    html: chunks.map((c) => c.html).join('<br>'),
  };
}

/**
 * Completa el portapapeles de CodeMirror. El contenido se calcula en la fase de captura, antes de
 * que CodeMirror actúe (al cortar, después ya no estaría en el documento), y se escribe en la de
 * burbuja, después de él, solo si él ha usado el portapapeles del evento (`defaultPrevented`): si no
 * lo ha hecho (la selección no era del editor, o el navegador no lo permite), no se toca nada.
 */
export function richCopy() {
  return ViewPlugin.fromClass(
    class {
      private pending: ClipboardContent | null = null;

      constructor(private readonly view: EditorView) {
        for (const type of ['copy', 'cut']) {
          view.dom.addEventListener(type, this.capture, true);
          view.dom.addEventListener(type, this.write);
        }
      }

      private capture = () => {
        this.pending = clipboardContent(this.view.state);
      };

      private write = (event: Event) => {
        const content = this.pending;
        this.pending = null;
        const data = (event as ClipboardEvent).clipboardData;
        if (!content || !data || !event.defaultPrevented) return;
        data.setData('text/plain', content.text);
        data.setData('text/html', content.html);
      };

      destroy() {
        for (const type of ['copy', 'cut']) {
          this.view.dom.removeEventListener(type, this.capture, true);
          this.view.dom.removeEventListener(type, this.write);
        }
      }
    },
  );
}
