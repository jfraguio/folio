import { Compartment, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SpellService } from '../spell/SpellService';
import type { PersonalDictionary } from '../persistence/dictionary';

const misspelled = Decoration.mark({ class: 'cm-misspelled' });
const setMarks = StateEffect.define<DecorationSet>();

const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    let m = marks.map(tr.changes);
    for (const e of tr.effects) if (e.is(setMarks)) m = e.value;
    return m;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Palabras candidatas al corrector: letras, apóstrofos y guiones internos. */
export const SPELL_WORD_RE = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;

export interface SpellDeps {
  service: SpellService;
  dictionary: PersonalDictionary;
  debounceMs?: number;
}

/** Palabra bajo el cursor (o null). */
export function wordAt(view: EditorView, pos: number): { from: number; to: number; word: string } | null {
  const line = view.state.doc.lineAt(pos);
  SPELL_WORD_RE.lastIndex = 0;
  for (const m of line.text.matchAll(SPELL_WORD_RE)) {
    const from = line.from + m.index!;
    const to = from + m[0].length;
    if (pos >= from && pos <= to) return { from, to, word: m[0] };
  }
  return null;
}

function shouldSkip(word: string, dict: PersonalDictionary): boolean {
  if (word.length < 2) return true;
  if (/\p{N}/u.test(word)) return true;
  if (dict.has(word)) return true;
  return false;
}

export function spellcheck(deps: SpellDeps) {
  const debounceMs = deps.debounceMs ?? 400;

  const plugin = ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null;
      private cancelled = false;
      private unsubscribe: () => void;

      constructor(private view: EditorView) {
        this.schedule(0);
        this.unsubscribe = deps.service.onReady(() => this.schedule(0));
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) this.schedule(debounceMs);
      }

      destroy() {
        this.cancelled = true;
        if (this.timer) clearTimeout(this.timer);
        this.unsubscribe();
      }

      /** Fuerza un re-escaneo (p. ej. tras añadir una palabra al diccionario). */
      rescan() {
        this.schedule(0);
      }

      private schedule(ms: number) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.run(), ms);
      }

      private async run() {
        if (this.cancelled || !deps.service.ready) return;
        const view = this.view;
        const state = view.state;
        const cursor = state.selection.main.head;
        const cursorWord = state.selection.main.empty ? wordAt(view, cursor) : null;

        // Rangos visibles + margen, evitando bloques de código.
        const tree = syntaxTree(state);
        const tokens: { from: number; to: number; word: string }[] = [];
        const margin = 2000;
        for (const r of view.visibleRanges) {
          const from = Math.max(0, r.from - margin);
          const to = Math.min(state.doc.length, r.to + margin);
          const text = state.doc.sliceString(from, to);
          SPELL_WORD_RE.lastIndex = 0;
          for (const m of text.matchAll(SPELL_WORD_RE)) {
            const wf = from + m.index!;
            const wt = wf + m[0].length;
            if (cursorWord && wf === cursorWord.from) continue;
            if (shouldSkip(m[0], deps.dictionary)) continue;
            const node = tree.resolveInner(wf, 1);
            if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'InlineCode') continue;
            tokens.push({ from: wf, to: wt, word: m[0] });
          }
        }

        const unique = [...new Set(tokens.map((t) => t.word))];
        const results = await deps.service.check(unique);
        if (this.cancelled || view.state.doc !== state.doc) {
          // El documento cambió mientras consultábamos: se reprogramará por update().
          if (!this.cancelled) this.schedule(debounceMs);
          return;
        }

        const b = new RangeSetBuilder<Decoration>();
        for (const t of tokens) {
          if (results.get(t.word) === false) b.add(t.from, t.to, misspelled);
        }
        view.dispatch({ effects: setMarks.of(b.finish()) });
      }
    },
  );

  return { extension: [marksField, plugin], plugin };
}

export const spellCompartment = new Compartment();
