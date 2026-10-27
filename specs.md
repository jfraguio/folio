# FOLIO — Especificación estética y funcional

> Describe la aplicación **tal y como está implementada** a 22 de octubre de 2026 (commit `38426af` más los cambios de esa fecha: «Títulos», «Exportar pestaña», el paso entre paneles sin parpadeo y la corrección de los fallos encontrados al revisar este documento). Si algo del código contradice este documento, uno de los dos está mal y hay que decidir cuál. Los fallos conocidos, si los hay, se anotan en §7.
>
> Las mejoras técnicas pendientes están en `next-steps.md`.

---

## 1. Qué es folio

**folio** es un bloc de notas web, minimalista y silencioso, que escribe en **un archivo local de texto plano** (`.txt`; también abre los `.md` de versiones anteriores). Todo el contenido vive en ese archivo, organizado en **pestañas (tabs)** y **subpestañas (subtabs)**. La aplicación guarda sola, no interrumpe y apenas se ve: el texto ocupa toda la pantalla.

Principios:

1. **El texto es el protagonista.** Sin barras de herramientas, sin números de línea, sin botones dentro del texto. El cromo (marca, contadores, estado y menú) es pequeño, tenue y está en las esquinas.
2. **El archivo es la verdad.** Un `.txt` legible por cualquier editor. No hay servidor ni cuenta.
3. **Guardar no es tarea del usuario.** Guardado automático, borrador de emergencia, historial de versiones.
4. **Nada interrumpe.** Solo aparecen diálogos cuando la decisión es inevitable. El resto son avisos de una línea que desaparecen solos.
5. **Texto plano siempre.** No se interpreta Markdown salvo la sintaxis de enlace `[texto](url)`. Los títulos `#` y las tareas hechas `--` solo decoran. Lo único que **escribe** sintaxis por el usuario es: pegar una URL sobre una selección (crea `[texto](url)`), la protección de la sintaxis oculta de los enlaces (§3.7) y las sustituciones tipográficas del modo zen (§2.5).

Idioma de la interfaz: **español**, salvo los botones de la pantalla de inicio (`OPEN`, `NEW`, `CONTINUE`), que están en inglés a propósito (la nota de esa pantalla sí está en español).

---

## 2. Estética

### 2.1. Tipografía

| Uso | Fuente | Tamaño | Interlineado |
|---|---|---|---|
| Todo | **iA Writer Quattro** (archivo `iAWriterQuattroS-Regular.woff2`, SIL OFL 1.1), autoalojada, **precargada** (`<link rel="preload">`) y con `font-display: swap`. Respaldo: `'IBM Plex Sans', system-ui, sans-serif` | — | — |
| Texto del editor (modo normal) | Regular 400 | **16 px** (`--font-size`); en táctil nunca menos de 16 px, para evitar el zoom de iOS | **1,55** |
| Texto del editor (modo zen) | Regular 400 | 16 px | **1,65** (`--line-height`) |
| Títulos de las tabs | Regular 400 | 16 px (`--text-size` = `--font-size`) | 20 px (34 px en móvil) |
| Base del cromo (`rem`) | — | **19 px** (`--ui`) | 1,65 |
| Marca «FOLIO» y contador de palabras (zen) | Regular, mayúsculas, `letter-spacing: 0.08em` | 0,72 rem ≈ 13,7 px | 22 px |
| Contador de tareas hechas | Regular, cifras tabulares (sin mayúsculas ni espaciado extra) | 0,72 rem | 22 px |
| Menú y paneles | Regular | 0,9 rem ≈ 17,1 px (17 px en móvil) | 1,55 en el cuerpo de los paneles; 1,5 en Instrucciones |
| Botones y acciones de inicio | Regular | 0,85 rem (la acción secundaria de inicio y «Descargar» del historial, 0,75 rem) | — |
| Metadatos (atajos del menú, palabras y fechas del historial, muestras de Instrucciones) | Regular, cifras tabulares | 0,70–0,72 rem ≈ 13,5 px | — |
| Tooltip del punto de estado | Regular | 0,7 rem | — |
| Fila informativa del menú, nota de inicio, píldoras del diccionario | Regular | 0,8 rem | — |
| Avisos | Regular | 0,78 rem ≈ 14,8 px | — |

- El tamaño de letra es **fijo**: no hay atajos ni preferencia para cambiarlo.
- Suavizado `antialiased`, `text-rendering: optimizeLegibility`.
- Solo se declara y se distribuye el peso **Regular** sin cursiva; cualquier negrita o cursiva sería sintética (no se usan).
- Los `title` de la marca, de las tabs y del botón de menú son tooltips nativos del navegador (su tipografía no la controla folio).

### 2.2. Color y otros tokens

Contrastes suaves, sin negro ni blanco puros. Los dos temas usan los mismos nombres de token (`src/styles/tokens.css`).

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#F5F4F0` | `#111111` | Fondo de la app, del editor y de la barra de tabs |
| `--fg` | `#2A2A2A` | `#D6D3CC` | Texto, cursor, tab activa, línea del tachado, enlaces (texto y subrayado al pasar el ratón), borde del botón principal, acciones de inicio |
| `--fg-dim` | `#9C9A94` | `#66645F` | Cromo, tabs inactivas, separador de tabs, punto de estado y su tooltip, avisos, metadatos, texto tenue del modo zen, líneas hechas, **anillo de foco** |
| `--fg-faint` | `#C9C7C1` | `#3A3936` | Subrayado de los enlaces |
| `--err` | `#C97A7A` | `#A86B6B` | Punto de estado en error; palabra del diccionario al pasar el ratón |
| `--misspell` | `#A8534E` | `#C4837C` | Palabras con error ortográfico; contador de tareas hechas |
| `--sel` | `rgba(42,42,42,.12)` | `rgba(214,211,204,.14)` | Selección, fondo de la tab activa, fila activa del menú, botón al pasar el ratón |
| `--overlay-bg` | `rgba(245,244,240,.92)` | `rgba(17,17,17,.92)` | Velo detrás de los paneles |
| `--panel-bg` | `#FBFAF7` | `#181817` | Paneles y avisos |
| `--panel-border` | `#E3E1DB` | `#2A2927` | Bordes de paneles, avisos, botones, píldoras del diccionario, tab activa y separadores internos de los paneles |
| `--heading-bg` | `#E4E1DA` | `#232321` | Fondo de las líneas de título (también en la muestra de Instrucciones) |
| `--tab-sub-bg` | `#EBE9E4` | `#1C1C1B` | Fondo de las subtabs (y de la tab madre con una subtab abierta) |
| `--tab-sub-bg-active` | `#DCD9D1` | `#2C2C2A` | Fondo de la subtab activa |
| `--chrome-opacity` | 0,35 | 0,85 | Definido, **sin uso** |
| `--chrome-opacity-hover` | 0,85 | 1 | Opacidad de la marca, los contadores, el menú y el punto visible |

Tokens no cromáticos: `--font`, `--font-size: 16px`, `--ui: 19px`, `--text-size`, `--line-height: 1.65`, `--measure: 38rem` (columna zen), `--ease: 120ms ease`, `--fade-dot: 300ms ease`, `--fade-notice: 200ms ease`, `--safe-top/right/bottom/left` (= `env(safe-area-inset-*, 0px)`), `--tab-bar-height` (2,9 rem; en ≤ 700 px, `52px + --safe-top`) y `--touch-target: 44px`. La barra de tabs define los suyos (§2.3).

- **Cambio de tema**: tienen transición de 120 ms (`--ease`) el fondo de `html`/`body` y de la barra de tabs, los colores de las tabs y el color del texto del editor. El fondo del propio editor, la marca, los contadores, los paneles y los avisos cambian al instante.
- **`prefers-reduced-motion: reduce`**: no hay movimiento. `--ease`, `--fade-dot` (fundido de 300 ms del punto de estado) y `--fade-notice` (200 ms de los avisos) pasan a 0 s; se quitan el fundido del velo y el deslizamiento de las hojas inferiores; la tab activa se centra sin scroll suave; y el cursor no parpadea (se lee al crear cada estado del editor).
- `<meta name="theme-color">` sigue al tema (`#f5f4f0` / `#111111`), también cuando el tema es `system` y cambia el del sistema. `<meta name="color-scheme" content="light dark">`.
- El tema y el modo zen se aplican **antes del primer pintado** con un script en línea en `index.html` (lee `todo.theme` y `todo.zen` de `localStorage`), para que no haya parpadeo.

