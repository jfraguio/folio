import {
  Annotation,
  ChangeSet,
  EditorSelection,
  EditorState,
  Prec,
  RangeSet,
  findClusterBreak,
  type ChangeSpec,
  type Range,
  type Transaction,
  type TransactionSpec,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
  type Command,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { URL_RE, encodeLinkUrl, findLinks, isPastableUrl, markdownLink } from '../text/conventions';

/**
 * Enlaces clicables en el editor. Hay dos clases:
 *
 * - **URLs sueltas** (`https://…`, `www.…`): se subrayan tal cual.
 * - **Enlaces Markdown** `[texto](url)`: solo se ve el texto, subrayado, siempre; los corchetes y
 *   la URL no se muestran nunca. El destino se ve en el `title` al pasar el ratón.
 *
 * Como la sintaxis no se ve, el editor la protege (ver `linkIntegrity`): el cursor la salta y los
 * borrados actúan sobre el texto del enlace, como si fuera una palabra más.
 *
 * El documento sigue siendo texto plano: solo se decora. ⌘/Ctrl+clic abre el enlace en una pestaña
 * nueva; un clic simple coloca el cursor con normalidad (no navega).
 *
 * En táctil no hay modificadores: un toque sobre un enlace lo abre si el editor no tenía el
 * foco (se está leyendo). Si se estaba escribiendo, el toque coloca el cursor como siempre.
 *
 * Pegar una URL con texto seleccionado convierte la selección en `[selección](url)` (o, si la
 * selección está dentro del texto de un enlace, le cambia la URL: así se edita el destino).
 */

const linkMark = Decoration.mark({ class: 'cm-link' });
const hidden = Decoration.replace({});

interface Built {
  decorations: DecorationSet;
  /** Solo la sintaxis oculta: el cursor no puede quedarse dentro (`atomicRanges`). */
  atomic: RangeSet<Decoration>;
}

function build(view: EditorView): Built {
  const { state } = view;
  const decos: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  let lastLine = 0;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      pos = line.to + 1;
      if (line.number <= lastLine) continue;
      lastLine = line.number;
      const links = findLinks(line.text);
      for (const l of links) {
        const a = line.from + l.from;
        const b = line.from + l.to;
        const tf = line.from + l.textFrom;
        const tt = line.from + l.textTo;
        // El destino se ve al pasar el ratón, ya que la URL está oculta.
        const text = Decoration.mark({ class: 'cm-link', attributes: { title: l.href } });
        const open = hidden.range(a, tf);
        const close = hidden.range(tt, b);
        decos.push(open, text.range(tf, tt), close);
        atomic.push(open, close);
      }
      URL_RE.lastIndex = 0;
      for (const m of line.text.matchAll(URL_RE)) {
        const f = m.index!;
        const t = f + m[0].length;
        if (links.some((l) => f < l.to && t > l.from)) continue; // la URL de un enlace Markdown
        decos.push(linkMark.range(line.from + f, line.from + t));
      }
    }
  }
  return { decorations: Decoration.set(decos, true), atomic: RangeSet.of(atomic, true) };
}

/** Un enlace con posiciones absolutas: `[` en `a`, texto en [tf, tt), `)` acaba en `b`. */
interface AbsLink {
  a: number;
  tf: number;
  tt: number;
  b: number;
}

/** Enlaces que se solapan (no solo tocan) con [from, to]. */
function linksOverlapping(state: EditorState, from: number, to: number): AbsLink[] {
  const out: AbsLink[] = [];
  const last = state.doc.lineAt(to).number;
  for (let n = state.doc.lineAt(from).number; n <= last; n++) {
    const line = state.doc.line(n);
    for (const l of findLinks(line.text)) {
      const a = line.from + l.from;
      const b = line.from + l.to;
      if (a < to && b > from) out.push({ a, tf: line.from + l.textFrom, tt: line.from + l.textTo, b });
    }
  }
  return out;
}

type Piece = { from: number; to: number };

/** `pieces` sin lo que cae en `cut`. */
function subtract(pieces: Piece[], cut: Piece): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces) {
    if (cut.to <= p.from || cut.from >= p.to) {
      out.push(p);
      continue;
    }
    if (p.from < cut.from) out.push({ from: p.from, to: cut.from });
    if (p.to > cut.to) out.push({ from: cut.to, to: p.to });
  }
  return out;
}

