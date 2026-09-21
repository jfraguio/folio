# TO-DO — Especificación funcional y técnica

> Documento de especificación para implementar **to-do**, una aplicación web independiente cuya estética y mecanismos se inspiran directamente en **Folio** (`https://github.com/jfraguio/folio`).  
> **Regla de oro:** no se toca ni se modifica nada del proyecto Folio. TO-DO es un proyecto completamente nuevo, en su propio directorio/repositorio. Se reutilizan sus ideas, patrones y tokens de diseño, copiando o adaptando código cuando convenga, pero jamás enlazando ni editando el código de Folio.

---

## 1. Visión del producto

**to-do** es una aplicación web minimalista para guardar notas en **texto plano**. Hereda de Folio su filosofía: cero distracciones, interfaz casi invisible, el texto como protagonista, guardado automático y transparente, y escritura sobre archivos locales reales en formato Markdown/texto plano.

La aplicación consta de **una única pantalla con hasta 10 pestañas (tabs)**, equivalentes a las «Notas» de Folio. Cada tab es un espacio de texto libre e independiente; se empieza con una y se crean o quitan desde la propia barra. El contenido de las tabs ocupa **toda la pantalla**.

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
| **Hasta 10 tabs de texto plano** | Pantalla única con entre 1 y 10 espacios de texto libre. Equivalen a las «Notas» de Folio, pero son el contenido principal de la app, no un panel secundario. Un archivo nuevo arranca con una tab; desde el menú se crea otra («Crear pestaña», mientras haya menos de 10) o se elimina la abierta si está vacía («Eliminar pestaña N»); nunca se borra texto y siempre queda al menos una. |
| **Nombre de tab dinámico** | Una tab vacía se llama por su número (`1`, `2`, … `10`). Si tiene contenido, su nombre es la **primera palabra** del contenido. |
| **Contenido a pantalla completa** | El área de texto de la tab activa ocupa toda la ventana (menos la franja de las propias tabs y los elementos discretos de las esquinas). |
| **Sin botón Cerrar** | Las tabs no son un panel/modal: son la aplicación. No existe botón «Cerrar» en la vista de tabs, ni iconos de crear/quitar: eso va en el menú. |
| **Autosave** | Mismo mecanismo y misma máquina de estados que Folio (debounce, guardado periódico, reintentos), sin diálogo de conflicto (§6.3), con el mismo **punto de estado abajo a la derecha**. |
| **Menú** | Se abre con un botón abajo a la izquierda (idéntico al de Folio: tres líneas horizontales) **o con atajo de teclado** (`Cmd/Ctrl+K`). Es un overlay tipo paleta de comandos. |
| **Tema claro/oscuro** | Opción del menú. Mismos tokens de color que Folio. |
| **Corrector ortográfico** | Opción del menú para activar/desactivar. Palabras erróneas pintadas de rojo apagado, igual que en Folio, sin subrayado ni sugerencias. |
| **Diccionario personal** | Opción del menú. Lista de palabras aceptadas, persistente dentro del propio `.md`, con gestión (ver/quitar). |
| **Historial** | Opción del menú. Versiones del archivo: al abrir, cada hora y a petición («Guardar versión»); 50 máx.; solo lectura, descargables (§8.3). |
| **Pantalla completa** | Entrar/salir de pantalla completa (acción explícita, nunca automática). |
| **Marca de la app** | Arriba a la derecha, con la misma estética que «FOLIO», el texto **«TO-DO»**. |

### 2.2. Lo que NO tiene to-do (excluido a propósito)

- ❌ Texto centrado (typewriter scrolling).
- ❌ Capítulos / índice de capítulos.
- ❌ Panel «Notas» de Folio como overlay (en to-do las notas **son** la pantalla principal).
- ❌ Asistencia literaria (tipografía española, sustituciones al teclear).
- ❌ Exportar a TXT.
- ❌ Contador de palabras.
- ❌ Focus mode por párrafo (atenuado del resto del texto).
- ❌ **Interpretación de Markdown**: el texto se muestra siempre como texto plano, sin estilizar `**negrita**`, `#`, listas, etc. (Se quitó `@codemirror/lang-markdown`.)
- ❌ Asistente de creación de «nueva novela»: to-do trabaja con **un único archivo** `.md` por defecto (ver §4).