### 2.3. Disposición general (escritorio, > 700 px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Compra  Ideas  3  │ Lista  2                          12   FOLIO    │  ← barra de tabs (fija) · contador · marca
│                                                                      │
│  # Semana                                                            │  ← título: fondo --heading-bg a todo lo ancho
│  Leche y pan                                                         │
│  -- Llamar al banco                     (tachado y tenue)            │
│  https://ejemplo.com                    (subrayado tenue)            │
│  palabra mal escrita en rojo apagado                                 │
│                                                                      │
│                                                                      │
│                                                              ·  ≡    │  ← punto de estado · botón de menú
└──────────────────────────────────────────────────────────────────────┘
```

Capas (`z-index`): barra de tabs, marca, contadores y esquinas, 5; velo de los paneles, 10; avisos, 11.

#### Barra de tabs (arriba, fija)

- Franja fija de **2,9 rem (≈ 55 px)** de alto (relleno incluido), a todo el ancho, con **fondo opaco `--bg`** que tapa el texto al hacer scroll. Relleno: 1,1 rem arriba y a la izquierda, **7 rem a la derecha** para dejar sitio a la marca (en escritorio no suma las zonas seguras). No se puede seleccionar su texto.
- Dentro, una **tira horizontal** (`role="tablist"`) de botones (`role="tab"`, con `aria-selected`):
  - **Tabs principales** primero, en orden.
  - Después, un **separador vertical** decorativo (`aria-hidden`) de 1 × 14 px, radio 1 px, color `--fg-dim` al 55 %, centrado en vertical. Solo se ve si la tab abierta tiene subtabs.
  - Detrás, las **subtabs de la tab abierta** (solo las de esa tab).
- Cada tab es una **píldora** (`border-radius: 999px`) ceñida al texto: relleno horizontal `--tab-pad: min(0.3rem, 0.8vw)`, borde de 1 px transparente, texto `--fg-dim`, 16 px, una sola línea. Fondo y color con transición `--ease`.
  - **Hover** (solo en dispositivos con `hover: hover`): texto `--fg`.
  - **Activa**: texto `--fg`, borde `--panel-border`, fondo `--sel`.
  - **Subtab**: fondo `--tab-sub-bg`. **Subtab activa**: fondo `--tab-sub-bg-active` y el borde y el color de cualquier activa.
  - **Tab madre con una subtab abierta**: lleva el fondo `--tab-sub-bg`, pero su texto sigue tenue (la activa es la subtab).
- **Espaciado uniforme**: la distancia de texto a texto es la misma entre cualquier par de elementos, con o sin píldora y también a través del separador: `D = 2 × --tab-inset + --tab-gap`, con `--tab-gap: min(0.55rem, 1.75vw)` y `--tab-inset` = relleno + 1 px de borde. El separador lleva un margen de `--tab-inset` a cada lado. Las tabs no tienen ancho mínimo.
- **Ancho**: cada tab (principal **o subtab**) mide como máximo `--tab-max`, 1/10 del ancho de la tira contando los huecos (`--tab-count: 10`, el máximo, fijado desde `TabBar.ts`). Así el sitio de cada tab principal es el mismo haya las que haya, y crear una no mueve las demás. Los títulos largos se cortan con «…».
- **Desbordamiento**: si tabs y subtabs no caben, la tira se desplaza en horizontal (`overscroll-behavior-x: contain`), sin barra de scroll visible. Los bordes llevan siempre una máscara con un **degradado de 0,75 rem**, compensada con un margen negativo para que, en reposo, la primera y la última tab no queden atenuadas. Al activar una tab, si la tira desborda, la activa se **centra sola** con scroll suave.
- Pulsar la barra nunca quita el foco al editor (`mousedown` cancelado).

#### Marca «FOLIO» (arriba a la derecha)

- `h1.brand` (creada una vez en `main.ts`), fija a 1,1 rem de los bordes superior y derecho (más la zona segura), 22 px de alto, 0,72 rem, mayúsculas, `letter-spacing: 0.08em`, color `--fg-dim`, opacidad 0,85 (claro) / 1 (oscuro). No se selecciona. También se ve en la pantalla de inicio.
- Con un archivo abierto, su `title` es `‹nombre del archivo›` (con extensión) + salto de línea + `Última modificación: ‹fecha y hora›` (p. ej. «7 sept 2026, 13:42:05»): la del último guardado correcto o la de la versión cargada. Se fija cada vez que el estado pasa a `saved` o `error`, así que **en modo degradado no aparece**. Se quita al cerrar el archivo. La ruta completa no está disponible.

#### Contador de tareas hechas (a la izquierda de la marca)

- `span.done-count` (`aria-label` «TO-DOs resueltos»): 0,72 rem, 22 px de alto, opacidad `--chrome-opacity-hover`, color **`--misspell`** (rojo apagado) y cifras tabulares, fijo a 4,2 rem del borde derecho (más la zona segura). Sin mayúsculas ni `letter-spacing`.
- Muestra cuántas **líneas hechas** (`--`, §3.7) tiene la **tab o subtab abierta**. Si no hay ninguna, está vacío. Se recalcula como mucho una vez por frame al escribir, y al momento al cambiar de tab o recargar.

#### Esquina inferior derecha: punto de estado y menú

- Grupo fijo a 1,1 rem de los bordes inferior y derecho (más la zona segura), separación de 0,4 rem (1 rem en táctil). A la izquierda el punto de estado; a la derecha el botón de menú.
- **Botón de menú**: caja de 22 × 22 px con tres líneas horizontales (SVG de 14 × 10 px, `viewBox 0 0 14 10`, líneas en y = 1, 5 y 9 de x = 0 a 14, trazo de 1 px, `currentColor`), color `--fg-dim`, opacidad 0,85 / 1 (sin cambio al pasar el ratón ni con foco), radio de 4 px. `title` / `aria-label`: «Menú (⌘K)» en Mac (`navigator.platform` Mac, iPhone o iPad), «Menú (Ctrl+K)» en el resto y «Menú» en táctil. Abre el menú.
- **Punto de estado**: `<button>` de 22 × 22 px con un punto redondo de **6 px** en el centro, color `--fg-dim`. Su `aria-label` es el texto del estado (o «Estado del guardado» si no hay texto). Pulsarlo: en `error`, «Reintentar guardado»; en `degraded`, descarga el `.txt`; en otro caso, abre el menú.

| Estado | Aspecto | Tooltip |
|---|---|---|
| `idle` | Invisible (opacidad 0) | — (vacío) |
| `saved` | Invisible (fundido de 300 ms) | «Guardado hace un momento / hace N min / hace N h / ‹fecha›» (o «Guardado» sin fecha) |
| `dirty` | Visible (0,85 / 1) | «Cambios sin guardar» |
| `saving` | Visible | «Guardando…» |
| `error` | Color `--err`, opacidad 0,8 | «No se pudo guardar · pulsa para resolver» |
| `degraded` | Visible siempre | «Borrador local · descarga el .txt desde el menú» |

  - Nada más abrir un archivo el estado ya es `saved` con la hora de apertura, así que el tooltip dice «Guardado hace un momento» aunque no se haya escrito nada.
  - El tooltip (0,7 rem, `--fg-dim`, sin fondo, una línea, sin eventos de puntero) aparece con fundido `--ease` al pasar el ratón o con foco de teclado. En escritorio se ancla al grupo de la esquina (encima, alineado a la derecha del botón de menú); en táctil, encima del propio punto. El texto relativo se recalcula al entrar el ratón.
- En táctil, los dos controles tienen un área de toque invisible de **44 × 44 px** (`::before`) sin cambiar su dibujo.

#### Área de texto (modo normal)

- CodeMirror a pantalla completa (`html`, `body`, `#app` y `.editor-root` al 100 %, `100dvh` si existe), fondo `--bg`, sin contorno al enfocar, **scroll vertical sin barra visible**. En iOS el scroll tiene inercia y no provoca el «tirar para recargar» (`overscroll-behavior: contain`).
- El contenido ocupa **todo el ancho**: relleno lateral de 1 rem (más la zona segura) y relleno superior igual al alto de la barra de tabs más 0,5 rem. El relleno inferior es de **60 vh** (60 dvh si existe; 45 dvh en ≤ 700 px) para poder escribir con la línea activa a media pantalla.
- Ajuste de línea activado (`lineWrapping`), tabulación de 4.
- **Cursor**: el de CodeMirror (`drawSelection`; el nativo queda oculto), barra de 2 px en `--fg` con el parpadeo de CodeMirror (1,2 s). El cursor de arrastrar y soltar tiene el mismo aspecto. **Selección**: `--sel`.
- Se hacen visibles los caracteres especiales invisibles (`highlightSpecialChars`).
- Sin corrector nativo, sin autocorrección y sin mayúsculas automáticas (`spellcheck="false"`, `autocorrect="off"`, `autocapitalize="off"`).

#### Foco

Todos los botones y campos muestran con `:focus-visible` un anillo `1px solid --fg-dim` separado 2 px.

### 2.4. Decoraciones del texto

Todas son visuales. El archivo sigue siendo texto plano. Títulos y tareas hechas se calculan solo para la parte visible y se rehacen al cambiar el documento o el scroll.

| Convención | Regla | Aspecto |
|---|---|---|
| **Título** | La línea empieza por `#` (`/^[ \t]*#/`: con espacios o tabuladores opcionales delante y sin necesidad de espacio detrás, así que `#idea` también lo es) | Fondo `--heading-bg` a todo lo ancho de la línea; texto en su color normal. Deja un **hueco de 7,5 px debajo** (relleno con el fondo recortado al contenido, así que se ve como un margen). |
| **Tarea hecha** | La línea empieza por `--` pero no por `---` (`/^[ \t]*--(?!-)/`) | **Toda la línea tachada** (línea de 1 px en `--fg`), texto en `--fg-dim`. `---` o más se consideran separadores y no se tachan. (Una línea no puede ser a la vez título y tarea hecha.) |
| **Enlace** | `URL_RE = /\b(?:https?:\/\/\|www\.)[^\s<>"'()]+/giu`: `http(s)://…` o `www.…`, sin distinguir mayúsculas, hasta un espacio o `< > " ' ( )`. La puntuación final (`.`, `,`) queda dentro. No se decora aparte la URL de un enlace Markdown | Subrayado `--fg-faint` con separación de 2 px; con el ratón encima (`hover: hover`), subrayado `--fg`. Cursor de mano. Texto en `--fg`. |
| **Enlace Markdown** | `[texto](url)` en una línea: texto sin corchetes ni saltos; URL sin espacios ni paréntesis. Solo destinos `http(s)`, `mailto:`, `tel:` o sin esquema (se abre con `https://` delante); con cualquier otro esquema (`/^[a-z][a-z\d+.-]*:/i`: `javascript:`, `data:`, pero también `localhost:3000`) no es enlace | **Siempre plegado**: solo se ve el texto, con el aspecto de un enlace; corchetes y URL no se muestran nunca, tampoco con el cursor dentro (reemplazo atómico). Al pasar el ratón, `title` con el destino ya resuelto (con `https://` si no tenía esquema). |
| **Error ortográfico** | Palabra que Hunspell no reconoce (§3.8) | Texto en `--misspell`. **Sin subrayado.** |

Combinaciones:

- En modo normal el texto de un enlace es siempre `--fg`, aunque el corrector marque una palabra suya o esté en una línea hecha. En **zen**, los enlaces heredan el color de su línea, así que una palabra mal escrita dentro de `[texto](url)` sí se ve en rojo.
- En una línea hecha, las palabras mal escritas siguen en `--misspell` y el tachado pasa por encima de todo.

### 2.5. Modo zen

Un modo de escritura concentrada que imita al editor Folio original. Se activa y desactiva desde el menú y se recuerda entre sesiones (`todo.zen`). Todo lo visual cuelga de `html[data-zen]`, que el script en línea pone antes del primer pintado.