/** Una letra (grafema) antes o después de `pos`, sin salir del documento. */
function clusterNext(state: EditorState, pos: number, forward: boolean): Piece | null {
  const line = state.doc.lineAt(pos);
  if (forward) {
    if (pos >= state.doc.length) return null;
    if (pos === line.to) return { from: pos, to: pos + 1 }; // el salto de línea
    return { from: pos, to: line.from + findClusterBreak(line.text, pos - line.from, true) };
  }
  if (pos <= 0) return null;
  if (pos === line.from) return { from: pos - 1, to: pos };
  return { from: line.from + findClusterBreak(line.text, pos - line.from, false), to: pos };
}

/**
 * Qué se borra de verdad cuando el usuario borra [x, y), para que un enlace nunca quede roto (con
 * la sintaxis a medias, que se vería en crudo):
 *
 * - Si se borra todo el texto del enlace, se borra el enlace entero.
 * - Si se borra solo sintaxis oculta (Retroceso justo detrás del enlace, Suprimir justo delante…),
 *   se borra la letra que el usuario ve a ese lado: la última o la primera del texto del enlace, o
 *   la anterior o la siguiente al enlace.
 * - En cualquier otro caso (selecciones que pisan el enlace a medias, borrar por palabras…), se
 *   borra lo pedido salvo la sintaxis, que se conserva.
 */
function protectRange(state: EditorState, x: number, y: number, dir: 'backward' | 'forward' | null): Piece[] {
  let pieces: Piece[] = [{ from: x, to: y }];
  for (const l of linksOverlapping(state, x, y)) {
    if (pieces.some((p) => p.from <= l.a && p.to >= l.b)) continue; // el enlace entero: bien
    const covers = (p: Piece) => p.from <= l.tf && p.to >= l.tt;
    if (pieces.some(covers)) {
      // Sin texto no hay enlace: se va entero, junto con lo que ya se borraba alrededor.
      const touching = pieces.filter((p) => p.from < l.b && p.to > l.a);
      const merged = {
        from: Math.min(l.a, ...touching.map((p) => p.from)),
        to: Math.max(l.b, ...touching.map((p) => p.to)),
      };
      pieces = [...pieces.filter((p) => !touching.includes(p)), merged].sort((p, q) => p.from - q.from);
      continue;
    }
    const open = { from: l.a, to: l.tf };
    const close = { from: l.tt, to: l.b };
    const only = pieces.length === 1 ? pieces[0]! : null;
    const within = (s: Piece) => !!only && only.from >= s.from && only.to <= s.to;
    if (dir && (within(open) || within(close))) {
      let next: Piece | null;
      if (within(close)) next = dir === 'backward' ? clusterNext(state, l.tt, false) : clusterNext(state, l.b, true);
      else next = dir === 'forward' ? clusterNext(state, l.tf, true) : clusterNext(state, l.a, false);
      // Si era la única letra del texto, se borra el enlace entero.
      if (next && next.from <= l.tf && next.to >= l.tt) next = { from: l.a, to: l.b };
      pieces = next ? [next] : [];
      continue;
    }
    pieces = subtract(subtract(pieces, open), close);
  }
  return pieces;
}

/** Fuera de la sintaxis oculta: si `pos` cae dentro de un `[` o un `](url)`, al borde de fuera. */
function outsideSyntax(state: EditorState, pos: number): number {
  for (const l of linksOverlapping(state, pos, pos + 1)) {
    if (pos > l.a && pos < l.tf) return l.a;
    if (pos >= l.tt && pos < l.b) return l.b;
  }
  return pos;
}

/** Marca la transacción que mete el cursor en el borde del texto de un enlace (ver `wordIntoLink`). */
const intoLink = Annotation.define<boolean>();

/**
 * Dónde puede quedarse el cursor junto a un enlace. Justo antes del `[` y justo después se ven en
 * el mismo sitio (el `[` no se ve), igual que justo antes del `](url)` y justo después del `)`: si
 * el cursor pudiera pararse en los dos, una pulsación de flecha no se movería. Así que a los lados
 * del enlace el cursor queda siempre fuera (antes del `[` o después del `)`), y al moverse con las
 * flechas avanza una letra visible cada vez. Escribir en esos bordes, por tanto, escribe fuera del
 * enlace (como en Google Docs).
 */
