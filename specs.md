# TO-DO — Especificación funcional y técnica

> Documento de especificación para implementar **to-do**, una aplicación web independiente cuya estética y mecanismos se inspiran directamente en **Folio** (`https://github.com/jfraguio/folio`).  
> **Regla de oro:** no se toca ni se modifica nada del proyecto Folio. TO-DO es un proyecto completamente nuevo, en su propio directorio/repositorio. Se reutilizan sus ideas, patrones y tokens de diseño, copiando o adaptando código cuando convenga, pero jamás enlazando ni editando el código de Folio.

---

## 1. Visión del producto

**to-do** es una aplicación web minimalista para guardar notas en **texto plano**. Hereda de Folio su filosofía: cero distracciones, interfaz casi invisible, el texto como protagonista, guardado automático y transparente, y escritura sobre archivos locales reales en formato Markdown/texto plano.

La aplicación consta de **una única pantalla con 10 pestañas (tabs)**, equivalentes a las 10 «Notas» de Folio. Cada tab es un espacio de texto libre e independiente. El contenido de las tabs ocupa **toda la pantalla**.

Principios fundamentales (heredados de Folio):

- Cero distracciones; interfaz extremadamente minimalista.
- El texto es siempre el protagonista.
- Escritura sobre un archivo local real (`.md`), que es la única fuente de verdad.
- Guardado automático y transparente; el usuario nunca piensa en guardar.
- Corrección ortográfica discreta (solo marca visual, nunca sugerencias), activada por defecto.
- Contrastes suaves y gran comodidad visual; modo claro y modo oscuro.
- Nada debe interrumpir al usuario mientras escribe.

> **to-do no pretende ser un gestor de tareas ni un procesador de textos. Es un bloc de notas persistente y silencioso.**

---

## 2. Ámbito funcional

### 2.1. Lo que SÍ tiene to-do

| Funcionalidad | Detalle |
|---|---|
| **10 tabs de texto plano** | Pantalla única con 10 espacios de texto libre. Equivalen a las «Notas» de Folio, pero son el contenido principal de la app, no un panel secundario. |
| **Nombre de tab dinámico** | Una tab vacía se llama por su número (`1`, `2`, … `10`). Si tiene contenido, su nombre es la **primera palabra** del contenido. |
| **Contenido a pantalla completa** | El área de texto de la tab activa ocupa toda la ventana (menos la franja de las propias tabs y los elementos discretos de las esquinas). |
| **Sin botón Cerrar** | Las tabs no son un panel/modal: son la aplicación. No existe botón «Cerrar» en la vista de tabs. |
| **Autosave** | Mismo mecanismo y misma máquina de estados que Folio (debounce, guardado periódico, reintentos, conflictos), con el mismo **punto de estado abajo a la derecha**. |
| **Menú** | Se abre con un botón abajo a la izquierda (idéntico al de Folio: tres líneas horizontales) **o con atajo de teclado** (`Cmd/Ctrl+K`). Es un overlay tipo paleta de comandos. |
| **Tema claro/oscuro** | Opción del menú. Mismos tokens de color que Folio. |
| **Corrector ortográfico** | Opción del menú para activar/desactivar. Palabras erróneas pintadas de rojo apagado, igual que en Folio, sin subrayado ni sugerencias. |
| **Diccionario personal** | Opción del menú. Lista de palabras aceptadas, persistente dentro del propio `.md`, con gestión (ver/quitar). |
| **Historial** | Opción del menú. Copias de seguridad de apertura (solo lectura, descargables), igual que en Folio. |
| **Pantalla completa** | Entrar/salir de pantalla completa (acción explícita, nunca automática). |
| **Marca de la app** | Arriba a la derecha, con la misma estética que «FOLIO», el texto **«TO-DO»**. |

### 2.2. Lo que NO tiene to-do (excluido a propósito)

- ❌ Texto centrado (typewriter scrolling).
- ❌ Capítulos / índice de capítulos.
- ❌ Panel «Notas» de Folio como overlay (en to-do las notas **son** la pantalla principal).
- ❌ Asistencia literaria (tipografía española, sustituciones al teclear).
- ❌ Exportar a TXT.
- ❌ Contador de palabras.
- ❌ Focus mode por párrafo (atenuado del resto del texto). *Decisión de producto: ver §10.3 — puede reevaluarse, pero la implementación inicial no lo incluye.*
- ❌ Asistente de creación de «nueva novela»: to-do trabaja con **un único archivo** `.md` por defecto (ver §4).

