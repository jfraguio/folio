# Folio — Especificación funcional y técnica

## 1. Visión del producto

**Folio** es una aplicación web para escribir novelas cuyo objetivo principal es facilitar un estado de **concentración y flow**, eliminando al máximo cualquier distracción visual.

La experiencia debe sentirse más cercana a sentarse delante de una hoja de papel o una máquina de escribir que a utilizar un procesador de textos tradicional.

Principios fundamentales:

- Cero distracciones.
- Interfaz extremadamente minimalista.
- El texto es siempre el protagonista.
- Escritura sobre archivos locales reales.
- Guardado automático y transparente.
- Organización sencilla por capítulos.
- Markdown/texto plano como formato de trabajo.
- Sin control de versiones: el archivo en el equipo es la única fuente de verdad.
- Corrección ortográfica discreta, activada por defecto.
- Contrastes suaves y gran comodidad visual.
- Nada debe interrumpir al usuario mientras está escribiendo.

> **Folio no pretende ser un procesador de textos. Es un lugar para escribir.**

## 2. Plataforma y soporte

Folio es una **aplicación web estática ejecutada íntegramente en el navegador**. No tiene backend. Se publica en GitHub Pages y trabaja con archivos almacenados físicamente en el ordenador del usuario. El archivo local es la **fuente de verdad**.

### 2.1. Navegadores

| Nivel | Navegadores | Capacidades |
|---|---|---|
| **Completo** | Chrome, Edge, Brave, Arc (Chromium ≥ 108, escritorio) | File System Access API, autosave sobre el archivo real, PWA con `file_handlers` |
| **Degradado** | Firefox, Safari (escritorio) | Abrir con `<input type="file">`, guardar por descarga, autosave solo en borrador local (IndexedDB) |
| **No soportado** | Móviles y tablets | Se muestra un aviso; no se bloquea, pero no se optimiza |

El nivel se detecta con `'showOpenFilePicker' in window`. En modo degradado la pantalla inicial muestra una nota discreta de una línea explicando la limitación.

### 2.2. PWA

La aplicación es instalable (`display: standalone`). El manifest declara `file_handlers` para `.md` y `.markdown`, de modo que, una vez instalada, abrir un `.md` desde el sistema operativo lanza Folio directamente en el editor (`launchQueue` API). El Service Worker cachea la aplicación y los diccionarios ortográficos para funcionar offline.

## 3. Flujo de entrada

Pantalla inicial con tres acciones como máximo y sin ningún otro elemento:

### Abrir novela

Selecciona un `.md` existente mediante `showOpenFilePicker()` (o `<input type="file">` en modo degradado).

### Nueva novela

Crea un nuevo `.md` mediante `showSaveFilePicker()` con nombre sugerido `novela.md`. El archivo se inicializa con un **primer capítulo por defecto**:

```markdown
# Capítulo 1

```

El cursor se coloca en la línea vacía bajo el encabezado, listo para escribir.

### Continuar «Título de la última novela»

Solo aparece si existe un handle persistido en IndexedDB. Al pulsar, se llama a `handle.requestPermission({ mode: 'readwrite' })` (requiere gesto de usuario) y se entra en el editor. Si el archivo ya no existe o el permiso se deniega, la opción desaparece con una nota breve.

Tras cualquiera de las tres acciones se entra **directamente en el editor**. No existe dashboard ni pantalla intermedia.

## 4. Archivo de la novela

### 4.1. Formato

Markdown estándar, legible como texto plano, codificación UTF-8, saltos de línea `\n`. Folio no introduce metadatos, front matter, JSON incrustado ni estructuras propietarias, con una única excepción: las notas y el diccionario personal de la novela, que viajan al final del archivo como comentarios HTML (§14). Al ser comentarios, cualquier visor Markdown los ignora y el texto sigue siendo legible tal cual.

```markdown
# Capítulo 1

El hombre llegó a la estación poco después de las doce.

No había nadie esperándolo.

# Capítulo 2

La lluvia había comenzado durante la madrugada.
```

El documento debe seguir siendo perfectamente útil aunque Folio dejase de existir.

### 4.2. Normalización al abrir

- `\r\n` → `\n`.
- Se elimina BOM si existe.
- No se modifica nada más. Si la normalización cambió el contenido, el archivo no se reescribe hasta que el usuario edite.

## 5. Estructura: capítulos y escenas

| Sintaxis | Significado | Uso en Folio |
|---|---|---|
| `# Título` | Capítulo | Entrada principal del índice |
| `## Título` | Escena con título | Entrada anidada bajo su capítulo |
| `***` o `---` en línea propia | Separador de escena | Se renderiza como ornamento tenue (`* * *` centrado y atenuado); no aparece en el índice |

El texto anterior al primer `#` se considera un capítulo implícito sin título («Inicio») únicamente a efectos de índice.

