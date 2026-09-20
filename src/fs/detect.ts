import type { FileAdapter } from './FileAdapter';
import { FsAccessAdapter } from './FsAccessAdapter';
import { FallbackAdapter } from './FallbackAdapter';

export function hasFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * Dispositivo táctil sin puntero fino (móvil o tableta). Se detecta por capacidades, no por
 * user-agent: iPadOS se presenta como macOS y los portátiles táctiles siguen teniendo ratón.
 * En ellos hay que evitar abrir el teclado virtual sin que el usuario lo pida, no mostrar atajos
 * y ofrecer en el menú lo que en escritorio solo se hace con el teclado.
 */
export function isTouch(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/** Marca el documento para que el CSS pueda distinguir el entorno táctil (`html[data-touch]`). */
export function applyTouchFlag(): void {
  if (isTouch()) document.documentElement.dataset.touch = '';
}

export function createAdapter(): FileAdapter {
  return hasFsAccess() ? new FsAccessAdapter() : new FallbackAdapter();
}