---

## 3. Estética (heredada de Folio)

La apariencia visual debe ser indistinguible de Folio salvo en el nombre de la app. Se copian sus tokens y estilos base.

### 3.1. Tipografía

- **iA Writer Quattro** (SIL OFL), auto-hospedada en WOFF2: `Regular`, `Italic`, `Bold`, `BoldItalic`, `font-display: swap`.
- Fallback: `'iA Writer Quattro', 'IBM Plex Sans', system-ui, sans-serif`.
- Cuerpo de texto: **21 px** por defecto, ajustable entre 16 y 28 px (opcional; ver §10.4). Interlineado `1.65`.

### 3.2. Tokens de diseño (`tokens.css`)

Se copian **literalmente** de Folio:

```css
:root {                      /* claro */
  --bg: #F5F4F0;
  --fg: #2A2A2A;
  --fg-dim: #9C9A94;
  --fg-faint: #C9C7C1;       /* marcadores, ornamentos */
  --err: #C97A7A;
  --misspell: #A8534E;       /* palabras erróneas: rojo apagado */
  --sel: rgba(42, 42, 42, .12);
  --overlay-bg: rgba(245, 244, 240, .92);
  --panel-bg: #FBFAF7;
  --panel-border: #E3E1DB;
  --chrome-opacity: 0.35;
  --chrome-opacity-hover: 0.85;
  --font: 'iA Writer Quattro', 'IBM Plex Sans', system-ui, sans-serif;
  --font-size: 21px;
  --line-height: 1.65;
  --ease: 120ms ease;
}
:root[data-theme="dark"] {
  --bg: #111111;
  --fg: #D6D3CC;
  --fg-dim: #66645F;
  --fg-faint: #3A3936;
  --err: #A86B6B;
  --misspell: #C4837C;
  --sel: rgba(214, 211, 204, .14);
  --overlay-bg: rgba(17, 17, 17, .92);
  --panel-bg: #181817;
  --panel-border: #2A2927;
  --chrome-opacity: 0.85;
  --chrome-opacity-hover: 1;
}
@media (prefers-reduced-motion: reduce) { :root { --ease: 0s; } }
```

### 3.3. Elementos fijos (chrome) con estética Folio

- **Marca «TO-DO»**: `position: fixed; top: 1.1rem; right: 1.1rem;` — tipografía pequeña (`0.72rem`), `letter-spacing: 0.08em`, mayúsculas, color `--fg-dim`, opacidad `--chrome-opacity-hover`, `user-select: none`. Igual que `.brand` de Folio, pero con el texto `TO-DO`.
- **Botón de menú** (abajo a la izquierda): `position: fixed; left: 1.1rem; bottom: 1.1rem;` 22×22 px, tres líneas SVG (`viewBox 0 0 14 10`, líneas en y=1,5,9, `stroke-width: 1`), color `--fg-dim`, opacidad `--chrome-opacity` → `--chrome-opacity-hover` al pasar el ratón. `title`/`aria-label`: «Menú (⌘K)» / «Menú (Ctrl+K)» según plataforma.
- **Punto de estado del guardado** (abajo a la derecha): ver §6.1.

### 3.4. Barra de tabs

A diferencia de Folio (donde las pestañas viven dentro de un panel modal), en to-do las tabs son la estructura principal. Se sitúan en la **parte superior** de la pantalla, en una franja discreta que no rompe la inmersión:

- Fila única, siempre visible, que no ocupa más de lo necesario.
- Las 10 tabs se reparten el ancho disponible sin desbordar: cada una mide como máximo `1/N` del espacio (`N = 10`, expuesto al CSS como `--note-tabs`, igual que en `Notes.ts` de Folio). Los títulos largos se recortan con puntos suspensivos; el título completo va en el `title` del botón.
- Estilo de cada tab (igual que `.notes__tab` de Folio): texto pequeño (`0.72rem`), color `--fg-dim`, pill (`border-radius: 999px`), borde transparente; la tab activa usa color `--fg`, borde `--panel-border` y fondo `--sel`.
- La franja de tabs respeta los mismos márgenes sutiles que el resto del chrome (opacidad atenuada que sube al interactuar, o simplemente discreta por defecto).