- **Columna centrada** de **38 rem (≈ 722 px)** sin relleno lateral (1 rem más la zona segura en ≤ 700 px; entre 701 y 722 px el texto toca los bordes). Relleno superior `max(22vh, barra + 0,5 rem)`; el inferior, como en modo normal. Interlineado **1,65**.
- **Separación entre párrafos** de 0,6 em. Cada línea del documento es un párrafo, aunque ocupe varias líneas en pantalla. La última no lleva hueco. Bajo un título se suman 0,6 em y 7,5 px.
- **Focus mode invertido**: todo el texto se ve **tenue** (`--fg-dim`), y solo la **línea del cursor** se ve en `--fg`, siempre que el usuario haya «colocado» el cursor y la línea tenga texto. Si no está colocado, no se ve el cursor (ni el de CodeMirror ni el nativo).
  - Cada tab o subtab guarda si su cursor está colocado (va en su `EditorState`).
  - **Se coloca**: con un clic (botón principal) en una línea, aunque esté en blanco; al escribir o borrar (incluido pegar o el IME); con cualquier tecla salvo Shift, Meta, Control, Alt, Bloq Mayús, Escape y las combinaciones con ⌘/Ctrl; y con cualquier movimiento programático del cursor: al abrir el archivo (el cursor va al final), al abrir por primera vez una tab, al elegir un título (§3.20) o al recargar desde el disco.
  - **Se retira**: con un clic en los márgenes o en el relleno. El cursor no se mueve y no empieza una selección. Con ratón, el editor conserva el foco (o lo recibe si no lo tenía); con el dedo o un lápiz no se le da, para no abrir el teclado virtual.
  - Al **activar** el zen durante la sesión, ninguna tab tiene el cursor colocado: todo tenue hasta el siguiente clic o tecla.
  - Las líneas hechas siguen tenues aunque sean la activa. Los enlaces toman el color de su línea. Las palabras mal escritas siguen en `--misspell`. Los títulos conservan su fondo.
- **Barra de tabs transparente** que no recibe el ratón (no se puede cambiar de tab con un clic). Solo se ve el título de la tab o subtab abierta, en `--fg-dim`, sin píldora ni fondo, en el primer hueco (con su ancho máximo y «…»). El separador se oculta. El texto pasa por debajo de la barra y de la marca.
  - Se cambia de tab con ⌘/Ctrl+número (sin salir del zen) o con un dígito con el menú abierto, que **desactiva el zen**. En táctil, la única forma es el dígito, así que no se puede cambiar de tab sin salir del zen.
- **Sustituciones al teclear** (solo en zen y solo al teclear un único carácter; pegar o un IME de varios caracteres no las aplica):
  - `-` justo detrás de otro `-` (y no de `--`) → los dos se convierten en **raya `—`**.
  - `"` → **`«`** al principio del documento o detrás de un espacio en blanco (incluidos salto de línea y tabulador), `(`, `[`, `{`, `—` o `-`; **`»`** en los demás casos.
  - Consecuencia: en zen, teclear `--` produce `—`, así que no se pueden crear tareas hechas ni separadores `---` tecleando. Las líneas `--` ya existentes se siguen viendo tachadas.
- **Contador de palabras** (solo en zen), en la **esquina inferior izquierda**: fijo a 1,1 rem de los bordes inferior e izquierdo (más la zona segura), en una fila de 22 px centrada en vertical con el punto de estado y el menú. Mismo estilo que la marca (0,72 rem, mayúsculas, `letter-spacing: 0.08em`, `--fg-dim`, opacidad 0,85 / 1), con cifras tabulares. Muestra solo el número con el formato `es-ES` (el separador de miles solo aparece desde 10.000: `1234`, `12.345`); `aria-label` «Palabras».
  - Cuenta las palabras (§3.8) de la **tab o subtab abierta** con el mismo criterio que el historial: sin líneas de título ni separadores (`---`, `***`, `___`, `- - -`), y de un enlace `[texto](url)` solo su texto. Las líneas hechas cuentan. Una URL suelta cuenta varias palabras (`https://www.x.com` = 4).
  - Se recalcula como mucho una vez por frame al escribir, y al momento al cambiar de tab o recargar.

### 2.6. Paneles (menú, Títulos, diálogos, diccionario, historial, instrucciones)

- **Velo** (`div.overlay`, `role="dialog"`, `aria-modal="true"`): `--overlay-bg` a pantalla completa, `z-index: 10`, fundido de entrada de 120 ms (no hay fundido de salida). El panel se alinea arriba, a **14 vh** del borde (4 vh los paneles altos; en `dvh` si existe).
- **Un solo panel a la vez**: abrir uno cierra el anterior.
- **Paso de un panel a otro sin parpadeo**: al cerrarse, el velo no se quita al momento; deja de recibir eventos y se retira en el siguiente frame. Si en ese intervalo se abre otro panel (p. ej. «Títulos», «Diccionario» o «Instrucciones» elegidos desde el menú), este ocupa su sitio **sin la entrada animada** (`overlay--instant`: sin fundido del velo ni deslizamiento de la hoja), así que el velo no llega a desaparecer. «Historial» espera a la versión de apertura antes de abrirse; normalmente ya está lista y el paso también es instantáneo.
- **Cierre**: Esc, clic fuera del panel (en el `click`, no en el `pointerdown`, para que el resto del toque no caiga en el editor) o el botón del panel. El foco no sale del panel (Tab y ⇧Tab ciclan dentro). Un clic en el panel no mueve la selección del documento (salvo en campos de texto). Al cerrar, en escritorio el foco vuelve al editor; en táctil, no.
- **Panel**: `min(34rem, 92vw)` de ancho, alto máximo 70 vh (92 vh los altos), fondo `--panel-bg`, borde de 1 px `--panel-border`, **radio de 8 px**, sombra `0 12px 40px rgba(0,0,0,.08)`, 0,9 rem.
- **Filas del menú**: lista con relleno vertical de 0,4 rem; filas de 0,45 rem × 1 rem, etiqueta a la izquierda (una línea, cortada con «…») y metadato a la derecha (0,72 rem, `--fg-dim`, cifras tabulares), alineados por la línea base y separados 1 rem. **Fila activa**: fondo `--sel`. **Fila informativa**: 0,8 rem, `--fg-dim`, puede ocupar varias líneas, no se selecciona ni se resalta. En táctil, filas de 44 px de alto mínimo, centradas en vertical. Lista vacía: «Nada que mostrar» (o el texto propio de cada lista), centrado en `--fg-dim`.
- **Cuerpo** de los paneles: relleno de 1 rem, interlineado 1,55, párrafos separados 0,8 rem. **Barra de acciones**: relleno 0,7 × 1 rem, botones separados 0,6 rem y alineados a la derecha, con borde superior.
- **Botones** (`.btn`): 0,85 rem, relleno 0,4 × 0,9 rem (1,1 rem en táctil), radio de 5 px, borde `--panel-border`; con el ratón encima, fondo `--sel` (transición `--ease`). **Principal**: borde `--fg`. **Discreto**: sin borde y texto `--fg-dim`. En táctil, alto mínimo de 44 px. En los diálogos, el botón principal recibe el foco.
- **Cabecera** de los paneles altos: franja de 0,72 rem en `--fg-dim`, relleno 0,6 × 1 rem, con un borde inferior.
- **Móvil (≤ 700 px)**: los paneles son **hojas inferiores** a todo el ancho, pegadas abajo, con radio de **14 px arriba**, sin borde inferior, relleno para la zona segura, alto máximo de 85 dvh, 17 px y una entrada deslizando 12 px en 160 ms.

### 2.7. Avisos

- Una línea centrada abajo (a 1,4 rem del borde; 3,4 rem en ≤ 700 px, para no tapar los controles), texto centrado. Fondo `--panel-bg`, borde `--panel-border`, radio de 6 px, relleno de 0,4 × 0,8 rem, 0,78 rem, `--fg-dim`, ancho máximo de 90 vw (un texto largo pasa a varias líneas), sombra suave `0 4px 16px rgba(0,0,0,.06)`.
- Van **por encima del velo y de los paneles** (`z-index: 11`): un aviso con un panel abierto (p. ej. «Versión guardada.» en el historial) se lee igual. **Nunca reciben el ratón** (`pointer-events: none`): no tapan los botones que haya debajo.
- Aparece y desaparece con un fundido de 200 ms. Dura **3,5 s** por defecto (6 s u 8 s en algunos casos, §4). Un aviso nuevo sustituye el texto del anterior y reinicia su tiempo. `role="status"`, `aria-live="polite"`.

### 2.8. Pantalla de inicio

- Columna centrada vertical y horizontalmente, con 2,5 rem entre bloques y un relleno de 2 rem (más las zonas seguras). La marca «FOLIO» sigue arriba a la derecha (salvo en ≤ 700 px).
- Acciones apiladas, separadas 0,9 rem: **`OPEN`**, **`NEW`** y, solo con File System Access y si hay un archivo anterior recordado, **`CONTINUE «nombre»`** (sin la extensión `.txt`/`.md`/`.markdown`; más pequeña, 0,75 rem y `--fg-dim`).
  - Estilo: 0,85 rem, mayúsculas, `letter-spacing: 0.05em`, color `--fg`, sin borde, relleno 0,25 × 0,5 rem (1 rem lateral en táctil), radio de 4 px. Con el ratón encima (`hover: hover`), opacidad 0,7. En táctil, alto mínimo de 44 px.
- Si el navegador no permite escribir en archivos (modo degradado: no hay `showOpenFilePicker` o `showSaveFilePicker`), aparece debajo una nota de 0,8 rem en `--fg-dim`, interlineado 1,5, centrada y con un ancho máximo de 28 rem:
  - Escritorio: «Tu navegador no permite guardar directamente en el archivo. folio guardará un borrador local y podrás descargar el .txt cuando quieras. Para la experiencia completa, usa Chrome o Edge.»
  - Táctil: «En el móvil los cambios se guardan como borrador en este navegador; puedes descargar el .txt desde el menú cuando quieras.»
- Mientras se ve la pantalla de inicio se precarga en segundo plano el código del editor.
- La pantalla «Este archivo se está editando en otra pestaña.» (§3.12) usa el mismo estilo de nota, sin botones.

### 2.9. Móvil y táctil

Se detecta **pantalla estrecha** con `max-width: 700px` y **táctil** con `pointer: coarse` (CSS con `@media (pointer: coarse)`; en JS, `matchMedia` leído una vez). El hover solo se aplica con `hover: hover`. (`html[data-touch]` se pone pero ningún estilo lo usa.)