### 5.1. Índice de capítulos

Se abre bajo demanda (atajo o paleta de comandos) como overlay centrado y se cierra con `Esc`, al pulsar fuera o al seleccionar un capítulo. **Nunca ocupa espacio permanente.**

Cada entrada muestra:

- Título del capítulo (o escena, indentada).
- A la derecha, en tipografía más pequeña y con el color atenuado del tema, el **número de palabras** del capítulo (`12 340`). Es un dato secundario: no debe destacar más que el título.
- El capítulo activo (donde está el cursor) queda marcado con contraste principal.
- Al pie, el total de palabras de la novela, con el mismo tratamiento discreto.

Permite filtrado por texto al empezar a escribir y navegación con flechas + `Enter`.

Al seleccionar, el cursor se sitúa al inicio del párrafo tras el encabezado y la vista se desplaza para dejarlo cerca del tercio superior.

### 5.2. Implementación

El índice se construye recorriendo el árbol sintáctico de Lezer (`@codemirror/lang-markdown`) y recogiendo nodos `ATXHeading1` y `ATXHeading2`. Esto descarta automáticamente `#` dentro de bloques de código. Se calcula **bajo demanda** (al abrir el índice, al consultar el contador) y se cachea por instancia de documento (`WeakMap<Text, ChapterIndex>`), de modo que escribir no tiene ningún coste asociado y el índice siempre está al día cuando se pide.

## 6. Editor

El editor es prácticamente toda la aplicación. No debe haber permanentemente barra de herramientas, botones, menús, números de línea, paneles, controles flotantes ni información innecesaria. Sensación inicial: **pantalla + novela + cursor**.

### 6.1. Renderizado del Markdown

Enfoque iA Writer: la sintaxis es **visible pero estilizada**. No hay WYSIWYG.

- Encabezados: el marcador `#` en color atenuado; el título en el mismo cuerpo de texto con peso medio y un margen superior mayor.
- Énfasis (`*cursiva*`, `**negrita**`): marcadores atenuados, texto en cursiva/negrita.
- Separadores `***`/`---`: ornamento centrado y atenuado.
- Nada más. Enlaces, listas, tablas o código se muestran como texto plano sin tratamiento especial.

### 6.2. Motor

**CodeMirror 6.** Justificación: decoraciones por rango (focus mode, ortografía), viewport virtualizado para documentos largos, historial de deshacer, árbol sintáctico Markdown, control total del DOM y ninguna UI impuesta. Se descartan `<textarea>` (no permite estilizar fragmentos) y ProseMirror/Tiptap (orientados a WYSIWYG).

Extensiones activas: `history`, `drawSelection`, `EditorView.lineWrapping`, `markdown()`, `closeBrackets` desactivado, `defaultKeymap` + `historyKeymap`, y las extensiones propias descritas en §24.

## 7. Área de escritura y tipografía

- Columna centrada de **~65 caracteres** (`max-width: 38rem`), con margen superior amplio y espacio inferior suficiente para que la última línea pueda situarse en el centro de la pantalla.
- **Tipografía: iA Writer Quattro** (licencia SIL OFL), auto-hospedada en WOFF2 (Regular, Italic, Bold), `font-display: swap`. Fallback: `'iA Writer Quattro', 'IBM Plex Sans', system-ui, sans-serif`.
- Cuerpo: 21 px por defecto, ajustable entre 16 y 28 px con `Cmd/Ctrl +` / `Cmd/Ctrl -`. Interlineado 1.65. Espaciado entre párrafos: una línea vacía en el documento, sin margen adicional.
- Cursor: barra fina de 2 px con el color de texto principal, parpadeo nativo.
- Selección: fondo semitransparente del color atenuado.

## 8. Focus Mode por párrafo

El párrafo en el que se encuentra el cursor se muestra con el contraste principal; el resto, ligeramente atenuado. La diferencia es **sutil**: no se pretende esconder el documento, solo dirigir la atención.

Un párrafo es el bloque de líneas no vacías contiguas que contiene el cursor (o, si el cursor está en una línea vacía, esa línea).

### 8.1. Implementación

`ViewPlugin` que escucha `update.selectionSet` y `update.docChanged`. Calcula el rango del párrafo activo y emite `Decoration.line({ class: 'cm-active-para' })` para cada línea del mismo. El atenuado es el estado por defecto vía CSS:

```css
.cm-content { color: var(--fg-dim); transition: color 120ms ease; }
.cm-active-para { color: var(--fg); }
@media (prefers-reduced-motion: reduce) { .cm-content { transition: none; } }
```

Solo se recalcula cuando cambia la selección o el documento; escribir dentro del mismo párrafo no genera trabajo adicional relevante.

No puede desactivarse: es parte de la identidad del editor.