### 3.5. Área de texto

- Ocupa toda la pantalla bajo la franja de tabs.
- **Decisión de diseño:** se recomienda usar **CodeMirror 6** (igual que Folio) en lugar de un `<textarea>`, para poder pintar las palabras erróneas en rojo con `Decoration.mark` (un `<textarea>` no permite estilizar fragmentos de texto). El corrector es un requisito, así que CodeMirror es la elección técnica necesaria.
- El contenido se presenta en una **columna centrada de ~65 caracteres** (`max-width: 38rem`) con padding vertical generoso (`padding: 22vh 0 60vh` en `.cm-content`), igual que Folio, para preservar la sensación de «hoja de papel».  
  *Nota: el requisito «el contenido ocupa toda la pantalla» se refiere a que las tabs son la app completa (no un panel); el texto sigue en columna centrada, fiel a la estética Folio.*
- Cursor: barra fina de 2 px con el color de texto principal, parpadeo nativo.
- Selección: fondo semitransparente `--sel`.
- Sin barra de herramientas, sin números de línea, sin botones dentro del texto.
- Scrollbar oculta (`scrollbar-width: none`), como en Folio.

---

## 4. Archivo de trabajo y persistencia

### 4.1. Un único `.md`

to-do trabaja sobre **un único archivo `.md`** que el usuario elige al abrir la app (o crea la primera vez). Formato:

- Markdown estándar, legible como texto plano, UTF-8, saltos `\n`.
- Sin front matter, sin metadatos propietarios, con una única excepción: el bloque de diccionario personal al final, como comentario HTML (igual que en Folio).

### 4.2. Estructura de las tabs dentro del `.md`

Cada tab es una sección delimitada por un marcador propio, al estilo de los bloques `[folio:nota N]` de Folio, pero con el prefijo de la app. Se usa un único comentario HTML al final del documento (o, alternativa equivalente, todo el documento como bloques):

**Opción recomendada (fiel a Folio, adaptada):** las 10 tabs son el **contenido principal**, y se almacenan en un bloque comentado al final **no aplica** — en to-do las tabs *son* el documento. Se adopta esta estructura, análoga a las notas de Folio:

```markdown
[todo:tab 1]
Contenido de la primera tab.
[todo:tab 4]
Contenido de la cuarta tab (las vacías no se escriben).

<!-- todo:diccionario
Palabras que el corrector ortográfico de to-do acepta, una por línea.
Este bloque lo mantiene to-do; no forma parte del texto.

Aldebarán
Kaelith
-->
```

Reglas (equivalentes a `folioBlocks.ts`):

- Marcador por tab: `[todo:tab N]` (`N` de 1 a 10) en línea propia. Las tabs vacías **no se escriben**.
- Un archivo sin marcadores (texto plano cualquiera, o formato antiguo) se carga **entero en la tab 1**.
- Al cargar, la sesión siempre tiene 10 tabs; las que falten quedan vacías, y al guardar siguen sin escribirse (el `.md` no cambia por el mero hecho de abrirlo).
- El bloque `<!-- todo:diccionario ... -->` va **al final**, tras la última tab. Es un comentario HTML: cualquier visor Markdown lo ignora.
  - Dentro del bloque: marcador, líneas de descripción, línea vacía, y una palabra por línea.
  - Una línea es una palabra válida si no contiene espacios; el resto se ignora.
  - Sin palabras no se escribe el bloque.
  - Un `-->` dentro del contenido se escapa como `--\>` al escribir y se desescapa al leer, para que un bloque no se trague a otro.
- Si el bloque de diccionario no está al final o está mal cerrado, se trata como texto normal (aparecería como contenido de la última tab) y no se pierde nada.
- Editar cualquier tab o el diccionario es un cambio del documento: pasa por el autosave y el borrador vivo como cualquier edición.

> **Constante:** `TAB_COUNT = 10` (equivalente a `NOTE_TABS` de Folio).

### 4.3. Normalización al abrir

- `\r\n` → `\n`; se elimina BOM si existe. No se modifica nada más. Si la normalización cambió el contenido, el archivo no se reescribe hasta que el usuario edite.

### 4.4. Acceso al archivo

Interfaz única (copiar/adaptar de Folio `src/fs/`):

