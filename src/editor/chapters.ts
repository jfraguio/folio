import type { EditorState, Text } from '@codemirror/state';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { countWords } from '../text/words';

export interface Chapter {
  level: 1 | 2;
  title: string;
  /** Posición del inicio del encabezado (o 0 para el capítulo implícito). */
  from: number;
  /** Fin del contenido del capítulo/escena. */
  to: number;
  /** Posición donde colocar el cursor al navegar. */
  target: number;
  words: number;
  implicit?: boolean;
}

export interface ChapterIndex {
  chapters: Chapter[];
  totalWords: number;
}

interface Heading {
  level: 1 | 2;
  from: number;
  to: number;
  title: string;
}

function collectHeadings(state: EditorState): Heading[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state);
  const out: Heading[] = [];
  tree.iterate({
    enter: (n) => {
      if (n.name === 'ATXHeading1' || n.name === 'ATXHeading2') {
        const raw = state.doc.sliceString(n.from, n.to);
        const title = raw.replace(/^#{1,2}\s*/, '').replace(/\s+#+\s*$/, '').trim();
        out.push({ level: n.name === 'ATXHeading1' ? 1 : 2, from: n.from, to: n.to, title });
        return false;
      }
      if (n.name === 'FencedCode' || n.name === 'CodeBlock') return false;
      return undefined;
    },
  });
  return out;
}

/** Posición del primer carácter no vacío tras el encabezado; si no hay texto, el final del documento. */
function targetAfter(doc: Text, headingTo: number): number {
  let line = doc.lineAt(headingTo);
  while (line.number < doc.lines) {
    line = doc.line(line.number + 1);
    if (line.text.trim() !== '') return line.from;
  }
  return doc.length;
}

export function buildIndex(state: EditorState): ChapterIndex {
  const doc = state.doc;
  const headings = collectHeadings(state);
  const chapters: Chapter[] = [];

  const firstH1 = headings.find((h) => h.level === 1);
  const preambleEnd = firstH1 ? firstH1.from : doc.length;
  const preamble = doc.sliceString(0, preambleEnd);
  if (preamble.trim() !== '' || headings.length === 0) {
    chapters.push({
      level: 1,
      title: 'Inicio',
      from: 0,
      to: preambleEnd,
      target: 0,
      words: countWords(preamble),
      implicit: true,
    });
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    if (h.level === 2 && !firstH1) continue; // escenas sin capítulo: se ignoran en el índice
    let end = doc.length;
    for (let j = i + 1; j < headings.length; j++) {
      const next = headings[j]!;
      if (next.level <= h.level) {
        end = next.from;
        break;
      }
    }
    if (h.level === 2) {
      // Una escena termina también donde empieza el siguiente H1.
      for (let j = i + 1; j < headings.length; j++) {
        const next = headings[j]!;
        if (next.level === 1 && next.from < end) end = next.from;
      }
    }
    chapters.push({
      level: h.level,
      title: h.title || (h.level === 1 ? 'Capítulo sin título' : 'Escena sin título'),
      from: h.from,
      to: end,
      target: targetAfter(doc, h.to),
      words: countWords(doc.sliceString(h.to, end)),
    });
  }

  return { chapters, totalWords: countWords(doc.toString()) };
}

const cache = new WeakMap<Text, ChapterIndex>();

/**
 * Índice de capítulos calculado bajo demanda y cacheado por documento.
 * Evita recorrer la novela en cada pulsación: solo se calcula cuando alguien lo pide
 * (paleta, indicador de estado) y el documento ha cambiado.
 */
export function getChapterIndex(state: EditorState): ChapterIndex {
  let idx = cache.get(state.doc);
  if (!idx) {
    idx = buildIndex(state);
    cache.set(state.doc, idx);
  }
  return idx;
}

/** Capítulo (nivel 1) que contiene la posición dada. */
export function chapterAt(index: ChapterIndex, pos: number): Chapter | null {
  let found: Chapter | null = null;
  for (const c of index.chapters) {
    if (c.level === 1 && pos >= c.from) found = c;
  }
  return found;
}