### 8.2. Texto centrado (typewriter scrolling, desactivado por defecto)

Mantiene la línea del cursor a una altura fija (~45 % de la ventana) mediante `EditorView.scrollIntoView` con `y: 'center'` tras cada cambio de selección producido por escritura. Se activa desde la paleta.

## 9. Guardado automático

El usuario **no debe pensar nunca en guardar**. El guardado es silencioso: sin diálogos ni notificaciones.

### 9.1. Indicador de estado

Un punto de 6 px en la esquina inferior derecha con el color atenuado del tema:

| Estado | Visual |
|---|---|
| `saved` | Punto invisible (opacidad 0) |
| `dirty` / `saving` | Punto visible, opacidad 0.4 |
| `error` | Punto en color de error, opacidad 0.8, con `title` explicativo; al pulsarlo abre la paleta en la acción «Guardar como…» |
| `conflict` | Igual que `error`, abre el diálogo de conflicto (§9.4) |

Al pasar el ratón por encima muestra el texto «Guardado hace 2 min» en tipografía pequeña. Nada más.

### 9.2. Máquina de estados

```
idle ──edición──▶ dirty ──debounce 1,5 s──▶ saving ──ok──▶ saved
                    ▲                          │
                    │                          ├──error──▶ error ──reintento/gesto──▶ saving
                    └──edición durante saving──┘ (se encadena una nueva escritura al terminar)
```

Disparadores adicionales de `flush()`:

- Cada 30 s si sigue `dirty` (guardado periódico de seguridad).
- `visibilitychange` → `hidden`.
- `pagehide` / `beforeunload` (best-effort; ver §9.5).
- Antes de exportar.

Solo puede haber **una escritura en vuelo**. Si llegan cambios mientras se escribe, se marca `pendingAgain` y se vuelve a escribir al terminar.

### 9.3. Escritura

```ts
const file = await handle.getFile();
if (file.lastModified !== lastKnownMtime) return enterConflict(file);
const w = await handle.createWritable();      // escribe en temporal, swap atómico en close()
await w.write(text);
await w.close();
lastKnownMtime = (await handle.getFile()).lastModified;
```

### 9.4. Conflicto con modificaciones externas

Si la carpeta está sincronizada (Drive, Dropbox, iCloud) el archivo puede cambiar por debajo. Antes de cada escritura se compara `lastModified`. Si difiere:

1. Se detiene el autosave.
2. El indicador pasa a `conflict`. Al pulsarlo, un diálogo mínimo ofrece: **Conservar mi versión** (sobrescribe y actualiza `lastKnownMtime`) o **Cargar la del disco** (reemplaza el editor; los cambios locales se pierden, y el diálogo lo advierte).

Mientras el conflicto no se resuelve, el usuario puede seguir escribiendo; nada se pierde porque el borrador vivo (§9.5) sigue funcionando.

### 9.5. Borrador vivo (live draft)

Independientemente del autosave sobre el archivo, el contenido completo se guarda en IndexedDB (store `drafts`, clave `novelId`) con debounce de 300 ms. Motivos:

- `beforeunload` no garantiza que un `createWritable()` termine.
- En modo degradado es el único autosave real.
- Cubre cierres del navegador, cuelgues y pérdida de permiso.

Al abrir una novela, si existe un borrador cuyo `ts` es posterior al `lastModified` del archivo y cuyo contenido difiere, se ofrece **una vez**: «Hay cambios sin guardar del `<fecha>`. ¿Recuperarlos?». Si el usuario acepta, el borrador pasa al editor y se dispara un guardado; si no, se descarta.

### 9.6. Fallos de guardado

| Causa | Detección | Respuesta |
|---|---|---|
| Permiso revocado | `NotAllowedError` | Estado `error`; al pulsar el indicador se llama a `requestPermission()` (gesto de usuario) y se reintenta |
| Archivo borrado o movido | `NotFoundError` | Estado `error`; la acción ofrece «Guardar como…» con `showSaveFilePicker` |
| Disco lleno / otro | Cualquier otra excepción | Estado `error`; reintento exponencial (2 s, 4 s, 8 s… máx. 60 s) |

Regla absoluta: **el texto nunca se pierde mientras la pestaña esté abierta**. Ante cualquier error se garantiza que el contenido sigue en el editor y en el borrador vivo hasta que la escritura se recupere o el usuario elija «Guardar como…».

### 9.7. Varias pestañas

Al abrir una novela se adquiere `navigator.locks.request(novelId, { ifAvailable: true })`. Si el lock no está disponible, la segunda pestaña muestra «Esta novela ya está abierta en otra pestaña» y ofrece solo lectura o cerrar. Se usa `BroadcastChannel('folio')` para que la primera pestaña pueda ceder el control si el usuario lo pide.