```ts
interface FileAdapter {
  readonly capabilities: { directWrite: boolean; persistentHandle: boolean };
  open(): Promise<TodoFile | null>;
  create(defaultContent: string): Promise<TodoFile | null>;
  reopenLast(): Promise<TodoFile | null>;
  read(f: TodoFile): Promise<{ text: string; mtime: number }>;
  write(f: TodoFile, text: string): Promise<{ mtime: number }>;
  saveAs(text: string, suggestedName: string): Promise<TodoFile | null>;
}
```

- **`FsAccessAdapter`**: File System Access API (`showOpenFilePicker` / `showSaveFilePicker` / `createWritable`), persiste el handle en IndexedDB. Navegadores Chromium de escritorio (≥ 108).
- **`FallbackAdapter`** (Firefox/Safari): abrir con `<input type="file">`; `write()` no disponible; `saveAs()` descarga con `<a download>`. El borrador vivo hace de autosave. Aviso discreto de una línea en la pantalla inicial.
- **Pantalla inicial mínima** (estilo Folio): «Abrir to-do», «Nuevo to-do» (sugiere `to-do.md`), y «Continuar» si hay handle persistido. Tras cualquiera, se entra directamente en las tabs.
- `navigator.locks` + `BroadcastChannel` para evitar edición simultánea en dos pestañas (igual que Folio §9.7).

---

## 5. Tabs

### 5.1. Comportamiento

- 10 tabs fijas, numeradas 1–10.
- **Nombre**: primera palabra del contenido (`/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u`, como `tabTitle` de Folio), truncada a 16 caracteres con `…` si es más larga; si la tab está vacía, su número (`1`…`10`).
- Cambiar de tab: clic, o atajos (ver §9). Al cambiar, el editor muestra el contenido de la nueva tab y el foco vuelve al texto (cursor al final, como en `Notes.ts`).
- Se recuerda la última tab activa durante la sesión (y puede persistirse en `localStorage`, clave `todo.lastTab`).
- No hay creación ni borrado de tabs: siempre son 10.

### 5.2. Datos

- En memoria: `tabs: string[]` de longitud 10 (`''` para las vacías).
- Al escribir en una tab: actualizar `tabs[active]`, re-renderizar los títulos de la barra de tabs, y disparar el flujo de cambio (autosave + borrador vivo).

---

## 6. Guardado automático (autosave)

**Idéntico a Folio** (`src/persistence/autosave.ts`). Se copia la máquina de estados sin cambios funcionales.

### 6.1. Indicador de estado

Punto de 6 px en la **esquina inferior derecha**, color atenuado del tema (`.status-dot` de Folio):

| Estado | Visual |
|---|---|
| `saved` | Punto invisible (opacidad 0) |
| `dirty` / `saving` | Punto visible, opacidad 0.4 |
| `error` | Punto en color `--err`, opacidad 0.8, `title` explicativo; al pulsarlo, reintenta o abre «Guardar como…» |
| `conflict` | Igual que `error`; al pulsarlo abre el diálogo de conflicto |
| `degraded` | Punto visible opacidad 0.4 (modo sin escritura directa) |

Al pasar el ratón: tooltip «Guardado hace 2 min» (tipografía pequeña). En to-do **no hay contador de palabras**, así que el punto puede ir solo en la esquina.

### 6.2. Máquina de estados

```
idle ──edición──▶ dirty ──debounce 1,5 s──▶ saving ──ok──▶ saved
                    ▲                          │
                    │                          ├──error──▶ error ──reintento/gesto──▶ saving
                    └──edición durante saving──┘ (pendingAgain)
```

Disparadores de `flush()`:

- Debounce 1,5 s tras la última edición.
- Cada 30 s si sigue `dirty`.
- `visibilitychange` → `hidden`, `pagehide` / `beforeunload` (best-effort).

Una sola escritura en vuelo; cambios durante la escritura marcan `pendingAgain` y se reescriben al terminar.

### 6.3. Escritura y conflicto

```ts
const file = await handle.getFile();
if (file.lastModified !== lastKnownMtime) return enterConflict(file);
const w = await handle.createWritable();  // temporal + swap atómico en close()
await w.write(text);
await w.close();
lastKnownMtime = (await handle.getFile()).lastModified;
```