### Funcionalidad propia de to-do (no heredada de Folio)

- **TO-DOs resueltos**: una línea que empieza por `--` se muestra **tachada entera** y atenuada (`.cm-done`). El documento sigue siendo texto plano; es solo decoración.
- **Contador de resueltos**: a la izquierda de la marca «TO-DO», en rojo (`--misspell`), cuenta las líneas `--…` (resueltas) de la **tab abierta**. Se oculta si no hay ninguna.
- **Enlaces clicables**: las URLs (`https://…`, `www.…`) se subrayan y se abren en pestaña nueva con `⌘/Ctrl+clic`. El corrector las ignora.

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
  --font-size: 16px;
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
- Las tabs se reparten el ancho disponible sin desbordar: cada una mide como máximo `1/N` del espacio (`N = 10`, el máximo, expuesto al CSS como `--tab-count`), de modo que el hueco de cada tab mide lo mismo haya las que haya y crear una no mueve las demás. En pantallas estrechas (≤ 700 px) la barra se desplaza en horizontal y la tab activa se centra sola. Los títulos largos se recortan con puntos suspensivos; el título completo va en el `title` del botón.
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
[todo:tab 2]
[todo:tab 3]
Contenido de la tercera tab (la segunda está vacía: solo su marcador).

<!-- todo:diccionario
Palabras que el corrector ortográfico de to-do acepta, una por línea.
Este bloque lo mantiene to-do; no forma parte del texto.

