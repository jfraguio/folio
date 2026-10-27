import { el } from './el';
import { openOverlay } from './Menu';
import { shortcutFor } from '../app/shortcuts';

export interface HelpOptions {
  /** Táctil: sin teclado físico, la sección de atajos sobra. */
  touch: boolean;
  /** Modo degradado: no se escribe en el archivo, sino en un borrador del navegador. */
  degraded: boolean;
  restoreFocus?: () => void;
}

/** Atajo de un comando, o «?» si dejara de tener uno (mejor un hueco visible que una fila falsa). */
const key = (id: string) => shortcutFor(id) ?? '?';

const section = (title: string, ...rows: (HTMLElement | null)[]) =>
  el('section', { class: 'help__section' }, el('h2', { class: 'help__title' }, title), ...rows);

/** Una fila «muestra · explicación». La muestra se pinta con la misma decoración que en el editor. */
const row = (sample: Node | string, text: string) =>
  el('div', { class: 'help__row' }, el('span', { class: 'help__key' }, sample), el('span', {}, text));

const sample = (cls: string, text: string) => el('span', { class: `help__sample help__sample--${cls}` }, text);

/**
 * Instrucciones: un resumen breve de cómo funciona folio (convenciones del texto, pestañas y
 * atajos). Solo lectura; se cierra con [Cerrar], Esc o un clic fuera.
 */
export function openHelp(o: HelpOptions): void {
  const body = el(
    'div',
    // Enfocable para que las flechas y Av Pág desplacen el texto sin ratón.
    { class: 'help', tabIndex: -1 },
    section(
      'Escribir',
      el('p', { class: 'help__text' }, 'Un único archivo .txt'),
      row(sample('heading', '# Semana'), '# marca un título'),
      row(sample('done', '-- Llamar al banco'), '-- tacha tarea'),
      row(sample('link', 'Ejemplo'), '[Ejemplo](https://) crea un enlace'),
    ),
    section(
      'Pestañas',
      el('p', { class: 'help__text' }, 'Hasta 10 pestañas, con 10 subpestañas cada una'),
      el('p', { class: 'help__text' }, 'Sólo se pueden eliminar pestañas vacías'),
    ),
    section(
      'Bloques cifrados',
      el(
        'p',
        { class: 'help__text' },
        'Escribe el texto que quieras proteger entre <secret:contraseña> y </secret:contraseña>.',
      ),
      el(
        'pre',
        { class: 'help__code' },
        [
          'Pista visible.',
          '',
          '<secret:contraseña>',
          'Este contenido se cifrará.',
          'Puede ocupar varias líneas.',
          '</secret:contraseña>',
          '',
          'Este texto seguirá visible.',
        ].join('\n'),
      ),
    ),
    o.touch
      ? null
      : section(
          'Atajos',
          row(key('menu'), 'Abrir o cerrar el menú'),
          row(`${key('tab.0')} … ${key('tab.9')}`, 'Ir a la pestaña 1 … 10'),
          row(`${key('subtab.0')} … ${key('subtab.9')}`, 'Ir a la subpestaña 1 … 10'),
          row('1 … 0', 'Con el menú abierto, ir a esa pestaña'),
          row(key('save'), o.degraded ? 'Descargar el .txt' : 'Guardar ahora'),
          row('Esc', 'Cerrar el menú o el panel'),
        ),
    section(
      'Zen',
      el(
        'p',
        { class: 'help__text' },
        'Modo literario: una columna centrada en la que solo se ilumina la línea que escribes; ' +
          'dos guiones se convierten en raya (—) y las comillas, en « ».',
      ),
    ),
    // En modo degradado no hay historial.
    o.degraded
      ? null
      : section(
          'Historial',
          el(
            'p',
            { class: 'help__text' },
            'folio guarda una copia del archivo cada hora. Puedes descargar cualquiera desde Más… › Historial.',
          ),
        ),
  );
  const panel = el(
    'div',
    { class: 'panel panel--tall' },
    el('div', { class: 'panel__header' }, 'Instrucciones'),
    body,
    el(
      'div',
      { class: 'panel__actions' },
      el('button', { class: 'btn btn--quiet', on: { click: () => handle.close() } }, 'Cerrar'),
    ),
  );
  const handle = openOverlay(panel, { restoreFocus: o.restoreFocus, tall: true });
  if (!o.touch) body.focus();
}