Conflicto (mtime distinto): se detiene el autosave, el punto pasa a `conflict`, y un diálogo mínimo ofrece **«Conservar mi versión»** (sobrescribe) o **«Cargar la del disco»** (reemplaza el editor; advierte de que los cambios locales se pierden). Mientras tanto se puede seguir escribiendo: el borrador vivo protege el texto.

### 6.4. Errores de guardado

| Causa | Detección | Respuesta |
|---|---|---|
| Permiso revocado | `NotAllowedError` | Estado `error`; al pulsar el punto, `requestPermission()` y reintento |
| Archivo borrado/movido | `NotFoundError` | Estado `error`; «Guardar como…» |
| Otro | cualquier excepción | Estado `error`; reintento exponencial (2 s, 4 s, 8 s… máx. 60 s) |

**Regla absoluta:** el texto nunca se pierde mientras la pestaña esté abierta.

### 6.5. Borrador vivo (live draft)

Contenido completo (las 10 tabs + diccionario serializados) en IndexedDB (`store drafts`, clave `todoId`) con debounce de 300 ms. Al abrir, si hay un borrador más reciente que el archivo y con contenido distinto, se ofrece **una vez** recuperarlo. En modo degradado es el único autosave real.

---

## 7. Corrector ortográfico

Igual que Folio (§13 de su spec):

- **Activado por defecto.** Solo señal visual, nunca sugerencias.
- **Marca:** la palabra se tiñe de rojo apagado, sin subrayado: `.cm-misspelled { color: var(--misspell); }`.
- **Motor:** Hunspell en un **Web Worker** con `nspell` y el paquete `dictionary-es`, copiado en build a `public/dict/es.{aff,dic}` (script tipo `scripts/copy-dictionaries.mjs`), cargado bajo demanda con `fetch` y cacheado por el Service Worker. Solo español, sin selector de idioma.
- `contenteditable` con `spellcheck="false"` cuando el corrector propio está activo; al desactivarlo no se activa el nativo.
- **Flujo:** `ViewPlugin` que tokeniza el viewport visible (+1 pantalla de margen) con `/[\p{L}\p{M}'’-]+/gu`; palabras no cacheadas se envían al worker en lote; `Decoration.mark` para las erróneas; la palabra bajo el cursor no se marca hasta abandonarla; debounce 400 ms. Se ignoran tokens con dígitos, palabras de una letra y las del diccionario personal.
- **Se aplica a la tab activa.** Al cambiar de tab, el editor cambia de documento y el plugin re-escanea.

## 7.1. Diccionario personal

- `Set<string>` case-sensitive, aplicado en el hilo principal antes de consultar al worker.
- Persiste en el bloque `<!-- todo:diccionario -->` del propio `.md` (§4.2).
- **Añadir palabra:** atajo `Cmd/Ctrl+Shift+D` con el cursor sobre la palabra, o acción del menú «Añadir “palabra” al diccionario» (visible solo si el cursor está sobre una palabra marcada — puede incluirse como entrada condicional en el menú, igual que en la paleta de Folio).
- **Gestionar:** opción del menú «Diccionario» abre un overlay con la lista de palabras en pills; pulsar una la elimina. Estilo `.dict` / `.dict__word` de Folio.
- Tras quitar palabras, Hunspell no puede olvidarlas: se recarga el worker y se re-escanea.

---

## 8. Menú

El menú es un **overlay tipo paleta de comandos**, idéntico en comportamiento y estética a la paleta de Folio (`src/ui/Palette.ts`): overlay centrado (`padding-top: 14vh`), panel `min(34rem, 92vw)` con fondo `--panel-bg`, borde `--panel-border`, radio 8 px, sombra suave, animación de entrada de 120 ms. Cierre con `Esc` o clic fuera. Navegación con flechas + `Enter`, y filtrado al escribir (campo de búsqueda opcional).

### 8.1. Apertura

- Botón de menú abajo a la izquierda (§3.3).
- Atajo de teclado `Cmd/Ctrl+K` (igual que la paleta de Folio).

### 8.2. Contenido del menú (orden exacto)

1. **Tema claro/oscuro** — etiqueta dinámica: «Tema oscuro» si está en claro, «Tema claro» si está en oscuro. Persiste en `localStorage` (`todo.theme`: `light` | `dark` | `system`).
2. **Activar/Desactivar corrector** — etiqueta dinámica según el estado. Persiste (`todo.spell.enabled`).
3. **Diccionario** — abre el gestor del diccionario personal (§7.1).
4. **Historial** — abre el panel de historial (§8.3).