Aldebarán
Kaelith
-->
```

Reglas (equivalentes a `folioBlocks.ts`):

- Marcador por tab: `[todo:tab N]` (`N` = posición, de 1 a 10) en línea propia. Una tab vacía se escribe **solo con su marcador**, para que siga existiendo al reabrir; un documento con una única tab vacía queda vacío del todo.
- Un archivo sin marcadores (texto plano cualquiera, o formato antiguo) se carga **entero en la tab 1**.
- Al cargar hay tantas tabs como indique el marcador más alto (mínimo 1); en archivos anteriores, que omitían las vacías, los huecos se leen como tabs vacías y nada cambia de sitio. Abrir y guardar un archivo ya en el formato actual no lo modifica.
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

- Entre 1 y 10 tabs, numeradas por posición. Un archivo nuevo tiene una.
- **Nombre**: primera palabra del contenido (`/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u`, como `tabTitle` de Folio), truncada a 16 caracteres con `…` si es más larga; si la tab está vacía, su número (`1`…`10`).
- Cambiar de tab: clic, o atajos (ver §9). Al cambiar, el editor muestra el contenido de la nueva tab y el foco vuelve al texto (cursor al final, como en `Notes.ts`).
- Al entrar en la aplicación se abre siempre la primera tab con su contenido. La tab activa no se persiste entre sesiones (hubo una clave `todo.lastTab`; se retiró).
- **Crear**: opción «Crear pestaña» del menú (§8.2), visible mientras haya menos de 10 tabs; añade una tab vacía al final y pasa a ella.
- **Eliminar**: opción «Eliminar pestaña N» (N = la tab abierta) del menú (§8.2), visible solo si la tab abierta está vacía (su nombre es su número) y no es la única; al elegirla se quita y pasa a estar activa la que ocupa su sitio (o la última). Nunca se borra texto: una tab con contenido no se puede eliminar.
- Los atajos `Mod+N` y los dígitos con el menú abierto solo actúan si esa tab existe.

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

### 6.3. Escritura: el disco manda si es más nuevo

```ts
const file = await handle.getFile();
if (file.lastModified > lastKnownMtime) return reloadFromDisk(); // abortar: alguien guardó después
const w = await handle.createWritable();  // temporal + swap atómico en close()
await w.write(text);
await w.close();
lastKnownMtime = (await handle.getFile()).lastModified;
```

**No hay diálogo de conflicto.** Política de concurrencia, pensada para un archivo en iCloud Drive editado desde varios ordenadores:

- Todo lo que se escribe en local se guarda en el archivo.
- Justo antes de escribir se comprueba el `lastModified` físico. Si es **posterior** al de la versión cargada, la escritura se aborta, se relee el archivo y su contenido sustituye al local (conservando la posición del cursor). En el peor de los casos se pierden los segundos de trabajo desde el último sondeo (§6.6).
- Si es igual o **anterior** (aunque el contenido difiera, p. ej. una restauración con fecha antigua), lo local prevalece y se escribe.

La misma regla la aplica el sondeo de cambios externos (§6.6), que detecta la versión nueva sin necesidad de que el usuario escriba.

### 6.4. Errores de guardado

| Causa | Detección | Respuesta |
|---|---|---|
| Permiso revocado | `NotAllowedError` | Estado `error`; al pulsar el punto, `requestPermission()` y reintento |
| Archivo borrado/movido | `NotFoundError` | Estado `error`; «Guardar como…» |
| Otro | cualquier excepción | Estado `error`; reintento exponencial (2 s, 4 s, 8 s… máx. 60 s) |

**Regla absoluta:** el texto nunca se pierde mientras la pestaña esté abierta.

### 6.5. Borrador vivo (live draft)

Contenido completo (las 10 tabs + diccionario serializados) en IndexedDB (`store drafts`, clave `todoId`) con debounce de 300 ms. Al abrir, si hay un borrador más reciente que el archivo y con contenido distinto, se ofrece **una vez** recuperarlo. En modo degradado es el único autosave real.

### 6.6. Detección de cambios externos

El archivo suele vivir en una carpeta sincronizada (iCloud Drive), así que puede cambiar desde otro ordenador mientras está abierto. Para no trabajar largo rato sobre una versión obsoleta, la sesión sondea el estado del archivo de forma **ligera**: solo `lastModified`, nunca hashes ni lecturas periódicas del contenido (`src/persistence/fileWatcher.ts`).

- **Estado:** `file` (archivo abierto) y `lastKnownModified` = `autosave.lastKnownMtime`, el mtime de la versión cargada. Es un único valor compartido con el autosave, que ya lo actualiza con cada escritura propia; así una escritura nuestra nunca se confunde con un cambio externo.
- **Polling:** cada **10 s** mientras hay un archivo abierto con escritura directa. `checkLastModified()`: `handle.getFile().lastModified` y comparar.
  - Igual o anterior → nada (no se lee el contenido ni se toca el editor; la versión cargada sigue siendo la vigente).
  - Posterior → releer el archivo, volcarlo en el editor (tabs + diccionario, conservando la posición del cursor), `autosave.accept(mtime, texto)` y aviso breve.
- **Al recuperar el foco:** `visibilitychange` → `visible` y `focus` de la ventana ejecutan la misma comprobación de inmediato, sin esperar al siguiente intervalo.
- **Salvaguardas:** una sola comprobación en vuelo; si el `getFile()` falla (iCloud puede tener el archivo no disponible unos instantes) se ignora y se reintenta en el siguiente ciclo. La recarga es **incondicional**: el disco manda aunque haya cambios locales sin guardar. La única excepción es una escritura propia en vuelo (`saving`): recargar en mitad de ella dejaría editor y disco desincronizados y el mtime de nuestra escritura ocultaría la diferencia; además esa escritura ya hace su propia comprobación (§6.3). Se espera al siguiente ciclo.
- En modo degradado (sin File System Access) no hay sondeo: el `File` del `<input>` es una instantánea y su `lastModified` nunca cambia.

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

1. **Modo zen / Desactivar modo zen** — etiqueta dinámica. Persiste (`todo.zen`).
2. **Tema claro/oscuro** — etiqueta dinámica: «Tema oscuro» si está en claro, «Tema claro» si está en oscuro. Persiste en `localStorage` (`todo.theme`: `light` | `dark` | `system`).
3. **Pantalla completa / Salir de pantalla completa** — solo si el navegador tiene la API (§10.2). Sin atajo.
4. **Activar/Desactivar corrector** — etiqueta dinámica según el estado. Persiste (`todo.spell.enabled`).
5. **Diccionario** — abre el gestor del diccionario personal (§7.1). Solo con el corrector activado.
6. **Crear pestaña** — mientras haya menos de 10 tabs (§5).
7. **Eliminar pestaña N** — solo si la tab abierta está vacía y no es la única (§5).
8. **Historial** — abre el panel de historial (§8.3). No en modo degradado.

Entradas condicionales adicionales, después de las anteriores:

- «Añadir «palabra» al diccionario» — solo con el corrector activado y el cursor sobre una palabra.
- «Descargar el .md» — solo en modo degradado.
- «Reintentar guardado» — solo tras un error de guardado.

### 8.3. Historial

Versiones del `.md` completo (tabs y diccionario incluidos) guardadas en IndexedDB (`src/ui/History.ts` + `src/persistence/backups.ts`), con fecha/hora y número de palabras. Se ligan al `todoId`, así que sobreviven a renombrar el archivo. En modo degradado no se guardan versiones y la opción no aparece en el menú.

Cuándo se guarda una versión:

- **Al abrir** el archivo, si hace más de una hora de la versión más reciente (o no hay ninguna): se guarda lo que había en el disco, antes de cualquier recuperación de borrador.
- **Cada hora** mientras la aplicación está abierta (`HISTORY_INTERVAL_MS`), con el texto actual del editor. Tres horas abierta → tres versiones.
- **A petición**, con el botón **«Guardar versión»** del panel: guarda la foto actual sin esperar, con independencia de cuándo fue la última.

Reglas:

- Con cada versión se guarda el **SHA-256** del texto (`hash`). Ninguna versión, automática ni manual, se guarda si su hash coincide con el de la versión más reciente: una hora sin tocar el archivo no consume plaza, y «Guardar versión» sin cambios avisa «Sin cambios desde la última versión». Se compara solo con la más reciente: volver a un texto anterior sí genera versión.
- Se conservan las **50 más recientes** (`HISTORY_KEEP = 50`): al guardar la 51.ª desaparece la más antigua.
- El panel muestra una fila por versión (fecha y hora, palabras) con botón **«Descargar»** (guarda como `<nombre> — YYYY-MM-DD HH.mm.md` vía `showSaveFilePicker` o descarga directa), y abajo **«Guardar versión»**.
- **A propósito no existe «restaurar»:** una versión nunca vuelve al editor ni al archivo desde el navegador. Si el usuario quiere recuperar algo, la descarga y la abre como cualquier `.md`.

Migración: la BD pasa a versión 2. El store `backups` cambia su clave de `[todoId, day]` (una copia por día) a `[todoId, ts]`; las copias existentes se conservan.

---

## 9. Atajos de teclado

| Acción | Atajo |
|---|---|
| Abrir menú | `Cmd/Ctrl+K` |
| Ir a tab 1–10 | `Cmd/Ctrl+1` … `Cmd/Ctrl+0` (recomendado; decidir en implementación) |
| Tab siguiente / anterior | `Cmd/Ctrl+Tab` / `Cmd/Ctrl+Shift+Tab` (o `Ctrl+PageDown/PageUp`; decidir) |
| Añadir palabra al diccionario | `Cmd/Ctrl+Shift+D` |
| Guardar ahora (fuerza `flush`, evita el diálogo del navegador) | `Cmd/Ctrl+S` |
| Cerrar overlay | `Esc` |

Pantalla completa y tema claro/oscuro no tienen atajo: solo se activan desde el menú.

Los atajos se instalan con un listener global en fase de captura (igual que `installShortcuts` de Folio) y usan `Mod` = ⌘ en Mac / Ctrl en el resto.

---

## 10. Otros mecanismos

### 10.1. Pantalla completa

`document.documentElement.requestFullscreen()` / `document.exitFullscreen()`, solo mediante acción explícita (menú o atajo). Nunca automática. `Esc` sale (nativo).

### 10.2. Marca «TO-DO»

`<h1 class="brand">TO-DO</h1>` fijo arriba a la derecha (§3.3). Al pasar el ratón, `title` con el nombre del archivo abierto y su última modificación en disco (igual que en Folio).

### 10.3. Focus mode

No se incluye en la implementación inicial. Si se añadiera después, se copiaría `src/editor/focusMode.ts` de Folio sin cambios.

### 10.4. Tamaño de texto

Fijo, sin atajos ni preferencia (hubo `Cmd/Ctrl+=` / `Cmd/Ctrl+-` y `todo.fontSize`; se retiraron). Bases en `tokens.css`: `--ui: 19px` es el `rem` del cromo; `--font-size: 16px` es el cuerpo del editor en ambos modos (normal y zen), y `--text-size` (alias de `--font-size`) el de las tabs. Entre modos solo cambian el interlineado, la columna y el focus mode, no el tamaño de letra.

### 10.5. Avisos (Notice)

Mensajes de una línea autodescartables abajo en el centro (`.notice` de Folio), con `aria-live="polite"`.

---

## 11. Persistencia de preferencias

### `localStorage` (síncrono, antes del primer render)

| Clave | Valores |
|---|---|
| `todo.theme` | `light` \| `dark` \| `system` |
| `todo.spell.enabled` | `true` \| `false` |
| `todo.zen` | `true` \| `false` |

El atributo `data-theme` se aplica en `<html>` con un script inline en `index.html` antes del primer render (anti-parpadeo), igual que en Folio.

### IndexedDB `todo` (misma estructura que Folio, adaptada)

| Store | Clave | Contenido |
|---|---|---|
| `files` | `id` | `{ id, handle, name, lastOpened }` |
| `drafts` | `todoId` | `{ todoId, ts, text }` — borrador vivo |
| `backups` | `[todoId, ts]` (índice `todoId`) | `{ todoId, ts, text, hash, words }` — versiones del historial (BD v2; `hash` ausente en las migradas de v1, se calcula al comparar) |

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
      backups.ts            versiones del historial (apertura, horaria, manual)
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
3. Al abrir: leer → normalizar → lock → versión de apertura si toca → comprobar borrador vivo → parsear `todoBlocks` (tabs + diccionario) → crear TabBar + editor con la tab activa → iniciar autosave y live draft.

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
- `autosave`: debounce, encadenado, reintentos, disco posterior aborta y recarga, disco anterior se sobrescribe (Vitest con `vi.useFakeTimers()`), igual que en Folio.
- `fileWatcher`: sondeo cada 10 s por `lastModified`, recarga solo si es posterior, espera si hay escritura propia en vuelo, una comprobación en vuelo, errores ignorados.
- `tabTitle`: primera palabra, truncado, número si vacía.
- `backups`: versión de apertura si hace más de una hora, horaria, deduplicación por SHA-256 frente a la más reciente (también la manual), retención de 50, migración v1→v2 con hash calculado al vuelo.

---

## 15. Criterios de aceptación

1. La app muestra las tabs en la parte superior (una en un archivo nuevo, hasta 10 con «Crear pestaña» en el menú; la abierta, si está vacía, se quita con «Eliminar pestaña N»); la tab activa ocupa toda la pantalla y **no hay botón Cerrar**.
2. Tab vacía → nombre = número; tab con contenido → nombre = primera palabra (truncada a 16 chars).
3. Autosave funcional con el punto de estado abajo a la derecha, mismos estados y comportamiento que Folio.
4. Botón de menú abajo a la izquierda + `Cmd/Ctrl+K` abren el menú-overlay.
5. Menú con exactamente estas opciones base, en este orden: **Tema claro/oscuro**, **Activar/Desactivar corrector**, **Diccionario**, **Historial** (más las condicionales que se decidan: añadir palabra, pantalla completa, guardar como).
6. Corrector: palabras erróneas en rojo apagado (`--misspell`), sin subrayado, activado por defecto, solo español.
7. Diccionario personal persistido en el bloque `<!-- todo:diccionario -->` del `.md`.
8. Historial: versiones (al abrir si hace más de 1 h, cada hora, botón «Guardar versión»; 50 máx.), solo descargables, nunca restaurables.
9. Pantalla completa disponible (entrada de menú, sin atajo de teclado).
10. Marca «TO-DO» arriba a la derecha con la estética de «FOLIO».
11. Todo el contenido persiste en un único `.md` con la estructura de marcadores `[todo:tab N]`.
12. **El proyecto Folio no se modifica en absoluto.**

---

## 16. Idea rectora

> **to-do es un bloc de notas que se comporta como una hoja de papel perpetua: abres, escribes, y te olvidas de que existe.**