export const linkCursor = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.selection || tr.annotation(intoLink)) return tr;
  const sel = tr.newSelection;
  const doc = tr.newDoc;
  const before = tr.startState.selection;
  let changed = false;
  const ranges = sel.ranges.map((r, i) => {
    if (!r.empty) return r;
    const line = doc.lineAt(r.head);
    const rel = r.head - line.from;
    const l = findLinks(line.text).find((l) => rel === l.textFrom || rel === l.textTo);
    if (!l) return r;
    // Con el teclado (flechas, Inicio/Fin, por palabras…) se respeta el sentido del movimiento;
    // con un clic, al cambiar de línea o al editar, se sale al borde de fuera que corresponde.
    const old = before.ranges[i]?.head;
    const byKeyboard = !tr.docChanged && tr.isUserEvent('select') && !tr.isUserEvent('select.pointer') && old != null;
    const sameLine = byKeyboard && old >= line.from && old <= line.to && old !== r.head;
    const right = sameLine && old < r.head;
    const left = sameLine && old > r.head;
    let pos: number;
    if (rel === l.textFrom) {
      const next = findClusterBreak(line.text, l.textFrom, true);
      pos = right ? (next < l.textTo ? next : l.to) : l.from;
    } else {
      const prev = findClusterBreak(line.text, l.textTo, false);
      pos = left ? (prev > l.textFrom ? prev : l.from) : l.to;
    }
    changed = true;
    return EditorSelection.cursor(line.from + pos);
  });
  if (!changed) return tr;
  return [tr, { selection: EditorSelection.create(ranges, sel.mainIndex), sequential: true }];
});

/**
 * Protege la sintaxis oculta de los enlaces frente a las ediciones del usuario (teclado, cortar,
 * escribir sobre una selección, el teclado de Android…), según `protectRange`. Las transacciones
 * que no son del usuario (deshacer, cargar del disco) pasan tal cual.
 */
export const linkIntegrity = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged || !(tr.isUserEvent('input') || tr.isUserEvent('delete'))) return tr;
  const state = tr.startState;
  const dir = tr.isUserEvent('delete.backward') ? 'backward' : tr.isUserEvent('delete.forward') ? 'forward' : null;
  const specs: ChangeSpec[] = [];
  let modified = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const insert = inserted.toString();
    if (toA === fromA) {
      specs.push({ from: fromA, insert });
      return;
    }
    const pieces = protectRange(state, fromA, toA, dir);
    if (pieces.length !== 1 || pieces[0]!.from !== fromA || pieces[0]!.to !== toA) modified = true;
    pieces.forEach((p, i) => specs.push({ ...p, insert: i === pieces.length - 1 ? insert : '' }));
    if (!pieces.length && insert) specs.push({ from: outsideSyntax(state, fromA), insert });
  });
  if (!modified) return tr;
  const changes = ChangeSet.of(specs, state.doc.length);
  const sel = state.selection;
  return {
    changes,
    selection: EditorSelection.create(
      sel.ranges.map((r) => EditorSelection.cursor(changes.mapPos(r.head, 1))),
      sel.mainIndex,
    ),
    effects: tr.effects,
    scrollIntoView: tr.scrollIntoView,
    userEvent: dir ? `delete.${dir}` : tr.isUserEvent('delete') ? 'delete' : 'input',
  };
});

/**
 * Destino del enlace bajo una posición del documento: el de un enlace `[texto](url)` o el de una
 * URL suelta (a las que empiezan por www. se les añade https://).
 */
export function urlAt(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos);
  const rel = pos - line.from;
  const links = findLinks(line.text);
  const md = links.find((l) => rel >= l.from && rel <= l.to);
  if (md) return md.href;
  URL_RE.lastIndex = 0;
  for (const m of line.text.matchAll(URL_RE)) {
    const from = m.index!;
    const to = from + m[0].length;
    if (rel >= from && rel <= to) {
      const raw = m[0];
      return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    }
  }
  return null;
}

/**
 * Transacción para pegar `url` sobre la selección: cada rango seleccionado pasa a ser
 * `[texto](url)` (los espacios de los bordes quedan fuera del enlace) y, si cae dentro del texto de
 * un enlace que ya existe, se le cambia la URL. Devuelve `null` (pegado normal) si algún rango está
 * vacío, ocupa varias líneas, tiene corchetes o pisa a medias un enlace.
 */