## 10. Acceso al archivo local

Interfaz única que abstrae el mecanismo:

```ts
interface FileAdapter {
  readonly capabilities: { directWrite: boolean; persistentHandle: boolean };
  open(): Promise<NovelFile | null>;
  create(defaultContent: string): Promise<NovelFile | null>;
  reopenLast(): Promise<NovelFile | null>;
  read(f: NovelFile): Promise<{ text: string; mtime: number }>;
  write(f: NovelFile, text: string): Promise<{ mtime: number }>;
  saveAs(text: string, suggestedName: string): Promise<NovelFile | null>;
}
```

- **`FsAccessAdapter`**: File System Access API. Persiste el `FileSystemFileHandle` en IndexedDB (es structured-cloneable).
- **`FallbackAdapter`**: `<input type="file">` para abrir; `write()` no está disponible (`directWrite: false`), `saveAs()` descarga mediante `<a download>`. El borrador vivo hace de autosave. La pantalla inicial indica: «Tu navegador no permite guardar directamente en el archivo. Folio guardará un borrador local y podrás descargar el `.md` cuando quieras».

La compatibilidad prioritaria es Chromium de escritorio. No se hace ningún esfuerzo por emular escritura directa donde el navegador no la ofrece.

## 11. Google Drive

Folio **no integra Google Drive**. El usuario guarda el `.md` en una carpeta sincronizada externamente:

```text
Folio → archivo local .md → carpeta sincronizada → Google Drive
```

La única concesión a este escenario es la detección de conflictos de §9.4.

## 12. Sin control de versiones

Folio **no mantiene versiones, snapshots ni historial** del documento. El `.md` del equipo es la única fuente de verdad; si el usuario quiere historial, lo obtiene de su sistema de sincronización (Drive, Dropbox, iCloud, Time Machine, git…).

La única copia auxiliar es el **borrador vivo** (§9.5), que no es un historial: contiene exclusivamente el último estado del editor y solo sirve para no perder lo escrito si el navegador se cierra antes de que el autosave termine. Se descarta en cuanto el archivo está guardado.

## 13. Corrector ortográfico

Activado por defecto. **Solo señal visual, nunca sugerencias**: sin pop-ups, listas, ventanas ni mensajes.

### 13.1. Marca visual

La palabra se tiñe de un rojo apagado, sin subrayado:

```css
.cm-misspelled {
  color: var(--misspell); /* #a8534e claro · #c4837c oscuro */
}
```

### 13.2. Motor

Hunspell en un **Web Worker**, usando `nspell` (o `hunspell-asm` si la memoria de `nspell` resulta excesiva; se decide midiendo). **Solo español**: diccionario del paquete `dictionary-es`, copiado en build a `public/dict/es.{aff,dic}` (`scripts/copy-dictionaries.mjs`, porque el campo `exports` del paquete impide importarlo directamente), cargado bajo demanda con `fetch` y cacheado por el Service Worker. No hay selector de idioma.

Cuando el corrector propio está activo, el `contenteditable` lleva `spellcheck="false"` para evitar la doble marca del navegador. Si el corrector se desactiva, no se activa el nativo (el nativo muestra sugerencias en menú contextual y no respeta el diccionario personal).

### 13.3. Flujo

1. Un `ViewPlugin` tokeniza únicamente el **viewport visible** (+ 1 pantalla de margen) con la expresión `/[\p{L}\p{M}'’-]+/gu`.
2. Las palabras no presentes en la caché `Map<string, boolean>` se envían al worker en lote.
3. El worker responde; se actualiza la caché y se emiten `Decoration.mark` para las erróneas.
4. La palabra que contiene el cursor **no se marca** hasta que el cursor la abandona, para no señalar palabras a medio escribir.
5. Debounce de 400 ms tras el último cambio.

Se ignoran: tokens con dígitos, palabras de una sola letra, y las presentes en el diccionario personal.

## 14. Bloques de Folio dentro del `.md`: notas y diccionario

Dos contenidos propios de cada novela viajan dentro del propio archivo, como comentarios HTML al final del documento (`src/persistence/folioBlocks.ts`), en este orden: **notas** y después **diccionario personal**. Así, al abrir el `.md` en otro navegador o dispositivo, ambos viajan con él.

```markdown
<!-- folio:notas
Notas de trabajo de Folio para esta novela (escaleta, ideas, personajes…).
Este bloque lo mantiene Folio; no forma parte del texto y no se incluye al exportar.

[folio:nota 1]
Texto libre del primer espacio de notas.
[folio:nota 3]
Tercer espacio (los vacíos no se escriben).
-->

<!-- folio:diccionario
Palabras que el corrector ortográfico de Folio acepta en esta novela, una por línea.
Este bloque lo mantiene Folio; no forma parte del texto y no se incluye al exportar.

Aldebarán
Kaelith
-->
```

