import { el } from './el';
import { prettyShortcut } from '../app/shortcuts';

/** Botón sutil, abajo a la izquierda, que abre la paleta de comandos. */
export function createMenuButton(onClick: () => void): HTMLButtonElement {
  const shortcut = prettyShortcut('Mod-k');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 14 10');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '10');
  svg.setAttribute('aria-hidden', 'true');
  for (const y of [1, 5, 9]) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('x2', '14');
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    svg.appendChild(line);
  }
  return el(
    'button',
    {
      class: 'menu-button',
      title: `Menú (${shortcut})`,
      attrs: { 'aria-label': `Menú (${shortcut})` },
      on: { click: onClick },
    },
    svg,
  );
}