Entradas condicionales adicionales (al estilo de Folio, si se decide incluirlas):

- «Añadir «palabra» al diccionario» — solo cuando el cursor está sobre una palabra (primera posición).
- «Guardar como…» / «Descargar el .md» — solo en modo degradado o tras error de guardado.
- «Pantalla completa» / «Salir de pantalla completa» — ver §10.2; puede vivir solo como atajo o también como entrada del menú. **Decisión recomendada:** incluirla como quinta entrada del menú para que sea descubrible, ya que el enunciado exige el mecanismo.

### 8.3. Historial

Idéntico al de Folio (`src/ui/History.ts` + `src/persistence/backups.ts`):

- Al abrir el archivo (con escritura directa) se guarda en IndexedDB una **copia de apertura** del `.md` tal y como se leyó del disco (tabs y diccionario incluidos), con fecha/hora y número de palabras.
- Reglas: como mucho **una copia por día local**; **sin duplicados** (si el contenido coincide con cualquier copia existente, no se guarda); se conservan las **10 más recientes** (`BACKUP_KEEP = 10`); se ligan al `todoId`, así que sobreviven a renombrar el archivo. En modo degradado no se guardan copias y la opción no aparece en el menú.
- El panel muestra una fila por copia: fecha y hora, número de palabras, y botón **«Descargar»** (guarda como `<nombre> — YYYY-MM-DD.md` vía `showSaveFilePicker` o descarga directa).
- **A propósito no existe «restaurar»:** una copia nunca vuelve al editor ni al archivo desde el navegador. Si el usuario quiere recuperar algo, descarga la copia y la abre como cualquier `.md`.

---

## 9. Atajos de teclado

| Acción | Atajo |
|---|---|
| Abrir menú | `Cmd/Ctrl+K` |
| Ir a tab 1–10 | `Cmd/Ctrl+1` … `Cmd/Ctrl+0` (recomendado; decidir en implementación) |
| Tab siguiente / anterior | `Cmd/Ctrl+Tab` / `Cmd/Ctrl+Shift+Tab` (o `Ctrl+PageDown/PageUp`; decidir) |
| Pantalla completa | `Cmd/Ctrl+Shift+F` |
| Añadir palabra al diccionario | `Cmd/Ctrl+Shift+D` |
| Tema claro/oscuro | `Cmd/Ctrl+Shift+L` |
| Guardar ahora (fuerza `flush`, evita el diálogo del navegador) | `Cmd/Ctrl+S` |
| Cerrar overlay | `Esc` |

Los atajos se instalan con un listener global en fase de captura (igual que `installShortcuts` de Folio) y usan `Mod` = ⌘ en Mac / Ctrl en el resto.

---

## 10. Otros mecanismos

### 10.1. Pantalla completa

`document.documentElement.requestFullscreen()` / `document.exitFullscreen()`, solo mediante acción explícita (menú o atajo). Nunca automática. `Esc` sale (nativo).

### 10.2. Marca «TO-DO»

`<h1 class="brand">TO-DO</h1>` fijo arriba a la derecha (§3.3). Al pasar el ratón, `title` con el nombre del archivo abierto y su última modificación en disco (igual que en Folio).

### 10.3. Focus mode

No se incluye en la implementación inicial. Si se añadiera después, se copiaría `src/editor/focusMode.ts` de Folio sin cambios.

### 10.4. Tamaño de texto (opcional)

Se puede incluir `Cmd/Ctrl+=` / `Cmd/Ctrl+-` (16–28 px, `todo.fontSize`) copiando `prefs.ts` de Folio. No es requisito del enunciado; incluir solo si es gratis (lo es, son 10 líneas).

### 10.5. Avisos (Notice)

Mensajes de una línea autodescartables abajo en el centro (`.notice` de Folio), con `aria-live="polite"`.

---

## 11. Persistencia de preferencias

### `localStorage` (síncrono, antes del primer render)

| Clave | Valores |
|---|---|
| `todo.theme` | `light` \| `dark` \| `system` |
| `todo.fontSize` | `16`–`28` (opcional) |
| `todo.spell.enabled` | `true` \| `false` |
| `todo.lastTab` | `0`–`9` |

El atributo `data-theme` se aplica en `<html>` con un script inline en `index.html` antes del primer render (anti-parpadeo), igual que en Folio.