- **Barra de tabs**: 52 px más la zona segura superior; relleno `8px + zona segura` arriba, `1rem + zona segura` a los lados y 8 px abajo. Tabs de tamaño natural (máximo 42 vw), 36 px de alto mínimo (interlineado 34 px); relleno de 10 px y separación de 14 px. Imán de scroll al centro de cada tab. El gesto horizontal es de la barra (`touch-action: pan-x`) y el vertical, del editor.
- La **marca se oculta**. El **contador de tareas hechas** baja a la **esquina inferior izquierda** (oculto si está vacío), simétrico al grupo de estado y menú; en zen va delante del contador de palabras, separado 0,8 rem.
- Paneles como hojas inferiores (§2.6). Avisos más arriba (§2.7).
- Texto del editor de al menos 16 px (evita el zoom de iOS al enfocar).
- **Teclado virtual**: folio no lo abre por su cuenta.
  - Al abrir un archivo no se enfoca el editor.
  - Pulsar una tab, o crear o quitar una desde el menú, mantiene el teclado como estaba: si estaba cerrado, sigue cerrado.
  - Al cerrar un panel no se vuelve a enfocar el editor.
  - En zen, un toque en los márgenes o en el relleno retira el cursor pero no enfoca el editor (§2.5).
  - `interactive-widget=resizes-content`: el teclado encoge la ventana en vez de tapar el editor (Chrome Android). Se usan unidades `dvh`.
- En el menú no se muestran atajos y la primera fila indica el estado del guardado (§3.10), salvo en `idle`. El botón de menú no menciona atajo e Instrucciones no muestra la sección de atajos.
- **Enlaces**: un toque sobre un enlace (URL suelta o `[texto](url)`) lo abre en una pestaña nueva si el editor no tenía el foco (se estaba leyendo); si el dedo se mueve más de 8 px es scroll. Si se estaba escribiendo, el toque coloca el cursor. Se detecta con eventos táctiles, así que también funciona en portátiles táctiles.
- Zonas seguras (`env(safe-area-inset-*)`) en los elementos fijos (salvo la barra de tabs de escritorio). `viewport-fit=cover`.
- Los botones no tienen el resaltado gris al tocar ni retraso por doble toque (`touch-action: manipulation`). Las filas del menú no llevan esa regla.
- Píldoras del diccionario de 36 px de alto con una «×» siempre visible.

### 2.10. Icono

Tres viñetas grises (`#9E9E9E`) en un cuadrado claro, como una lista: círculos de radio 3 en x = 22 (y = 20, 32, 44) y barras de 16 × 3 (radio 1,5) en x = 30 (y = 18,5, 30,5, 42,5), sobre una cuadrícula de 64.

- `icon.svg` (favicon y en el manifiesto con `sizes: any`): cuadrado redondeado (radio 12/64) de fondo **blanco** `#FFFFFF`.
- PNG de 192 y 512 px, versión enmascarable de 512 px (dibujo en el 80 % central) y `apple-touch-icon` de 180 px: generados con `npm run icons` a partir del SVG, **cuadrados sin redondear** (las esquinas las pone el sistema) y opacos con fondo `#F5F4F0`.

---

## 3. Funcionalidad

### 3.1. Abrir un archivo

| Acción | Comportamiento |
|---|---|
| **OPEN** | Selector del sistema filtrado a `.txt`, `.md` y `.markdown` (los `.md` son de versiones anteriores y tienen el mismo formato); con File System Access se puede cambiar a «Todos los archivos». Un selector cancelado no hace nada. |
| **NEW** | Diálogo «Guardar como» con el nombre `folio.txt` (solo `.txt`). Crea el archivo **vacío** (si se elige uno existente, el sistema pide confirmar y se vacía) y lo abre. En modo degradado no hay diálogo: se trabaja con un `folio.txt` en memoria. |
| **CONTINUE «nombre»** | Solo con File System Access. Reabre el último archivo con el que se trabajó y pide permiso de escritura si hace falta. Si se deniega: «Sin permiso para abrir el archivo.». Si falla cualquier otra cosa (el archivo ya no existe…), se olvida y se avisa: «El archivo ya no está disponible.». |
| **Desde el sistema** | Con la PWA instalada, folio se ofrece para abrir `.txt`, `.md` y `.markdown` (solo se usa el primer archivo). Si ya hay un archivo abierto, se guarda y se cierra antes; en ese momento se aplica una actualización pendiente de la app, si la hay. |

Con OPEN y al abrir desde el sistema no se pide permiso de escritura explícito: el navegador lo pide en la primera escritura.

Al abrir se hace, en este orden:

1. Leer el archivo y normalizarlo: quitar la BOM y convertir `\r\n` y `\r` a `\n`. Se calcula el SHA-256 de lo leído.
2. Identificar el archivo (§3.13) y pedir almacenamiento persistente al navegador.
3. **Bloqueo entre pestañas** (§3.12).
4. **Versión de apertura** en el historial, si toca (§3.11), sin esperar a que termine; y arranca el temporizador horario. No en modo degradado.
5. **Recuperar el borrador** (§3.6): si hay un borrador vivo que parte de esta misma versión del disco (mismo SHA-256; no se mira la fecha del archivo, que los sincronizadores retocan) y tiene otro contenido, se pregunta **«Hay cambios sin guardar de ‹hace X›. ¿Quieres recuperarlos?»** con **[Descartar]** y **[Recuperar]** (principal). Esc o un clic fuera equivalen a «Descartar». Si se recupera, el borrador sustituye al contenido, sigue protegido por un borrador nuevo y se escribe en el archivo con el guardado automático (3 s después; en modo degradado, no se escribe: sigue en el borrador). Si se descarta, se borra para que no vuelva a preguntar.
6. Mostrar el editor con la **primera tab** (nunca una subtab) y el cursor al final. En escritorio el editor recibe el foco; en táctil, no.

Si algo falla al elegir o crear el archivo: «Algo ha fallado al acceder al archivo.» y se sigue en la pantalla de inicio. Si falla al abrirlo: «No se pudo abrir el archivo.» y se vuelve a la pantalla de inicio.

El archivo **no se reescribe al abrirlo, ni después mientras no se cambie nada**: aunque no esté en el formato canónico de folio (§3.2) —p. ej. un texto plano sin marcadores, con saltos `\r\n` o con el diccionario desordenado—, ⌘S, pasar a segundo plano o cerrar no lo tocan. Con el primer cambio real se escribe entero, ya en formato canónico.

### 3.2. Formato del archivo

Texto plano UTF-8 con saltos `\n`. Estructura:

```text
[todo:tab 1]
Contenido de la primera tab.
[todo:tab 1.1]
Contenido de la primera subtab de la tab 1.
[todo:tab 1.2]
[todo:tab 2]
[todo:tab 3]
Contenido de la tercera tab.

<!-- todo:diccionario
Palabras que el corrector ortográfico de folio acepta, una por línea.
Este bloque lo mantiene folio; no forma parte del texto.

Aldebarán
Kaelith
-->
```

Reglas al escribir:

