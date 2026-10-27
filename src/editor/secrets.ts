import { Annotation, EditorState, RangeSet, type Extension, type Range, type Transaction } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { findEncryptedSecrets } from '../secrets/format';
import { notice } from '../ui/Notice';

/**
 * Protección de los bloques ya cifrados.
 *
 * La autenticación de AES-GCM impide que un bloque manipulado devuelva texto parcial, pero una
 * edición accidental seguiría estropeando la representación (y, con ella, la posibilidad de
 * descifrarla). Aquí los bloques se marcan como una unidad: el cursor los salta y una edición que
 * los pise a medias se rechaza antes de llegar al documento. Se pueden seleccionar y borrar
 * enteros, que es una acción deliberada.
 *
 * Las transacciones internas de cifrar/descifrar (que sustituyen el documento completo) se marcan
 * con `secretRewrite` y no pasan por este filtro.
 */
export const secretRewrite = Annotation.define<boolean>();

const validMark = Decoration.mark({
  class: 'cm-secret',
  attributes: { title: 'Bloque cifrado: no se puede editar parcialmente' },
});
const brokenMark = Decoration.mark({
  class: 'cm-secret cm-secret--broken',
  attributes: { title: 'Bloque cifrado dañado: se conserva intacto' },
});

interface Built {
  decorations: DecorationSet;
  atomic: RangeSet<Decoration>;
}

function build(state: EditorState): Built {
  const decos: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  for (const block of findEncryptedSecrets(state.doc.toString()).blocks) {
    const mark = block.payload ? validMark : brokenMark;
    const range = mark.range(block.from, block.to);
    decos.push(range);
    atomic.push(range);
  }
  return { decorations: Decoration.set(decos, true), atomic: RangeSet.of(atomic, true) };
}

let lastWarning = 0;
function warnProtected(): void {
  const now = Date.now();
  if (now - lastWarning < 1500) return;
  lastWarning = now;
  notice('Los bloques cifrados no se pueden editar parcialmente. Selecciona el bloque entero para borrarlo.', 5000);
}

export function secretBlocks(): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      atomic: RangeSet<Decoration>;
      constructor(view: EditorView) {
        ({ decorations: this.decorations, atomic: this.atomic } = build(view.state));
      }
      update(u: ViewUpdate) {
        if (u.docChanged) ({ decorations: this.decorations, atomic: this.atomic } = build(u.state));
      }
    },
    { decorations: (v) => v.decorations },
  );

  const filter = EditorState.transactionFilter.of((tr: Transaction) => {
    if (!tr.docChanged || tr.annotation(secretRewrite)) return tr;
    if (!tr.isUserEvent('input') && !tr.isUserEvent('delete') && !tr.isUserEvent('move')) return tr;
    const ranges = findEncryptedSecrets(tr.startState.doc.toString()).blocks;
    if (!ranges.length) return tr;

    let partial = false;
    tr.changes.iterChangedRanges((fromA, toA) => {
      if (partial) return;
      for (const block of ranges) {
        if (fromA < block.to && toA > block.from) {
          // Tocar el bloque entero (o más allá) es una acción deliberada; pisarlo a medias, no.
          if (!(fromA <= block.from && toA >= block.to)) {
            partial = true;
            return;
          }
        }
      }
    });
    if (!partial) return tr;
    warnProtected();
    return [];
  });

  const atomic = EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? RangeSet.empty);
  return [plugin, atomic, filter];
}