Reglas comunes:

- Se separan al leer y se vuelven a unir al escribir: **el editor nunca los ve**, así que no aparecen como texto, no cuentan como capítulo ni suman palabras. La exportación a TXT los descarta (los nodos HTML no se exportan). «Descargar el .md» sí los incluye, porque es el archivo completo.
- Cada bloque es: marcador, líneas de descripción, una línea vacía y el contenido. Un bloque nunca contiene `-->` en su interior (en las notas se escapa como `--\>`), de modo que un bloque no puede tragarse a otro.
- Sin contenido no se escribe el bloque: una novela sin notas ni palabras queda exactamente igual que antes.
- Si un bloque no está al final (en su orden) o está mal cerrado, se trata como texto normal (aparece en el editor) y no se pierde nada.
- Editar notas o diccionario es un cambio del documento: pasa por el autosave y el borrador vivo como cualquier edición.

### 14.1. Notas

Tres espacios de texto libre por novela (escaleta, ideas, fichas de personajes…), en tres pestañas dentro del mismo bloque (cada pestaña muestra como título la primera palabra de su nota, o su número si está vacía), separados por líneas `[folio:nota N]`; los espacios vacíos no se escriben y un bloque sin marcadores (formato antiguo o editado a mano) se carga entero en el primero. Se abre desde la paleta con «Notas»: un panel que ocupa casi toda la ventana, con la cabecera «Notas» y las pestañas, un `textarea` sin placeholder en la fuente de la interfaz a tamaño reducido, y un botón «Cerrar» (también `Esc`). Cada pulsación se refleja en el documento; no hay botón de guardar. Se recuerda la última pestaña abierta durante la sesión.

### 14.2. Diccionario personal

Lista de palabras aceptadas (`Set<string>`, case-sensitive) propia de cada novela. Se aplica en el hilo principal antes de consultar al worker. Dentro del bloque, una línea es una palabra si no contiene espacios; el resto se ignora.

Formas de añadir una palabra, todas iniciadas por el usuario:

- Atajo `Cmd/Ctrl+Shift+D` con el cursor sobre la palabra.
- Paleta de comandos → «Añadir “palabra” al diccionario» (aparece como primera acción cuando el cursor está sobre una palabra marcada).

Desde la paleta también se puede abrir «Diccionario» (lista con eliminación).

Migración: las palabras que versiones anteriores guardaban en IndexedDB se trasladan a la primera novela que se abra con escritura directa y se borran del navegador (se avisa con un mensaje).

## 15. Modo claro

Fondo blanco roto, negro suavizado. Se evita el blanco puro sobre negro puro.

## 16. Modo oscuro

Fondo prácticamente negro, texto gris muy claro (no blanco puro). El Focus Mode funciona igual con el par `--fg` / `--fg-dim`.

### 16.1. Tokens de diseño

```css
:root {                      /* claro */
  --bg: #F5F4F0;
  --fg: #2A2A2A;
  --fg-dim: #9C9A94;
  --fg-faint: #C9C7C1;       /* marcadores markdown, ornamentos */
  --err: #C97A7A;
  --sel: rgba(42, 42, 42, .12);
}
:root[data-theme="dark"] {
  --bg: #111111;
  --fg: #D6D3CC;
  --fg-dim: #66645F;
  --fg-faint: #3A3936;
  --err: #A86B6B;
  --sel: rgba(214, 211, 204, .14);
}
```

Valor inicial: `prefers-color-scheme`. El usuario puede fijar claro, oscuro o «sistema» desde la paleta; se persiste en `localStorage` (`folio.theme`). El atributo `data-theme` se aplica en `<html>` antes del primer render para evitar parpadeo (script inline en `index.html`).

## 17. Pantalla completa

`document.documentElement.requestFullscreen()` mediante acción explícita: paleta de comandos o atajo `Cmd/Ctrl+Shift+F`. Nunca se fuerza automáticamente. `Esc` sale (comportamiento nativo). En PWA instalada (`standalone`) el efecto es casi equivalente sin necesidad de fullscreen.

## 18. Exportación a TXT

Desde la paleta: «Exportar». Genera texto plano sin sintaxis Markdown:

- `# Título` → línea `Título` precedida de dos líneas vacías (salvo al inicio).
- `## Título` → línea `Título` precedida de una línea vacía.
- `***` / `---` → línea `* * *`.
- `*cursiva*`, `**negrita**`, `_cursiva_` → texto sin marcadores.
- Resto: intacto.

Implementación con `remark-parse` → mdast → serializador propio de ~40 líneas (no se usa `mdast-util-to-string` porque descarta estructura). Guardado con `showSaveFilePicker` (nombre sugerido `<novela>.txt`) o descarga en modo degradado. **No modifica el `.md`.**