export function linkSelection(state: EditorState, url: string): TransactionSpec | null {
  const { ranges } = state.selection;
  type Plan = { from: number; to: number; insert: string; end: number };
  const plans: Plan[] = [];
  for (const r of ranges) {
    if (r.empty) return null;
    const line = state.doc.lineAt(r.from);
    if (r.to > line.to) return null;
    const rel = { from: r.from - line.from, to: r.to - line.from };
    const links = findLinks(line.text);
    const inside = links.find((l) => rel.from >= l.textFrom && rel.to <= l.textTo);
    if (inside) {
      const insert = encodeLinkUrl(url);
      const from = line.from + inside.urlFrom;
      plans.push({ from, to: line.from + inside.urlTo, insert, end: from + insert.length + 1 });
      continue;
    }
    if (links.some((l) => rel.from < l.to && rel.to > l.from)) return null;
    const [, lead, label, trail] = /^(\s*)(.*?)(\s*)$/s.exec(state.sliceDoc(r.from, r.to))!;
    if (!label || /[[\]]/.test(label)) return null;
    const insert = markdownLink(label, url);
    const from = r.from + lead!.length;
    plans.push({ from, to: r.to - trail!.length, insert, end: from + insert.length });
  }
  let i = 0;
  return {
    ...state.changeByRange(() => {
      const p = plans[i++]!;
      return { changes: { from: p.from, to: p.to, insert: p.insert }, range: EditorSelection.cursor(p.end) };
    }),
    userEvent: 'input.paste',
    scrollIntoView: true,
  };
}

/**
 * Borrar por palabras (⌥⌫ / Ctrl+⌫ y sus versiones hacia delante) junto a un enlace: CodeMirror se
 * detendría en la sintaxis oculta, así que antes se mete el cursor en el borde del texto del enlace
 * y luego borra la palabra el comando de siempre (por eso devuelve `false`).
 */
function wordIntoLink(forward: boolean): Command {
  return (view) => {
    const sel = view.state.selection;
    if (sel.ranges.length !== 1 || !sel.main.empty) return false;
    const pos = sel.main.head;
    const line = view.state.doc.lineAt(pos);
    const rel = pos - line.from;
    const l = findLinks(line.text).find((l) => (forward ? l.from === rel : l.to === rel));
    if (l)
      view.dispatch({
        selection: { anchor: line.from + (forward ? l.textFrom : l.textTo) },
        annotations: intoLink.of(true),
      });
    return false;
  };
}

/** Abre la URL en una pestaña nueva. Un <a> sintético funciona también desde `touchend` en Safari iOS. */
function openUrl(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function links() {
  /** Toque en curso: dónde empezó y si el editor ya tenía el foco. */
  let touch: { x: number; y: number; focused: boolean } | null = null;

  const handlers = EditorView.domEventHandlers({
    mousedown(event, view) {
      // Solo ⌘/Ctrl + clic izquierdo sobre un enlace; el resto sigue el comportamiento normal.
      if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) return;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return;
      const url = urlAt(view, pos);
      if (!url) return;
      event.preventDefault();
      openUrl(url);
    },
    touchstart(event, view) {
      const t = event.touches[0];
      touch = event.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, focused: view.hasFocus } : null;
    },
    touchend(event, view) {
      const start = touch;
      touch = null;
      const t = event.changedTouches[0];
      if (!start || start.focused || !t) return;
      // Un desplazamiento es scroll, no un toque.
      if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 8) return;
      const pos = view.posAtCoords({ x: t.clientX, y: t.clientY });
      if (pos === null) return;
      const url = urlAt(view, pos);
      if (!url) return;
      // Cancela el clic emulado: ni se enfoca el editor ni se levanta el teclado.
      event.preventDefault();
      openUrl(url);
    },
    paste(event, view) {
      const url = event.clipboardData?.getData('text/plain').trim();
      if (!url || !isPastableUrl(url)) return false;
      const tr = linkSelection(view.state, url);
      if (!tr) return false;
      event.preventDefault();
      view.dispatch(tr);
      return true;
    },
  });

  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      atomic: RangeSet<Decoration>;
      constructor(view: EditorView) {
        ({ decorations: this.decorations, atomic: this.atomic } = build(view));
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) ({ decorations: this.decorations, atomic: this.atomic } = build(u.view));
      }
    },
    { decorations: (v) => v.decorations },
  );

  // El cursor salta la sintaxis oculta: no puede quedarse dentro de un `[` ni de un `](url)`.
  const atomic = EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? RangeSet.empty);

  const wordKeys = Prec.high(
    keymap.of([
      { key: 'Alt-Backspace', run: wordIntoLink(false) },
      { key: 'Ctrl-Backspace', run: wordIntoLink(false) },
      { key: 'Alt-Delete', run: wordIntoLink(true) },
      { key: 'Ctrl-Delete', run: wordIntoLink(true) },
    ]),
  );

  return [plugin, atomic, handlers, wordKeys, linkIntegrity, linkCursor];
}