- Marcador de tab: `[todo:tab N]` en una línea propia, con N entre 1 y 10. Marcador de subtab: `[todo:tab N.M]`, con M entre 1 y 10, justo después del contenido de su tab (y de las subtabs anteriores).
- Una tab o subtab **vacía** (solo espacios o saltos) se escribe solo con su marcador, para que exista al reabrir; ese contenido en blanco se pierde.
- Un documento con **una sola tab vacía y sin subtabs** se escribe como un **archivo vacío** (o solo con el bloque del diccionario, si tiene palabras).
- Se quitan los saltos de línea finales de cada tab (los espacios finales se conservan). Sin diccionario, el archivo **no termina en salto de línea**.
- **Escape**: una línea de contenido que se leería como estructura (`[todo:tab N]`, `[todo:tab N.M]` o `<!-- todo:diccionario`) se escribe con una `\` delante; las que ya empiezan por barras invertidas ganan una más. Al leer se quita una.
- **Bloque del diccionario**: comentario HTML **al final** del archivo, separado del texto por una línea en blanco: marcador, dos líneas de descripción, una línea vacía y una palabra por línea, ordenadas con el orden alfabético español y sin repetir; termina en `-->\n`. Si no hay palabras, no se escribe. `-->` dentro del bloque se escribe como `--\>`.

Reglas al leer:

- Si el archivo **no empieza por un marcador** (texto plano cualquiera), todo va a la tab 1.
- Exactamente un `\n` tras un marcador y uno antes del siguiente no son contenido; las líneas en blanco iniciales sí.
- El número de tabs lo marca el **marcador más alto** (mínimo 1, máximo 10). Los huecos se leen como tabs o subtabs vacías, así nada cambia de sitio. Se aceptan ceros a la izquierda (`[todo:tab 01]` es la tab 1).
- Los marcadores repetidos se unen sin separador (`[todo:tab 1]\na\n[todo:tab 1]\nb` → `ab`).
- Una línea con un número **fuera de rango** (`[todo:tab 0]`, `[todo:tab 11]`, `[todo:tab 1.11]`…) **no es un marcador**: es texto de la tab o subtab en la que aparece, sin crear tabs ni perder nada. Al escribir se escapa como cualquier línea que parezca estructura. Si el archivo empieza por una de ellas, no empieza por un marcador: todo va a la tab 1.
- El bloque del diccionario solo se reconoce si está al final (tras `-->` como mucho un `\n`). Las palabras son las líneas sin espacios que siguen a la primera línea en blanco del bloque. Si no está al final o está mal cerrado, es texto normal de la tab en la que cae (y si está al principio del archivo, todo el archivo pasa a ser texto de la tab 1).
- Abrir y guardar un archivo que ya tiene este formato no lo cambia.
- Los prefijos `todo:` vienen del nombre anterior de la app y se mantienen por compatibilidad.

### 3.3. Tabs y subtabs

| Aspecto | Tabs | Subtabs |
|---|---|---|
| Cantidad | De 1 a **10**. Un archivo nuevo tiene 1. | De 0 a **10** por tab. Un solo nivel. |
| Nombre | La **primera palabra** del contenido (`[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*`); si pasa de 16 caracteres, los 15 primeros y «…». Sin palabras: su **número** (`1`…`10`). | Igual, con su número dentro de la tab (`1`…`10`). |
| `title` del botón | «Tab N: ‹nombre›», o «Tab N» si está vacía | «Subpestaña M de la tab N[: ‹nombre›]» |
| Dónde | En la barra, en orden | Detrás de todas las principales y del separador. Solo las de la tab abierta. |
| Abrir | Clic, **⌘/Ctrl+1…9, 0** (0 = la 10), o un dígito con el menú abierto | Clic o **⌘⌥/Ctrl+Alt+1…9, 0** |
| Crear | Menú «Más…» › **«Crear pestaña»**: solo desde una tab principal y con menos de 10. Se añade al final y se abre. | Menú «Más…» › **«Crear subpestaña»**: solo desde una tab principal que tenga menos de 10. Se añade al final y se abre. |
| Eliminar | Menú «Más…» › **«Eliminar pestaña N»** (la abierta): solo si está vacía (o en blanco), sus subtabs están todas vacías y no es la única. Se quitan con ella sus subtabs. Se abre la que ocupa su sitio (o la última). | Menú «Más…» › **«Eliminar subpestaña M»**: solo si está vacía (o en blanco). Se abre la que ocupa su sitio (o la última); la tab madre si no quedan. |

- **Nunca se borra texto**: no hay forma de eliminar una tab o subtab con contenido.
- Solo hay **una activa**, la que se edita. Con una subtab abierta, la madre no se marca como activa, pero lleva el fondo de las subtabs.
- **Cada tab y subtab tiene su propio estado de editor**: historial de deshacer, cursor y selección. Cambiar de tab no es una edición, así que ⌘Z nunca trae el texto de otra tab.
- Al cambiar de tab: el editor carga su estado; la **primera vez** que se abre una tab en la sesión el cursor va **al final**, y las siguientes vuelve donde estaba. El título de la barra se actualiza y la activa se centra si la barra se desplaza. El foco se mantiene según §2.9.
- Pulsar la tab que ya está abierta solo devuelve el foco.
- Los atajos a una tab o subtab que no existe no hacen nada. ⌘/Ctrl+número abre siempre la **tab principal** (aunque haya una subtab abierta); ⌘⌥/Ctrl+Alt+número, la subtab de la tab abierta.
- Mientras se escribe, el título de la tab activa se recalcula en cada pulsación a partir de su **primera línea no vacía** (al cambiar de tab se recalcula con todo el texto; solo difieren si la primera línea no tiene palabras).
- La tab activa **no se recuerda** entre sesiones.

### 3.4. Guardado automático

Cada edición (y crear o quitar tabs, o cambiar el diccionario personal) marca el documento como cambiado: programa el borrador vivo (§3.6) y el guardado automático.

| Disparador | Acción |
|---|---|
| **3 s sin cambios** (cada cambio reinicia la cuenta) | Guardar |
| **30 s** desde el primer cambio sin guardar (temporizador de un solo disparo que se rearma con el siguiente cambio) | Guardar, aunque se siga escribiendo |
| La pestaña pasa a segundo plano (`visibilitychange → hidden`) o `pagehide` | Guardar (lo que dé tiempo) y volcar el borrador |
| `beforeunload` con cambios pendientes | Guardar y pedir confirmación al salir (diálogo nativo). En modo degradado solo vuelca el borrador, sin confirmación |
| **⌘/Ctrl+S** | Guardar ya. En modo degradado, descargar el `.txt` («Descargado.»). Se evita el «Guardar página» del navegador |
| Cerrar el archivo (abrir otro desde el sistema) o ceder el bloqueo a otra pestaña | Guardar |

Cómo se escribe:

- **Solo hay una escritura a la vez.** Si hay cambios mientras se escribe, al terminar se programa otro guardado (con su espera de 3 s).
- **Si el texto no ha cambiado** (comparación del texto completo serializado con lo último leído o escrito, o con su forma canónica), no se escribe (salvo en estado de error).
- Lo que se escribe es el archivo entero: todas las tabs y subtabs más el diccionario personal (§3.2).
- **Justo antes de escribir** se consulta la fecha de modificación del archivo (sin leerlo). Si es **posterior** a la de la versión cargada:
  - se lee el archivo; si su contenido es **el mismo** que lo último guardado (un sincronizador que solo retoca la fecha), se acepta la nueva fecha en silencio y **se escribe**;
  - si es **distinto** (o no se puede leer), no se escribe: **el disco sustituye a lo local** (§3.5), con su aviso. Si al releerlo para sustituir resulta que no ha cambiado (caso raro), los cambios locales siguen pendientes y se vuelve a intentar tras la espera de 3 s.
- Cada escritura: consulta de la fecha, `createWritable` + `write` + `close` (escritura atómica del navegador) y consulta de la nueva fecha.
- **Errores**:

| Causa | Estado | Aviso | Recuperación |
|---|---|---|---|
| Permiso revocado (`NotAllowedError` / `SecurityError`) | `error` | «folio perdió el permiso de escritura. Pulsa el punto de estado para recuperarlo.» (6 s) | Al pulsar el punto (o «Reintentar guardado») se pide el permiso y se reintenta. Si se deniega: «Sin permiso de escritura. Puedes guardar en otro archivo desde el menú.»; el menú ofrece **«Guardar en otro archivo…»** |
| Archivo borrado o movido (`NotFoundError`) | `error` | «El archivo ya no está donde estaba. Pulsa el punto de estado para guardarlo en otro sitio.» (6 s) | Al pulsar el punto (o con «Guardar en otro archivo…») se abre el diálogo de guardar |
| No soportado (`NotSupportedError`) | `error` | — | Sin reintento automático |
| Cualquier otro | `error` | — | Reintento automático a los 2, 4, 8, 16, 32 y 60 s (y cada 60 s), siempre con el texto más reciente |

  - El aviso solo aparece al entrar en error o al cambiar de tipo de error.
  - En error, las ediciones no provocan escrituras (solo se anotan); ⌘S, pasar a segundo plano o «Reintentar guardado» sí lo intentan.
  - Tras cualquier error, el menú ofrece **«Reintentar guardado»** y **«Guardar en otro archivo…»**.
- **Guardar en otro archivo**: diálogo del sistema con el nombre actual; se escribe el documento entero en el archivo elegido, aviso «Guardado en ‹nombre›», y ese archivo **pasa a ser el abierto** en una sesión nueva (con su propia identidad, bloqueo, historial y borrador; el anterior no se vuelve a tocar). Si falla: «No se pudo guardar el archivo.». Cancelar el diálogo no hace nada.
- **Regla**: con la pestaña abierta, el texto no se pierde: entre guardados, y mientras un guardado falla, siempre queda el borrador vivo (§3.6).

### 3.5. Cambios hechos desde otro dispositivo

Pensado para archivos en iCloud Drive, Google Drive u otras carpetas sincronizadas.

- Cada **10 s**, al **volver a la pestaña** y al **recuperar el foco** la ventana, se compara la **fecha de modificación** del archivo con la conocida (la de la versión cargada o la de la última escritura propia). Para eso no se lee el contenido. Con la pestaña oculta el sondeo se detiene. Solo hay una comprobación a la vez.
- Si la del disco es **posterior**, se lee el archivo:
  - Si mientras se leía hubo una escritura propia (en curso o terminada), se desiste hasta el siguiente ciclo.
  - Si el contenido es **el mismo** que lo último guardado, solo se actualiza la fecha conocida: sin recargar, sin aviso, y los cambios locales pendientes se conservan y se escribirán.
  - Si es **distinto**, se vuelca en el editor. Aviso: **«El archivo cambió en otro dispositivo: se ha cargado la versión más reciente.»** (3,5 s).
- Al volcar se conservan la tab activa (o la última que exista, si ahora hay menos; una subtab que ya no existe pasa a la última de su tab o a la tab) y la posición del cursor principal (recortada a la nueva longitud). Se reinician el historial de deshacer y el cursor de todas las tabs. Se recarga el diccionario personal y se revisa de nuevo la ortografía.
- **El disco manda** si su contenido es distinto, aunque haya cambios locales sin guardar (se pierden como mucho unos segundos). No hay diálogo de conflicto. La excepción es que se esté escribiendo en ese momento: entonces se espera al siguiente ciclo.
- Si la comprobación falla (por ejemplo, iCloud aún no tiene el archivo), se ignora y se reintenta.
- En modo degradado no hay comprobación.

### 3.6. Borrador vivo

- Copia del **documento entero** (tabs, subtabs y diccionario, tal y como se escribiría) en IndexedDB (`to-do` › `drafts`), con la clave del archivo físico (§3.13), la hora y el **SHA-256 de la versión del disco de la que parte**: la última leída o escrita (en modo degradado, siempre la abierta). Texto y base se toman en el mismo instante.
- Se escribe **300 ms** después del último cambio (cada cambio reinicia la espera) y al pasar a segundo plano, `pagehide`, `beforeunload` y al cerrar. Si IndexedDB falla, se ignora.
- Se borra cuando el estado del guardado pasa a `saved` **sin cambios pendientes** (al abrir, tras escribir el archivo, tras recargar desde el disco y tras guardar en otro archivo): si hubo cambios mientras se escribía, se conserva hasta el siguiente guardado. También se borra al elegir «Descartar». En modo degradado no se borra nunca.
- Al abrir, sirve para ofrecer la recuperación (§3.1): se busca por la clave del archivo y, si no hay, por el id de historial (borradores de versiones anteriores, sin hash de base: se ofrecen si son posteriores a la fecha del archivo). Al recuperarlo, el borrador nuevo queda bajo la clave del archivo y el antiguo se borra.
- Los borradores escritos por una versión anterior con un fallo (guardaban el hash en lugar del texto: 64 caracteres hexadecimales sin hash de base) se descartan y se borran al abrir.
- En modo degradado es el único guardado automático real.

### 3.7. Convenciones del texto

- **Títulos** (`#…`), **tareas hechas** (`--…`) y **enlaces**: ver §2.4.
- **Contador de tareas hechas**: número de líneas `--` de la tab o subtab abierta (§2.3).
- **Enlaces**: **⌘/Ctrl+clic** (en Mac también Ctrl) abre la URL (o el destino de un enlace `[texto](url)`) en una pestaña nueva (`noopener noreferrer`). Las que empiezan por `www.` se abren con `https://` delante. Un clic simple solo coloca el cursor. En táctil, ver §2.9.
- **Pegar una URL sobre una selección** la convierte en enlace: `palabra` → `[palabra](url)`, en una sola transacción (⌘Z la deshace). El portapapeles debe ser solo una URL (`http(s)://…`, `www.…` o `mailto:…`, con espacios en los bordes); los paréntesis de la URL se codifican (`%28`, `%29`). Los espacios de los bordes de la selección quedan fuera del enlace y el cursor queda detrás, con el enlace plegado. Con varias selecciones se enlaza cada una. Pegado normal si alguna selección está vacía, ocupa varias líneas, tiene corchetes, es solo espacio o pisa un enlace a medias. Si la selección cae dentro del texto de un enlace, se le **cambia la URL** (es la forma de editar el destino, que no se ve) y el cursor queda detrás del enlace; esta edición no pasa por la protección de la sintaxis, porque ya la escribe completa.
- **Copiar o cortar con enlaces** deja en el portapapeles dos versiones: **texto plano** con la sintaxis (`Mira [esta web](url) hoy`, para que al pegar en folio el enlace se conserve) y **HTML** con cada enlace como `<a href>` (`Mira <a href="url">esta web</a> hoy`), que es la que usan Teams, Outlook, Word, Gmail o Slack para pegarlo clicable. El HTML no lleva estilos (toma los del destino); los saltos de línea van como `<br>`, un tabulador como cuatro `&nbsp;` y los espacios seguidos se conservan. Las URLs sueltas también van como enlace (`www.` con `https://` en el `href`). Un enlace copiado a medias va como enlace con ese trozo de texto, también en texto plano (`[esta](url)`). Si lo copiado no tiene enlaces, el portapapeles queda como siempre (solo texto plano). Lo demás es lo de CodeMirror: sin selección se copia la línea entera, al cortar se borra (⌘Z lo devuelve) y varias selecciones se unen con saltos de línea.
- **La sintaxis oculta de un enlace está protegida**: el texto del enlace se edita como una palabra más y el enlace nunca queda roto (con la sintaxis a medias, que se vería en crudo).
  - **Cursor**: no puede quedarse dentro de `[` ni de `](url)`. A los lados del enlace queda siempre fuera (antes del `[` o después del `)`), así que cada pulsación de flecha avanza una letra visible, y escribir en esos bordes escribe fuera del enlace (como en Google Docs). Un clic en un borde deja el cursor fuera.
  - **Retroceso** justo detrás del enlace quita la última letra de su texto (no el `)` oculto), y con el cursor justo delante, la letra anterior al enlace. **Suprimir**, al revés. **⌥⌫ / Ctrl+⌫** (y hacia delante con Supr), con un único cursor justo en el borde, borran la última o la primera palabra del texto del enlace.
  - Si se borra todo el texto del enlace (letra a letra, por palabras o seleccionándolo), se borra el enlace entero.
  - Una selección que pisa el enlace a medias borra (o sustituye) lo que se ve y conserva la sintaxis: lo que quede del texto sigue siendo enlace.
  - La protección se aplica a las escrituras y borrados del usuario (incluidos pegar y soltar). Deshacer, rehacer y la recarga desde el disco no pasan por ella.
- La tecla **Tab** inserta un tabulador (con texto seleccionado, sangra las líneas). Deshacer y rehacer funcionan con los atajos estándar de CodeMirror (⌘Z / ⌘⇧Z o Ctrl+Z / Ctrl+Y / Ctrl+⇧Z).

### 3.8. Corrector ortográfico

- **Activado por defecto.** Se activa o desactiva desde el menú (en **«Más…»**, §3.10) y se recuerda.
- Solo **español**: `nspell` (Hunspell) con los archivos de `dictionary-es` (copiados a `public/dict/` antes de cada `dev` y `build`), en un **Web Worker** que se crea por sesión.
  - El diccionario se carga al abrir un archivo con el corrector activado (cuando el navegador está libre, como mucho 2 s después) o al activarlo. Queda en la caché `todo-dictionaries` del Service Worker; su URL lleva la versión de la app, así que se vuelve a descargar tras cada despliegue.
  - Si falla: «No se pudo cargar el diccionario ortográfico.». Volver a activar el corrector lo reintenta.
- **Solo marca**, nunca sugiere: las palabras desconocidas se ven en rojo apagado (§2.4).
- Se revisa la parte visible de la tab abierta con un margen de ±2.000 caracteres, 400 ms después del último cambio, movimiento del cursor o scroll; al momento cuando el diccionario termina de cargar y al añadir o quitar palabras del diccionario personal.
- **Palabra** (también para el contador de palabras y el nombre de las tabs): `WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu`: letras, marcas diacríticas y dígitos, con apóstrofo (`'` o `’`) o guion internos.
- **No se marcan**:
  - la palabra en la que está el cursor (sin selección), mientras siga ahí;
  - palabras de una letra;
  - palabras con dígitos (`abc123` entera);
  - fragmentos de URL (también la URL de un enlace `[texto](url)`; su texto sí se revisa);
  - palabras del diccionario personal.
- Al desactivarlo desaparecen las marcas y no se activa el corrector nativo.

### 3.9. Diccionario personal

- Conjunto de palabras aceptadas que **distingue mayúsculas**. Se guarda **dentro del propio archivo** (§3.2) y viaja con él. Añadir o quitar una palabra cuenta como cambio del documento.
- **Añadir**: desde el menú con **«Añadir «palabra» al diccionario»** (solo con el corrector activado y el cursor sobre una palabra o tocando uno de sus bordes; vale cualquier palabra, aunque no esté marcada o ya esté en el diccionario). No tiene atajo. Aviso: «‹«palabra»› añadida al diccionario.» (la palabra va entre comillas « »), también si ya estaba. No se aceptan palabras con espacios.
- **Gestionar**: menú «Más…» › **«Diccionario»** (solo con el corrector activado). Panel alto con la cabecera «Diccionario personal · pulsa una palabra para quitarla» y las palabras en **píldoras** por orden alfabético español (`title` «Quitar del diccionario»). Pulsar una la quita; con el ratón encima se ve tachada en `--err`, y en táctil llevan una «×». Vacío: «El diccionario personal está vacío.». Botón **[Cerrar]**.

### 3.10. Menú

- Se abre con **⌘/Ctrl+K**, con el botón de menú o pulsando el punto de estado cuando no hay error ni modo degradado. **⌘/Ctrl+K** con un panel abierto lo cierra.
- Es una lista sin buscador. **↑/↓** mueven la selección (saltando las filas informativas), **Enter** ejecuta, **Esc** o un clic fuera cierran. Con ratón, pasar por encima selecciona la fila (con el dedo, no). Al abrirse, la primera fila seleccionable está activa.
- **Un dígito** (tecla `1`…`9`, `0`, por el carácter, no por la tecla física) con el menú abierto cierra el menú y abre esa tab principal, si existe. En modo zen, además, **desactiva el zen**.
- Al cerrar, en escritorio el foco vuelve al texto.
- **Filas que se ven al abrirlo**, en este orden (cada una solo si se cumple su condición):

| Entrada | Condición | Efecto |
|---|---|---|
| ‹Estado del guardado› (informativa) | Solo en táctil y si hay texto de estado (no en `idle`) | «Guardado hace…», «Cambios sin guardar»… |
| **Modo zen** / **Desactivar modo zen** | Siempre | Activa o desactiva el zen (§2.5) |
| **Tema oscuro** / **Tema claro** | Siempre | Cambia al otro tema y lo fija (deja de seguir al sistema; no hay forma de volver a `system` desde la interfaz) |
| **Pantalla completa** / **Salir de pantalla completa** | El navegador tiene la API (no en iPhone) | Si falla: «El navegador no permite la pantalla completa aquí.» |
| **Desencriptar pestaña** | La tab abierta contiene algún bloque cifrado | §3.22 |
| **Encriptar pestaña** | La tab abierta tiene al menos un bloque pendiente con sintaxis válida | §3.22 |
| **Añadir «palabra» al diccionario** | Corrector activado y cursor sobre una palabra | §3.9 |
| **Descargar el .txt** | Modo degradado | Descarga el documento entero con el nombre del archivo abierto (con su extensión), sin aviso |
| **Reintentar guardado** | Tras un error de guardado | §3.4 |
| **Guardar en otro archivo…** | Tras un error de guardado (no en modo degradado) | §3.4 |
| **Más…** | Siempre (hay secundarias que siempre están disponibles) | Despliega las secundarias |

- **«Más…»** no cierra el menú: su fila se sustituye por las **secundarias**, en este orden, y la primera queda activa:

| Entrada | Condición | Efecto |
|---|---|---|
| **Títulos** | Siempre | §3.20 |
| **Desactivar corrector** / **Activar corrector** | Siempre | §3.8 |
| **Diccionario** | Corrector activado | §3.9 |
| **Crear pestaña** | En una tab principal y con < 10 tabs | §3.3 |
| **Crear subpestaña** | En una tab principal con < 10 subtabs | §3.3 |
| **Eliminar pestaña N** / **Eliminar subpestaña M** | La abierta se puede eliminar | §3.3 |
| **Exportar pestaña** / **Exportar subpestaña** | La abierta tiene texto | §3.21 |
| **Historial** | No en modo degradado | §3.11 |
| **Instrucciones** | Siempre | §3.19 |

- En escritorio, a la derecha de cada entrada se mostraría su atajo; hoy ninguna entrada del menú lo tiene (los únicos atajos son los de §3.16).
- Hay un comando oculto: «Guardar ahora» (solo con ⌘S).

### 3.11. Historial de versiones

- Cada versión es una **copia del archivo completo** (tabs, subtabs y diccionario) en el almacenamiento del navegador (IndexedDB `to-do` › `backups`), ligada al id de historial del archivo (§3.13).
- **Cuándo se guarda**:
  - **Al abrir**, si hace más de una hora de la última versión o no hay ninguna. Se guarda lo que había en el disco, antes de recuperar ningún borrador.
  - **Cada hora** mientras el archivo está abierto (temporizador horario), si ha pasado al menos una hora desde la versión más reciente (p. ej., tras guardar una a mano a las 0:30, la siguiente automática llega hacia las 2:00).
  - **Al pulsar «Guardar versión»**, en ese momento.
- **Sin duplicados**: no se guarda una versión idéntica (mismo SHA-256) a la **más reciente**. «Guardar versión» sin cambios avisa: **«Sin cambios desde la última versión.»**.
- Se conservan las **50 más recientes**.
- **Panel** (alto):
  - Cabecera «Historial · N versiones» («1 versión»); «Historial» mientras carga o si falla.
  - Una fila por versión, de la más reciente a la más antigua: fecha y hora con segundos (p. ej. «7 sept 2026, 13:42:05»), «N palabras» (sin singular: «1 palabras») y el botón **[Descargar]**. Los textos de las versiones no se cargan hasta descargarlas.
  - Palabras: las de todas las tabs y subtabs, con el criterio de §2.5 (sin títulos ni separadores; de los enlaces, solo su texto).
  - Sin versiones: «Todavía no hay versiones de este archivo.». Si falla la lectura: «No se pudo leer el historial.».
  - Pie: **[Cerrar]** y **[Guardar versión]** (principal, con `title`, desactivado mientras guarda). Tras guardar: «Versión guardada.» y la lista se actualiza. Si falla: «No se pudo guardar la versión.».
- **Descargar** ofrece guardar (diálogo del sistema, tipo «Texto») como `‹nombre sin extensión› — AAAA-MM-DD HH.mm.txt`. Aviso: «Versión guardada en ‹nombre›». Si la versión ya no existe: «La versión ya no está disponible.»; si falla: «No se pudo descargar la versión.».
- **No existe «restaurar», a propósito**: una versión nunca vuelve al editor ni al archivo. Para recuperar algo, se descarga y se abre.
- En modo degradado no hay historial.

### 3.12. Varias pestañas del navegador con el mismo archivo

- Solo una pestaña puede editar un archivo físico a la vez (Web Locks `to-do:‹clave del archivo›` + BroadcastChannel `to-do`). Sin Web Locks no hay bloqueo.
- Si ya está abierto en otra: **«Este archivo ya está abierto en otra pestaña.»** con **[Volver]** y **[Editar aquí]** (principal). Esc o un clic fuera equivalen a «Volver».
  - **Editar aquí**: se pide a la otra pestaña que guarde y ceda.
    - Si cede, esa pestaña muestra «Este archivo se está editando en otra pestaña.» (sin botones; hay que recargar para volver a usarla) y esta toma el bloqueo (hasta 10 intentos cada 50 ms) y abre el archivo. Una pestaña en modo degradado siempre cede.
    - Si tiene cambios que no puede guardar, se niega: «La otra pestaña tiene cambios que aún no ha podido guardar. Resuélvelo allí antes de abrir el archivo aquí.» (8 s), y se vuelve al inicio.
    - Si no responde en **3 s** (congelada o descartada; o no hay BroadcastChannel), se abre igualmente: «La otra pestaña no responde. Se abre aquí; si allí sigue abierto, prevalecerá lo último que se guarde.» (8 s).
  - **Volver**: pantalla de inicio.

### 3.13. Identidad del archivo

Hay dos identidades (`src/persistence/files.ts`):

- **Id de historial** (`historyId`): el registro de un archivo ya visto si es el mismo archivo físico (`isSameEntry` con alguno de sus handles recordados, hasta 20 por nombre); si no, el del **nombre**. Dos archivos con el mismo nombre comparten **historial** (así sobrevive a copias y renombrados de la sincronización). Si un handle conocido aparece con otro nombre, se actualiza el nombre del registro.
- **Clave del archivo** (`fileKey`): por archivo **físico**. El primero con un nombre usa el id de historial; otro archivo físico con el mismo nombre recibe una clave nueva. La usan el **bloqueo** y el **borrador**.
- En modo degradado ambas son `file:‹nombre›:‹tamaño›`.
- Se recuerda el último archivo con handle para ofrecer **CONTINUE** (si el handle no se puede guardar, no hay CONTINUE).
- «Guardar en otro archivo…» (§3.4) abre el archivo nuevo en una sesión nueva, con su propia identidad.

### 3.14. Modo degradado (sin File System Access: Firefox, Safari, móvil)

- Abrir con el selector de archivos del navegador (`.txt`, `.md`, `.markdown`). No se puede escribir en el archivo.
- El punto de estado queda en `degraded` (visible). Pulsarlo **descarga el `.txt`**. ⌘S también descarga («Descargado.»). En el menú aparece «Descargar el .txt». Las descargas usan el nombre del archivo abierto.
- El borrador vivo es el guardado automático. No hay historial, ni comprobación de cambios externos, ni `title` en la marca.

### 3.15. Preferencias

Se guardan en `localStorage` y se aplican antes del primer pintado (tema y zen):

| Clave | Valores | Por defecto |
|---|---|---|
| `todo.theme` | `light` \| `dark` \| `system` | `system` (sigue al sistema en vivo) |
| `todo.spell.enabled` | `true` \| `false` | `true` |
| `todo.zen` | `true` \| `false` | `false` |

El archivo abierto, la tab activa y el tamaño de letra no son preferencias.

### 3.16. Atajos de teclado

`Mod` es ⌘ en Mac y Ctrl en el resto. Los dígitos se reconocen por la **tecla física**, así que funcionan con cualquier distribución de teclado. No se activan con AltGr ni con ⇧. Funcionan también con un panel abierto.

| Atajo | Acción |
|---|---|
| `Mod+K` | Abrir o cerrar el menú (o cerrar el panel abierto) |
| `Mod+1` … `Mod+9`, `Mod+0` | Tab principal 1…10 |
| `Mod+Alt+1` … `Mod+Alt+0` | Subtab 1…10 de la tab abierta (no con ⇧, porque ⌘⇧3/4/5 son capturas de pantalla en macOS) |
| `Mod+S` | Guardar ahora (descargar en modo degradado) |
| `Esc` | Cerrar el panel abierto |
| `1`…`0` con el menú abierto | Ir a esa tab principal |
| `↑` `↓` `Enter` en el menú | Navegar y ejecutar |
| `Tab` en el editor | Insertar un tabulador (con selección, sangrar) |
| Estándar de CodeMirror | Deshacer, rehacer, selección, movimiento |

Pantalla completa, tema, zen, Títulos y exportar no tienen atajo: solo el menú.

### 3.17. PWA y funcionamiento sin conexión

- Instalable: nombre y nombre corto «Folio», descripción «Un bloc de notas persistente y silencioso.», `display: standalone`, `lang: es`, `start_url` y `scope` en la ruta base, colores `#F5F4F0`, iconos de §2.10.
- Service Worker (`registerType: 'prompt'`): la app (HTML, JS, CSS, SVG, PNG y fuentes; hasta 3 MB por archivo) se guarda en caché al instalarse. El diccionario ortográfico se guarda la primera vez que se usa (caché `todo-dictionaries`, primero la caché, 2 entradas). Todo funciona sin conexión.
- **Actualizaciones**: cuando hay una versión nueva esperando, se aplica recargando la página, pero solo si la página está visible, no hay ningún panel abierto y no hay cambios sin guardar. Se comprueba cada 2 s, al volver a la pestaña y al abrir un archivo desde el sistema.
- Abre archivos desde el sistema (§3.1) con `file_handlers` y `launchQueue`.
- Se publica en GitHub Pages bajo `/‹repositorio›/` (`/folio/`). El despliegue (al hacer push a `main` o a mano) pasa antes lint, formato, tests unitarios y e2e.

### 3.18. Lo que folio no hace, a propósito

- No interpreta Markdown (no hay negritas, listas ni encabezados reales); solo pinta los enlaces `[texto](url)` y las URLs sueltas. («Exportar pestaña» sí quita las marcas, §3.21.)
- No centra el texto al escribir (sin «typewriter scrolling»).
- Fuera del modo zen no tiene contador de palabras en pantalla (solo en el historial).
- No sugiere correcciones ni corrige en otros idiomas.
- No tiene diálogo de conflictos: el disco más reciente gana.
- No restaura versiones del historial.
- No cambia el tamaño de letra.
- No tiene botones en la barra de tabs para crear, cerrar o quitar.

### 3.19. Instrucciones

- Menú «Más…» › **«Instrucciones»**. Panel alto de solo lectura con la cabecera «Instrucciones» y el pie **[Cerrar]**. En escritorio recibe el foco para desplazarse con el teclado.
- Contenido, en bloques con título tenue en mayúsculas (0,72 rem):
  - **Escribir**: «Un único archivo .txt» y las convenciones del texto, cada una con una **muestra pintada igual que en el editor** y una explicación corta: «# marca un título», «-- tacha tarea» y «[Ejemplo](https://) crea un enlace».
  - **Pestañas**: «Hasta 10 pestañas, con 10 subpestañas cada una» y «Sólo se pueden eliminar pestañas vacías».
  - **Atajos** (no en táctil): menú, tabs, subtabs, dígito con el menú abierto, guardar (o «Descargar el .txt» en modo degradado) y Esc. Se leen de la tabla de atajos, así que muestran ⌘/⌥ en Mac y Ctrl/Alt en el resto.
  - **Zen**: «Modo literario: una columna centrada en la que solo se ilumina la línea que escribes; dos guiones se convierten en raya (—) y las comillas, en « ».»
  - **Historial** (no en modo degradado): «folio guarda una copia del archivo cada hora. Puedes descargar cualquiera desde Más… › Historial.»

### 3.20. Títulos

- Menú «Más…» › **«Títulos»**. Abre una lista con el **mismo aspecto y manejo que el menú** (↑/↓, Enter, Esc, clic fuera; los dígitos no hacen nada) con los títulos de la tab o subtab abierta, en el orden del texto. Sustituye al menú sin parpadeo (§2.6).
- Un título es una línea que el editor pinta como tal (§2.4). La etiqueta es su texto sin los `#` del principio ni los del final (`## Título ##`), sin las marcas en línea de §3.21 y, de los enlaces, solo su texto. Los `#` sueltos, sin texto, no se listan.
- **Títulos repetidos**: se listan todos; cada uno lleva a su propia línea y a la derecha se indica cuál es («1 de 2», «2 de 2»). Los que no se repiten no llevan nada.
- Al elegir uno, el texto se desplaza hasta que ese título queda **arriba, justo bajo la barra de tabs** (a 8 px de ella; si el título está al principio del documento, el scroll no puede subir más), y el cursor se coloca al principio de la línea (en escritorio el editor recupera el foco; en táctil no, para no abrir el teclado).
- Sin títulos: «Esta pestaña no tiene títulos» («Esta subpestaña no tiene títulos»).

### 3.21. Exportar pestaña

- Menú «Más…» › **«Exportar pestaña»** («Exportar subpestaña» con una subtab abierta). Solo si tiene texto.
- Descarga directamente (sin diálogo, sin aviso, `text/plain;charset=utf-8`) la tab o subtab abierta (no sus subtabs ni el diccionario) como `‹título›.txt`, donde el título es su **primera palabra, la de la barra de tabs, sin recortar** (`Compra.txt`; puede ser un número o un trozo de URL). Si no tiene palabras: `Pestaña N.txt` / `Subpestaña N.txt`.
- El contenido es **texto plano legible**, con las mismas líneas y sangrías (sin espacios al final de línea):
  - Sin las convenciones de folio: `# Título` → `Título` (también sin los `#` finales); `-- tarea` → `tarea`.
  - Sin marcas de Markdown: énfasis y tachado (`***`, `**`, `*`, `___`, `__`, `_`, `~~`, también anidados; no se tocan `2*3*4` ni `nombre_de_archivo`), código en línea, vallas ` ``` ` y `~~~` (el código de dentro queda literal), citas `>` (también anidadas), separadores (`---`, `***`, `___` y subrayados `===` → línea en blanco), casillas `- [ ]` / `- [x]` (→ `- `) y escapes `\*`.
  - Las viñetas `*` y `+` pasan a `-`; las listas numeradas y las de `-` se dejan.
  - Enlaces: `[texto](url)` → `texto (url)` (solo `texto` si ya es la URL); imágenes → su texto alternativo; `<url>` → `url`. Un enlace con un esquema no permitido se deja tal cual.

### 3.22. Bloques cifrados

- **Sintaxis pendiente de cifrar**: `<secret:contraseña>` en una línea y `</secret:contraseña>` al cerrar. También se aceptan `</secret>` y `<secret>` como cierre; al descifrar se restaura siempre la forma explícita. El contenido entre las marcas se conserva **exactamente**, con sus espacios y saltos.
- **Restricciones**: la contraseña no puede estar vacía, contener `>` (cierra la marca) ni saltos de línea. No se permiten bloques anidados; sí varios bloques por pestaña, con contraseñas iguales o distintas. Las marcas incompletas, los cierres sueltos o las contraseñas que no coinciden se explican en un diálogo y **no modifican nada**.
- **Encriptar pestaña** (primer nivel del menú, solo si la tab abierta tiene al menos un bloque pendiente con sintaxis válida): valida todos los bloques pendientes, los cifra en memoria y solo entonces sustituye cada uno por una línea `<folio-secret:v1:pbkdf2-hmac-sha256:ITERACIONES:aes-256-gcm:SAL:IV:DATOS>`. El texto exterior y los bloques ya cifrados no se tocan. La contraseña no forma parte de la representación. El cambio pasa por el autoguardado habitual y el aviso es **«Pestaña encriptada.»**.
- **Desencriptar pestaña** (primer nivel del menú, solo si la tab abierta contiene algún bloque cifrado): pide una contraseña en un panel (nunca se guarda). El panel solo muestra el título «Desencriptar pestaña», el campo con el placeholder «Contraseña» y los botones [Cancelar] [Desencriptar]. Prueba los bloques cifrados con los parámetros de cada uno y restaura la sintaxis `<secret:contraseña>…</secret:contraseña>` en los que se abran; los demás quedan intactos. Si se abren todos, no muestra ningún aviso. Si no se abre ninguno, avisa sin modificar el documento; si solo se abren algunos, indica cuántos se han descifrado y cuántos no. El texto restaurado y la contraseña vuelven al texto plano (y el autoguardado los guarda así): no es un desbloqueo temporal.
- **Criptografía**: Web Crypto API, AES-256-GCM (etiqueta de 128 bits), PBKDF2-HMAC-SHA-256 con sal aleatoria de 16 bytes por bloque, IV aleatorio de 12 bytes por operación y **600.000 iteraciones** (mínimo inicial). Los parámetros se autentican como AAD; un bloque manipulado falla la autenticación y se conserva intacto. Todo va en Base64 dentro de una sola línea, para que el `.txt` siga siendo texto plano.
- **Protección**: los bloques cifrados se pintan en monoespaciada tenue, el cursor los salta y no se pueden editar a medias; se pueden seleccionar y borrar enteros. Si un bloque se daña, se subraya y se conserva para no perder la posibilidad de repararlo.
- **Límites**: cifrar el contenido actual **no borra copias anteriores**. El historial, el borrador vivo, el deshacer del editor y los archivos sincronizados pueden conservar el texto en claro y la contraseña escrita o usada al descifrar. Esa limpieza hay que hacerla por separado.

---

## 4. Textos de la interfaz

| Contexto | Texto |
|---|---|
| Borrador | «Hay cambios sin guardar de ‹hace X›. ¿Quieres recuperarlos?» · [Descartar] [Recuperar] |
| Bloqueo | «Este archivo ya está abierto en otra pestaña.» · [Volver] [Editar aquí] |
| Cedido | «Este archivo se está editando en otra pestaña.» |
| Avisos (3,5 s salvo que se indique) | «Pestaña encriptada.» · «No se pudo abrir el archivo.» · «Algo ha fallado al acceder al archivo.» · «Sin permiso para abrir el archivo.» · «El archivo ya no está disponible.» · «El archivo cambió en otro dispositivo: se ha cargado la versión más reciente.» · «folio perdió el permiso de escritura. Pulsa el punto de estado para recuperarlo.» (6 s) · «El archivo ya no está donde estaba. Pulsa el punto de estado para guardarlo en otro sitio.» (6 s) · «Sin permiso de escritura. Puedes guardar en otro archivo desde el menú.» · «Guardado en ‹nombre›» · «No se pudo guardar el archivo.» · «Descargado.» · «No se pudo cargar el diccionario ortográfico.» · ««‹palabra›» añadida al diccionario.» · «El navegador no permite la pantalla completa aquí.» · «Versión guardada.» · «Sin cambios desde la última versión.» · «No se pudo guardar la versión.» · «Versión guardada en ‹nombre›» · «La versión ya no está disponible.» · «No se pudo descargar la versión.» · Bloqueo rechazado o sin respuesta (8 s, §3.12) |
| Listas vacías | «Nada que mostrar» · «Esta pestaña no tiene títulos» / «Esta subpestaña no tiene títulos» · «El diccionario personal está vacío.» · «Todavía no hay versiones de este archivo.» · «No se pudo leer el historial.» |
| Estado del guardado | «Guardado hace…» / «Guardado» · «Cambios sin guardar» · «Guardando…» · «No se pudo guardar · pulsa para resolver» · «Borrador local · descarga el .txt desde el menú» · «Estado del guardado» (`aria-label` sin estado) |
| Etiquetas accesibles | «Menú (⌘K)» / «Menú (Ctrl+K)» / «Menú» · «TO-DOs resueltos» · «Palabras» · «Quitar del diccionario» |
| Tiempo relativo | «hace un momento» (< 45 s) · «hace N min» (redondeado) · «hace N h» (redondeado) · fecha corta sin año («7 sept, 13:42») cuando las horas redondeadas llegan a 24 |
| Fecha y hora completas | «7 sept 2026, 13:42:05» (es-ES) |

---

## 5. Constantes

| Constante | Valor |
|---|---|
| Tabs máximas / subtabs máximas por tab | 10 / 10 |
| Espera del guardado automático / guardado forzado mientras se escribe | 3 s / 30 s |
| Reintento tras error | 2 s → ×2 → máximo 60 s |
| Espera del borrador vivo | 300 ms |
| Comprobación de cambios externos | 10 s, y al volver a la pestaña o recuperar el foco |
| Espera de respuesta de la otra pestaña / reintentos al tomar el bloqueo | 3 s / 10 × 50 ms |
| Intervalo del historial / versiones guardadas | 1 h / 50 |
| Cifrado de bloques | AES-256-GCM (etiqueta 128 bits), PBKDF2-HMAC-SHA-256, 600.000 iteraciones, sal 16 B, IV 12 B |
| Handles recordados por nombre | 20 |
| Retardo del corrector / margen revisado / espera máxima para cargar el diccionario | 400 ms / ±2.000 caracteres / 2 s |
| Comprobación de actualizaciones de la app | 2 s |
| Longitud máxima del título de tab | 16 caracteres (15 + «…») |
| Margen de «Títulos» bajo la barra de tabs | 8 px |
| Duración de los avisos | 3,5 s (6 s y 8 s en algunos casos) |
| Tolerancia de un toque sobre un enlace | 8 px |
| Tabulación | 4 |
| Punto de corte móvil | 700 px |
| Área mínima de toque | 44 px |

---

## 6. Identificadores heredados (no cambiar)

El proyecto se llamó **to-do**. Para no perder datos ni romper archivos se mantienen:

- marcadores `[todo:tab N]`, `[todo:tab N.M]` y el bloque `<!-- todo:diccionario` … `-->`;
- claves `todo.*` de `localStorage` (también leídas por el script en línea de `index.html`);
- base de datos IndexedDB `to-do` (v2) con los almacenes `files` (clave `id`, índice `lastOpened`), `drafts` (clave `todoId`) y `backups` (clave `[todoId, ts]`, índice `todoId`); el nombre del campo `todoId`;
- canal de BroadcastChannel `to-do` y locks `to-do:‹clave del archivo›`;
- caché del Service Worker `todo-dictionaries`.

---

## 7. Fallos conocidos

Ninguno conocido. Corregidos el 22 de octubre de 2026 (con tests que los cubren): el borrador vivo guardaba el hash de la base en lugar del texto; tras «Recuperar» el texto quedaba sin borrador; pegar una URL sobre el texto de un enlace no le cambiaba la URL; el aviso de permiso denegado remitía a una opción inexistente; los marcadores fuera de rango creaban tabs vacías y perdían su contenido; los archivos no canónicos se reescribían sin editarlos; los avisos quedaban bajo el velo; en zen táctil un toque en el margen podía abrir el teclado; tras abortar una escritura los cambios podían quedar sin guardado programado; y «reducir movimiento» no desactivaba todas las animaciones.