## 19. Paleta de comandos y atajos

Toda la funcionalidad oculta se alcanza desde **un único punto**: la paleta de comandos (`Cmd/Ctrl+K`). Overlay centrado, campo de texto, lista filtrada, `Esc` cierra. Es el único menú de la aplicación.

| Acción | Atajo directo |
|---|---|
| Paleta de comandos | `Cmd/Ctrl+K` |
| Índice de capítulos | `Cmd/Ctrl+P` |
| Pantalla completa | `Cmd/Ctrl+Shift+F` |
| Añadir palabra al diccionario | `Cmd/Ctrl+Shift+D` |
| Tema claro/oscuro | `Cmd/Ctrl+Shift+L` |
| Aumentar / reducir tamaño de texto | `Cmd/Ctrl+=` / `Cmd/Ctrl+-` |
| Guardar ahora (fuerza `flush`) | `Cmd/Ctrl+S` |
| Cerrar overlay | `Esc` |

Orden de la paleta: Capítulos, Notas, Pantalla completa, tema, texto centrado, y después el resto (exportar TXT, asistencia literaria, corrector, añadir palabra, Diccionario). Acciones solo en paleta: exportar TXT, notas, activar/desactivar corrector, texto centrado, asistencia literaria, diccionario. Para cambiar de novela se vuelve a la pantalla inicial recargando la página; no hay comando. Solo por atajo (no aparecen en la paleta): guardar ahora, tamaño del texto.

`Cmd/Ctrl+S` existe porque el reflejo del usuario es pulsarlo; no debe abrir el diálogo del navegador.

## 20. Asistencia literaria (tipografía española, activada por defecto)

Sustituciones al teclear, pensadas para narrativa en castellano:

- `--` → `—` (raya).
- `"` → `«` o `»` según contexto (apertura tras espacio/inicio de línea, cierre en otro caso).
- `...` → `…`.
- `Enter` → **párrafo nuevo** (inserta una línea en blanco, que es lo que Markdown necesita para separar párrafos). Si el cursor ya está en una línea vacía, inserta un solo salto. `Shift+Enter` → salto de línea simple dentro del párrafo.

Las sustituciones se implementan como `inputHandler` de CodeMirror; el comportamiento de `Enter` como `keymap` con `Prec.high`. Se desactiva desde la paleta y la preferencia se persiste. `Cmd/Ctrl+Z` deshace la sustitución de forma natural gracias al historial.

## 21. Contador de palabras

Un único contador, abajo a la derecha, junto al indicador de estado, con la misma estética sutil que el botón de menú (color atenuado, opacidad 0,35 → 0,85 al pasar el ratón): `469/23004` = palabras del capítulo actual / palabras de la novela. Si el cursor está antes del primer `#`, muestra solo el total.

Se actualiza de inmediato al mover el cursor (índice cacheado) y con 300 ms de espera tras escribir. El índice de capítulos (§5.1) muestra además el conteo por capítulo. No existe ningún otro contador ni estadística.

Se cuentan las secuencias que cumplen `/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu`, excluyendo las líneas de encabezado y separadores. Se calcula sobre el mismo índice de capítulos (§5.2) para no recorrer el documento dos veces.

## 22. Persistencia de preferencias

El archivo `.md` permanece limpio, salvo los bloques de notas y diccionario (§14). Todo lo demás vive en el navegador.

### `localStorage` (síncrono, necesario antes del primer render)

| Clave | Valores |
|---|---|
| `folio.theme` | `light` \| `dark` \| `system` |
| `folio.fontSize` | `16`–`28` |
| `folio.typewriter` | `true` \| `false` |
| `folio.spell.enabled` | `true` \| `false` |
| `folio.typography.es` | `true` \| `false` |

### IndexedDB `folio` (v2)

| Store | Clave | Contenido |
|---|---|---|
| `novels` | `id` | `{ id, handle, name, lastOpened }` |
| `drafts` | `novelId` | `{ novelId, ts, text }` |
| `dictionary` | `lang` (siempre `es`) | `{ lang, words: string[] }` — heredado; solo se lee para migrar al `.md` (§14.2) |

Acceso mediante la librería `idb` (wrapper de promesas, ~1 KB).

## 23. Arquitectura técnica

### 23.1. Stack