### IndexedDB `todo` (misma estructura que Folio, adaptada)

| Store | Clave | Contenido |
|---|---|---|
| `files` | `id` | `{ id, handle, name, lastOpened }` |
| `drafts` | `todoId` | `{ todoId, ts, text }` — borrador vivo |
| `backups` | `[todoId, day]` (índice `todoId`) | `{ todoId, day: 'YYYY-MM-DD', ts, text, words }` — copias de apertura |

Acceso con la librería `idb`.

---

## 12. Arquitectura técnica

### 12.1. Stack (el mismo que Folio)

| Capa | Elección |
|---|---|
| Build | Vite + TypeScript (strict) |
| UI | Vanilla TypeScript, sin framework; helper `el()` |
| Editor | CodeMirror 6 (`@codemirror/state`, `view`, `commands`, `language`, `lang-markdown`) |
| Persistencia | `idb` (IndexedDB) |
| Corrector | `nspell` + `dictionary-es` en Web Worker |
| PWA (opcional) | `vite-plugin-pwa`, `file_handlers` para `.md` |
| Tests | Vitest (+ Playwright para e2e, opcional) |

### 12.2. Estructura de módulos propuesta

```
to-do/
  index.html                script inline de tema anti-parpadeo
  package.json
  vite.config.ts
  tsconfig.json
  specs.md                  (este documento)
  scripts/
    copy-dictionaries.mjs   copia es.aff/es.dic a public/dict
  public/
    fonts/                  iA Writer Quattro (woff2)
    dict/                   es.aff, es.dic (generado)
  src/
    main.ts                 arranque: tema, adapter, pantalla inicial
    app/
      commands.ts           registro de comandos (fuente única para menú y atajos)
      shortcuts.ts          mapa de atajos
      session.ts            sesión de edición: tabs, autosave, servicios
    fs/
      FileAdapter.ts
      FsAccessAdapter.ts
      FallbackAdapter.ts
      detect.ts
    editor/
      createEditor.ts       CodeMirror con tema to-do
      theme.ts              HighlightStyle + decoraciones
      spellcheck.ts         ViewPlugin + puente al worker
    persistence/
      db.ts
      autosave.ts           máquina de estados (copiada de Folio)
      liveDraft.ts
      backups.ts            copias de apertura
      dictionary.ts         diccionario personal
      todoBlocks.ts         parseo/serialización de [todo:tab N] y <!-- todo:diccionario -->
      prefs.ts
      locks.ts
    ui/
      el.ts
      StartScreen.ts
      Menu.ts               paleta-menú
      TabBar.ts             barra de 10 tabs
      StatusDot.ts
      Notice.ts
      Dialog.ts
      DictionaryManager.ts
      History.ts
    workers/
      spell.worker.ts
    styles/
      tokens.css
      base.css
      editor.css
      overlays.css
      tabs.css              estilos de la barra de tabs
```

### 12.3. Flujo de arranque

1. Script inline en `index.html` aplica `data-theme` desde `localStorage`.
2. `main.ts` detecta adapter, abre IndexedDB, muestra `StartScreen` (Abrir / Nuevo / Continuar).
3. Al abrir: leer → normalizar → lock → copia de apertura → comprobar borrador vivo → parsear `todoBlocks` (tabs + diccionario) → crear TabBar + editor con la tab activa → iniciar autosave y live draft.

### 12.4. Sesión

Adaptación de `session.ts` de Folio:

- `tabs: string[]` (10) y `activeTab: number` en memoria.
- `getText()` = `joinDocument({ tabs, words: dictionary.list() })`.
- Un único `EditorView`; al cambiar de tab se reemplaza el documento (`view.dispatch({ changes: { from: 0, to: doc.length, insert: tabs[i] } })`) o se recrea el estado. El corrector re-escanea automáticamente.
- `markChanged()` en cada edición: liveDraft.schedule + autosave.markDirty.
- Elementos fijos: `.brand` (TO-DO), `.menu-button`, `.status-dot` (esquina inferior derecha), `.tab-bar` (superior).

---

## 13. Detalles de implementación a copiar/adaptar de Folio

