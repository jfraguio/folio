import { Compartment } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

/**
 * Typewriter scrolling: mantiene la línea del cursor a una altura fija (~45 % de la ventana)
 * cuando el cambio de selección proviene de escritura o navegación con teclado.
 */
const plugin = ViewPlugin.fromClass(
  class {
    constructor(private view: EditorView) {}
    update(u: ViewUpdate) {
      if (!u.selectionSet && !u.docChanged) return;
      const fromInput = u.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete') || tr.isUserEvent('select'));
      if (!fromInput) return;
      const head = u.state.selection.main.head;
      requestAnimationFrame(() => {
        const coords = this.view.coordsAtPos(head);
        if (!coords) return;
        const rect = this.view.scrollDOM.getBoundingClientRect();
        const target = rect.top + rect.height * 0.45;
        const delta = coords.top - target;
        if (Math.abs(delta) > 2) this.view.scrollDOM.scrollBy({ top: delta, behavior: 'auto' });
      });
    }
  },
);

export const typewriterCompartment = new Compartment();

export function typewriter(enabled: boolean) {
  return enabled ? [plugin] : [];
}