| Capa | Elección | Justificación |
|---|---|---|
| Build | Vite + TypeScript (strict) | Estático, rápido, sin configuración |
| UI | **Vanilla TypeScript**, sin framework | La UI fuera del editor son cuatro overlays sin estado compartido. Un helper `el()` de ~15 líneas basta. Menos dependencias, un único modelo de DOM (el de CM6) |
| Editor | CodeMirror 6 (`@codemirror/state`, `view`, `commands`, `language`, `lang-markdown`) | §6.2 |
| Persistencia | `idb` | IndexedDB con promesas |
| Markdown (export) | `remark-parse` | Solo se carga al exportar (import dinámico) |
| Corrector | `nspell` + `dictionary-es` en Web Worker | §13.2 |
| PWA | `vite-plugin-pwa` | Manifest, SW, `file_handlers` |
| Tests | Vitest + Playwright (Chromium) | §25 |
| Despliegue | GitHub Actions → GitHub Pages | Push a `main` publica |

Objetivo de peso: < 250 KB gzip en la carga inicial (sin diccionario). El diccionario (~1 MB) se carga en diferido.

### 23.2. Estructura de módulos

```
src/
  main.ts                 arranque: tema, adapter, pantalla inicial o launchQueue
  app/
    state.ts              estado global mínimo (novela abierta, adapter, novelId)
    shortcuts.ts          mapa de atajos → comandos
    commands.ts           registro de comandos (fuente única para paleta y atajos)
  fs/
    FileAdapter.ts        interfaz
    FsAccessAdapter.ts
    FallbackAdapter.ts
    detect.ts
  editor/
    createEditor.ts       ensamblado de extensiones
    theme.ts              EditorView.theme + HighlightStyle
    focusMode.ts
    typewriter.ts
    chapters.ts           StateField: índice + conteo de palabras
    spellcheck.ts         ViewPlugin + puente al worker
    typography.ts         inputHandler tipografía española
  persistence/
    db.ts                 apertura y migraciones IndexedDB
    autosave.ts           máquina de estados
    liveDraft.ts
    dictionary.ts         diccionario personal en memoria + migración desde IndexedDB
    folioBlocks.ts        bloques <!-- folio:notas --> y <!-- folio:diccionario --> al final del .md
    prefs.ts
    locks.ts              navigator.locks + BroadcastChannel
  ui/
    el.ts                 helper de creación de DOM
    StartScreen.ts
    Palette.ts            paleta de comandos e índice de capítulos (misma base)
    ConflictDialog.ts
    StatusDot.ts
    Notice.ts             mensajes de una línea, autodescartables
    DictionaryManager.ts
    Notes.ts              bloc de notas de la novela
  export/
    toTxt.ts
  workers/
    spell.worker.ts
  styles/
    tokens.css
    base.css
    editor.css
    overlays.css
public/
  fonts/                  iA Writer Quattro (woff2)
  manifest.webmanifest
```

### 23.3. Flujo de arranque

1. Script inline en `index.html` aplica `data-theme` desde `localStorage`.
2. `main.ts` detecta el adapter y abre IndexedDB.
3. Si `launchQueue` entrega un archivo (PWA), se abre directamente. Si no, se muestra `StartScreen`.
4. Al abrir: leer → normalizar → comprobar borrador vivo → adquirir lock → crear editor → iniciar autosave y live draft.

## 24. Detalles de implementación de las extensiones

### 24.1. `chapters.ts`

`getChapterIndex(state)` calcula el índice bajo demanda y lo cachea por `state.doc` (`WeakMap`). Recorre `ensureSyntaxTree(state)` con `iterate` filtrando `ATXHeading1`/`ATXHeading2`. Para cada capítulo guarda `{ level, title, from, to, target, words }`, donde `target` es el primer párrafo tras el encabezado (o el final del documento si no hay texto, lo que en una novela nueva deja una línea en blanco bajo el título). El conteo de palabras se hace sobre `state.doc.sliceString(from, to)` de cada rango, excluyendo líneas de encabezado y separadores.

### 24.2. `focusMode.ts`

Ver §8.1. El rango del párrafo se obtiene caminando `state.doc.line(n)` hacia arriba y abajo desde la línea del cursor hasta encontrar líneas vacías. Coste O(líneas del párrafo).

### 24.3. `spellcheck.ts`

Ver §13.3. El worker expone `check(words: string[]): boolean[]` y `addWord(word)`. La comunicación usa `postMessage` con `id` de correlación. Las decoraciones se guardan en un `StateField<DecorationSet>` y se mapean con `decorations.map(tr.changes)` en cada transacción para no recalcular al teclear.

### 24.4. `autosave.ts`

Ver §9.2–§9.6. Es una clase sin dependencia de DOM que recibe `getText()`, el `FileAdapter` y callbacks de estado, para poder testearla con temporizadores falsos en Vitest.

## 25. Calidad, tests y despliegue

### Tests unitarios (Vitest)

- `autosave`: debounce, encadenado, reintentos, conflicto, error de permiso (con `vi.useFakeTimers()`).
- `LiveDraft` y `PersonalDictionary` sobre IndexedDB (con `fake-indexeddb`).
- `chapters`: índice y conteo con documentos de prueba (encabezados en código, sin encabezados, solo H2).
- `toTxt`: casos de encabezados, énfasis anidado, separadores.
- `typography`: contexto de comillas.