| Módulo Folio | Acción en to-do |
|---|---|
| `src/styles/tokens.css`, `base.css`, `editor.css`, `overlays.css` | **Copiar casi literal.** Añadir `tabs.css` para la barra superior; mover los estilos `.notes__tab*` como referencia. Cambiar claves `localStorage` de `folio.*` a `todo.*`. |
| `src/persistence/autosave.ts` | **Copiar sin cambios funcionales.** |
| `src/persistence/backups.ts`, `liveDraft.ts`, `dictionary.ts`, `db.ts`, `locks.ts`, `prefs.ts`, `novels.ts` | **Copiar adaptando nombres** (`novelId` → `todoId`, stores). |
| `src/persistence/folioBlocks.ts` | **Adaptar** a `todoBlocks.ts`: marcadores `[todo:tab N]` (10 tabs como contenido principal, no en comentario) + bloque `<!-- todo:diccionario -->` al final. |
| `src/ui/StatusDot.ts`, `Notice.ts`, `Dialog.ts`, `el.ts`, `MenuButton.ts`, `DictionaryManager.ts`, `History.ts`, `Palette.ts` | **Copiar/adaptar.** `Palette.ts` se convierte en el menú. |
| `src/ui/Notes.ts` | **No se copia como panel.** Su lógica de tabs (`tabTitle`, reparto de ancho con `--note-tabs`, última tab activa) se traslada a `TabBar.ts`. |
| `src/editor/theme.ts`, `spellcheck.ts`, `workers/spell.worker.ts`, `spell/` | **Copiar sin cambios funcionales.** |
| `src/editor/focusMode.ts`, `typewriter.ts`, `typography.ts`, `chapters.ts`, `export/toTxt.ts`, `ui/WordCounter.ts` | **No se incluyen.** |
| `src/fs/*` | **Copiar adaptando nombres** (`NovelFile` → `TodoFile`, `DEFAULT_NOVEL_CONTENT` → contenido vacío o `# ` no aplica: to-do arranca con las 10 tabs vacías, es decir, archivo vacío o con marcador inicial mínimo). |
| `index.html` | **Copiar adaptando:** título `TO-DO`, claves `todo.*`. |

### Nombre de la marca en el código

- `document.title`: `TO-DO`.
- `.brand` text: `TO-DO`.
- Prefijo de bloques: `todo:`.
- Prefijo de claves: `todo.*`.

---

## 14. Tests (mínimos recomendados)

- `todoBlocks`: parseo/serialización de tabs (vacías no se escriben, sin marcadores → todo a tab 1, escape de `-->`, orden del bloque de diccionario).
- `autosave`: debounce, encadenado, reintentos, conflicto (Vitest con `vi.useFakeTimers()`), igual que en Folio.
- `tabTitle`: primera palabra, truncado, número si vacía.
- `backups`: una copia por día, sin duplicados, retención de 10.

---

## 15. Criterios de aceptación

1. La app muestra 10 tabs en la parte superior; la tab activa ocupa toda la pantalla (columna centrada estilo Folio) y **no hay botón Cerrar**.
2. Tab vacía → nombre = número; tab con contenido → nombre = primera palabra (truncada a 16 chars).
3. Autosave funcional con el punto de estado abajo a la derecha, mismos estados y comportamiento que Folio.
4. Botón de menú abajo a la izquierda + `Cmd/Ctrl+K` abren el menú-overlay.
5. Menú con exactamente estas opciones base, en este orden: **Tema claro/oscuro**, **Activar/Desactivar corrector**, **Diccionario**, **Historial** (más las condicionales que se decidan: añadir palabra, pantalla completa, guardar como).
6. Corrector: palabras erróneas en rojo apagado (`--misspell`), sin subrayado, activado por defecto, solo español.
7. Diccionario personal persistido en el bloque `<!-- todo:diccionario -->` del `.md`.
8. Historial: copias de apertura (1/día, sin duplicados, 10 máx.), solo descargables, nunca restaurables.
9. Pantalla completa disponible (atajo `Cmd/Ctrl+Shift+F` y/o entrada de menú).
10. Marca «TO-DO» arriba a la derecha con la estética de «FOLIO».
11. Todo el contenido persiste en un único `.md` con la estructura de marcadores `[todo:tab N]`.
12. **El proyecto Folio no se modifica en absoluto.**

---

## 16. Idea rectora

> **to-do es un bloc de notas que se comporta como una hoja de papel perpetua: abres, escribes, y te olvidas de que existe.**
