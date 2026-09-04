import { el } from './el';

let node: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Mensaje de una línea, autodescartable. Nunca bloquea. */
export function notice(text: string, ms = 3500): void {
  if (!node) {
    node = el('div', { class: 'notice', attrs: { role: 'status', 'aria-live': 'polite' } });
    document.body.appendChild(node);
  }
  node.textContent = text;
  node.classList.add('notice--visible');
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => node?.classList.remove('notice--visible'), ms);
}
