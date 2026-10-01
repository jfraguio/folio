/**
 * Detección del entorno de la UI (no del acceso a archivos).
 */

/**
 * Dispositivo táctil sin puntero fino (móvil o tableta). Se detecta por capacidades, no por
 * user-agent: iPadOS se presenta como macOS y los portátiles táctiles siguen teniendo ratón.
 * En ellos hay que evitar abrir el teclado virtual sin que el usuario lo pida, no mostrar atajos
 * y ofrecer en el menú lo que en escritorio solo se hace con el teclado.
 */
export function isTouch(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/** Marca el documento para que el CSS pueda distinguir el entorno táctil (`html[data-touch]`). */
export function applyTouchFlag(): void {
  if (isTouch()) document.documentElement.dataset.touch = '';
}
