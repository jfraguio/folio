/**
 * Identificadores **persistidos** que conservan el nombre antiguo de la app (`to-do` / `todo`) para
 * no romper la compatibilidad con archivos y datos ya guardados (los `.txt` llevan los marcadores;
 * IndexedDB, localStorage y los canales guardan las otras claves).
 *
 * ⚠️ NO cambiar estos valores sin una migración. Todo lo demás (`FolioFile`, `todoId` de variable,
 * nombres de módulos…) es interno y puede renombrarse sin tocar datos.
 */
export const LEGACY = {
  /** Marcador de tab/subtab dentro del `.txt`: `[todo:tab N]` / `[todo:tab N.M]`. */
  tabMarker: 'todo:tab',
  /** Bloque del diccionario al final del `.txt`: `<!-- todo:diccionario … -->`. */
  dictTag: 'todo:diccionario',
  /** Nombre de la base de datos de IndexedDB. */
  dbName: 'to-do',
  /** Claves de `localStorage` de las preferencias (el script inline de index.html las repite). */
  prefKeys: {
    theme: 'todo.theme',
    spellEnabled: 'todo.spell.enabled',
    zen: 'todo.zen',
  },
  /** Canal y prefijo de `navigator.locks` para coordinarse entre pestañas. */
  channel: 'to-do',
  lockPrefix: 'to-do:',
} as const;
