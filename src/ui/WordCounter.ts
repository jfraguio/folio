import { el } from './el';

/** Contador sutil abajo a la derecha: "palabras del capítulo/palabras de la novela". */
export class WordCounter {
  readonly root: HTMLElement;

  constructor() {
    this.root = el('div', {
      class: 'word-count',
      title: 'Palabras: capítulo / novela',
      attrs: { 'aria-live': 'off' },
    });
  }

  set(chapter: number | null, total: number): void {
    this.root.textContent = chapter === null ? String(total) : `${chapter}/${total}`;
  }
}