### Smoke test e2e (`npm run smoke`)

`scripts/smoke.mjs` levanta `dist/` en un servidor local, abre el Chrome del sistema con `playwright-core` e inyecta una implementación en memoria de `showOpenFilePicker`/`showSaveFilePicker` para recorrer el flujo completo sin diálogos nativos: nueva novela con capítulo por defecto, autosave real sobre el "archivo", focus mode, paleta, índice con contadores, navegación, tema, corrector y reapertura. Es la base sobre la que se construirán los e2e siguientes.

### Tests e2e (Playwright, Chromium)

- Nueva novela → capítulo por defecto → escribir → autosave (se verifica el archivo en disco con un directorio temporal y la API real de Chromium).
- Índice de capítulos: navegación y conteo visible.
- Recuperación de borrador tras cierre brusco.
- Modo degradado: forzar ausencia de `showOpenFilePicker` y comprobar aviso + descarga.

### Rendimiento

Documento de referencia: 150 000 palabras (~900 KB). Objetivos: apertura < 1 s, latencia de tecleo < 16 ms, recálculo de índice < 50 ms, corrector sin bloquear el hilo principal.

### Despliegue

Workflow en `.github/workflows/deploy.yml`: `npm ci` → `npm test` → `npm run build` → `actions/deploy-pages`. `base` de Vite configurada para el subpath del repositorio. Cabeceras: GitHub Pages no permite configurarlas; no se requiere ninguna especial (la File System Access API funciona con HTTPS estándar).

## 26. Accesibilidad

- `prefers-reduced-motion` desactiva transiciones.
- Todos los overlays son navegables por teclado y devuelven el foco al editor al cerrarse.
- `aria-live="polite"` en `Notice` para mensajes de una línea.
- Tamaño de texto ajustable (§7).
- Contraste mínimo de `--fg` sobre `--bg` ≥ 7:1; `--fg-dim` ≥ 3:1 (es texto secundario por diseño).

## 27. Principio fundamental de UX

Cada nueva funcionalidad debe superar una pregunta:

> **¿Esto ayuda a escribir sin distraer?**

Si una funcionalidad es útil pero necesita controles, opciones o información adicional, estos elementos deben permanecer ocultos hasta que el usuario los solicite, y el único lugar donde solicitarlos es la paleta de comandos.

## 28. Plan de implementación por fases

| Fase | Alcance | Criterio de salida |
|---|---|---|
| **0. Cimientos** (1–2 días) | Vite + TS, CM6 con Markdown, iA Writer Quattro, tokens de diseño, `el()`, workflow de Pages | La web está publicada y muestra el editor vacío con la tipografía definitiva |
| **1. Escribir y guardar** (≈1 semana) | `StartScreen`, `FsAccessAdapter`, nueva novela con capítulo por defecto, reabrir última, autosave completo (máquina de estados, conflicto, errores), `StatusDot`, tests de `autosave` | Una hora escribiendo sin tocar nada y el `.md` siempre al día |
| **2. Flow** (3–4 días) | Focus mode, paleta de comandos, índice de capítulos con contador, tema claro/oscuro, pantalla completa, tamaño de texto, typewriter | Toda la UI oculta es alcanzable desde `Cmd+K` y desaparece con `Esc` |
| **3. Seguridad** (2 días) | Borrador vivo, detección de cambios externos, bloqueo multi-pestaña, gestión de errores de guardado, tests | Cerrar la pestaña en mitad de una frase y recuperarla; editar el archivo desde fuera y resolver el conflicto |
| **4. Corrector** (≈1 semana) | Worker Hunspell (español), chequeo por viewport, caché, diccionario personal, medición de memoria (`nspell` vs `hunspell-asm`) | 150 000 palabras sin bloqueos perceptibles |
| **5. Cierre** (2–3 días) | Exportar TXT, PWA + `file_handlers`, `FallbackAdapter`, e2e Playwright, accesibilidad | Instalable, abre `.md` desde el sistema, funciona degradado en Firefox |
| **6. Extras** (según feedback) | Tipografía española | — |

Estimación total fases 0–5: **4–5 semanas** a tiempo completo. Producto utilizable al final de la fase 1.

## 29. Fuera de alcance (por ahora)

Control de versiones o historial de cualquier tipo, exportación DOCX/EPUB, metas diarias y gráficas, sinónimos, modo lectura, colaboración, sincronización propia, soporte móvil, cualquier integración con servicios externos.

## Idea rectora de Folio

> **Folio no pretende ser un procesador de textos. Es un lugar para escribir.**

Cuando el usuario está escribiendo correctamente, debería poder olvidarse de que Folio existe.
