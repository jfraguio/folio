# FOLIO — Especificación estética y funcional

> Describe la aplicación **tal y como está implementada** (commit `1fc1e66`, septiembre de 2026). Si algo del código contradice este documento, uno de los dos está mal y hay que decidir cuál.
>
> Las mejoras técnicas pendientes están en `next-steps.md`.

---

## 1. Qué es folio

**folio** es un bloc de notas web, minimalista y silencioso, que escribe en **un archivo local de texto plano** (`.txt`). Todo el contenido vive en ese archivo, organizado en **pestañas (tabs)** y **subpestañas (subtabs)**. La aplicación guarda sola, no interrumpe y apenas se ve: el texto ocupa toda la pantalla.

Principios:

1. **El texto es el protagonista.** Sin barras de herramientas, sin números de línea, sin botones dentro del texto. El cromo (marca, estado y menú) es pequeño, tenue y está en las esquinas.
2. **El archivo es la verdad.** Un `.txt` legible por cualquier editor. No hay servidor ni cuenta.
3. **Guardar no es tarea del usuario.** Guardado automático, borrador de emergencia, historial de versiones.
4. **Nada interrumpe.** Solo aparecen diálogos cuando la decisión es inevitable. El resto son avisos de una línea que desaparecen solos.
5. **Texto plano siempre.** No se interpreta Markdown. Hay tres convenciones visuales (títulos `#`, tareas hechas `--`, enlaces) que solo decoran, nunca transforman el texto.

Idioma de la interfaz: **español**, salvo la pantalla de inicio (`OPEN`, `NEW`, `CONTINUE`), que está en inglés a propósito.

---

## 2. Estética

### 2.1. Tipografía

| Uso | Fuente | Tamaño | Interlineado |
|---|---|---|---|
| Todo | **iA Writer Quattro S** (SIL OFL), WOFF2 autoalojada, `font-display: swap`. Respaldo: `'IBM Plex Sans', system-ui, sans-serif` | — | — |
| Texto del editor (modo normal) | Regular 400 | **16 px** (`--font-size`); en táctil nunca menos de 16 px, para evitar el zoom de iOS | **1,55** |
| Texto del editor (modo zen) | Regular 400 | 16 px | **1,65** (`--line-height`) |
| Títulos de las tabs | Regular 400 | 16 px (`--text-size` = `--font-size`) | 20 px (34 px en móvil) |
| Base del cromo (`rem`) | — | **19 px** (`--ui`) | 1,65 |
| Marca «FOLIO» y contador | Regular, mayúsculas, `letter-spacing: 0.08em` | 0,72 rem ≈ 13,7 px | 22 px |
| Menú y paneles | Regular | 0,9 rem ≈ 17,1 px (17 px en móvil) | — |
| Metadatos (atajos, palabras, tooltips) | Regular, cifras tabulares | 0,70–0,72 rem ≈ 13,5 px | — |
| Avisos | Regular | 0,78 rem ≈ 14,8 px | — |

- El tamaño de letra es **fijo**: no hay atajos ni preferencia para cambiarlo.
- Suavizado `antialiased`, `text-rendering: optimizeLegibility`.
- Solo se usa el peso Regular sin cursiva, aunque también se declaran Italic, Bold y BoldItalic.

### 2.2. Color (tokens)

Contrastes suaves, sin negro ni blanco puros. Los dos temas usan los mismos nombres de token.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#F5F4F0` | `#111111` | Fondo de la app, del editor y de la barra de tabs |
| `--fg` | `#2A2A2A` | `#D6D3CC` | Texto, cursor, tab activa |
| `--fg-dim` | `#9C9A94` | `#66645F` | Cromo, tabs inactivas, texto tenue del modo zen, líneas hechas |
| `--fg-faint` | `#C9C7C1` | `#3A3936` | Subrayado de los enlaces |
| `--err` | `#C97A7A` | `#A86B6B` | Punto de estado en error; palabra del diccionario al pasar el ratón |
| `--misspell` | `#A8534E` | `#C4837C` | Palabras con error ortográfico; contador de tareas hechas |
| `--sel` | `rgba(42,42,42,.12)` | `rgba(214,211,204,.14)` | Selección, fondo de la tab activa, fila activa del menú, botón al pasar el ratón |
| `--overlay-bg` | `rgba(245,244,240,.92)` | `rgba(17,17,17,.92)` | Velo detrás de los paneles |
| `--panel-bg` | `#FBFAF7` | `#181817` | Paneles y avisos |
| `--panel-border` | `#E3E1DB` | `#2A2927` | Bordes de paneles, botones y tab activa |
| `--heading-bg` | `#E4E1DA` | `#232321` | Fondo de las líneas de título |
| `--tab-sub-bg` | `#EBE9E4` | `#1C1C1B` | Fondo de las subtabs (y de la tab madre con una subtab abierta) |
| `--tab-sub-bg-active` | `#DCD9D1` | `#2C2C2A` | Fondo de la subtab activa |
| `--chrome-opacity` | 0,35 | 0,85 | Opacidad base del cromo (reservada) |
| `--chrome-opacity-hover` | 0,85 | 1 | Opacidad de la marca, el contador, el menú y el punto visible |

- El cambio de tema anima fondo y color en **120 ms** (`--ease`). Con `prefers-reduced-motion: reduce`, todas las transiciones y animaciones son instantáneas.
- `<meta name="theme-color">` sigue al tema (`#f5f4f0` / `#111111`) para colorear la barra del navegador o de la PWA.
- El tema se aplica **antes del primer pintado** con un script en línea en `index.html`, para que no haya parpadeo. Ese mismo script aplica el modo zen.

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

#### Barra de tabs (arriba, fija)

- Franja fija de **2,9 rem (≈ 55 px)** de alto, a todo el ancho, con **fondo opaco `--bg`** que tapa el texto al hacer scroll. Relleno: 1,1 rem arriba y a la izquierda, **7 rem a la derecha** para dejar sitio a la marca. `z-index: 5`. No se puede seleccionar su texto.
- Dentro, una **tira horizontal** de botones:
  - **Tabs principales** primero, en orden.
  - Después, un **separador vertical** de 1 × 14 px, color `--fg-dim` al 55 %, con un margen igual a la distancia entre textos. Solo se ve si la tab abierta tiene subtabs.
  - Detrás, las **subtabs de la tab abierta** (solo las de esa tab).
- Cada tab es una **píldora** (`border-radius: 999px`) ceñida al texto: relleno horizontal `min(0.3rem, 0.8vw)`, borde de 1 px transparente, texto `--fg-dim`, 16 px, una sola línea.
  - **Hover** (solo con ratón): texto `--fg`.
  - **Activa**: texto `--fg`, borde `--panel-border`, fondo `--sel`.
  - **Subtab**: fondo `--tab-sub-bg`. **Subtab activa**: fondo `--tab-sub-bg-active` y el borde y el color de cualquier activa.
  - **Tab madre con una subtab abierta**: lleva el fondo `--tab-sub-bg`, pero su texto sigue tenue (la activa es la subtab).
- **Espaciado uniforme**: la distancia de texto a texto es la misma entre cualquier par de elementos, con o sin píldora y también a través del separador (`gap: min(0.55rem, 1.75vw)`). Las tabs no tienen ancho mínimo.
- **Ancho**: cada tab principal mide como máximo 1/10 del ancho de la tira, contando los huecos (`--tab-count: 10`, el máximo). Así el sitio de cada tab es el mismo haya las que haya, y crear una no mueve las demás. Los títulos largos se cortan con «…».
- **Desbordamiento**: si tabs y subtabs no caben, la tira se desplaza en horizontal, sin barra de scroll visible y con un **degradado de 0,75 rem** en los bordes. Al cambiar de tab, la activa se **centra sola** con scroll suave.

#### Marca «FOLIO» (arriba a la derecha)

- `h1.brand`, fija a 1,1 rem de los bordes superior y derecho (más la zona segura), 22 px de alto, 0,72 rem, mayúsculas, `letter-spacing: 0.08em`, color `--fg-dim`, opacidad 0,85 (claro) / 1 (oscuro). No se selecciona.
- Con un archivo abierto, al pasar el ratón muestra: `‹nombre del archivo›` + salto de línea + `Última modificación: ‹fecha y hora›`. Es la del último guardado correcto o la versión cargada; la ruta completa no está disponible.
- También se ve en la pantalla de inicio.

#### Contador de tareas hechas (a la izquierda de la marca)

- Mismo estilo que la marca, en color **`--misspell`** (rojo apagado) y con cifras tabulares, a 4,2 rem del borde derecho.
- Muestra cuántas **líneas hechas** (`--`, §3.7) tiene la **tab o subtab abierta**. Si no hay ninguna, no se muestra.

#### Esquina inferior derecha: punto de estado y menú

- Grupo fijo a 1,1 rem de los bordes inferior y derecho (más la zona segura), separación de 0,4 rem (1 rem en táctil). A la izquierda el punto de estado; a la derecha el botón de menú.
- **Botón de menú**: 22 × 22 px, tres líneas horizontales (SVG `0 0 14 10`, líneas en y = 1, 5 y 9, trazo de 1 px, `currentColor`), color `--fg-dim`, opacidad 0,85 / 1, radio de 4 px. `title` / `aria-label`: «Menú (⌘K)» en Mac, «Menú (Ctrl+K)» en el resto y «Menú» en táctil.
- **Punto de estado**: caja de 22 × 22 px con un punto de **6 px** en el centro, color `--fg-dim`:

| Estado | Aspecto | Tooltip |
|---|---|---|
| `idle` / `saved` | Invisible (opacidad 0, fundido de 300 ms) | «Guardado hace un momento / hace N min / hace N h / ‹fecha›» |
| `dirty` | Visible (0,85 / 1) | «Cambios sin guardar» |
| `saving` | Visible | «Guardando…» |
| `error` | Color `--err`, opacidad 0,8 | «No se pudo guardar · pulsa para resolver» |
| `degraded` | Visible siempre | «Borrador local · descarga el .txt desde el menú» |

  El tooltip (0,7 rem, `--fg-dim`, sin fondo) aparece encima del punto al pasar el ratón o con foco de teclado.
- En táctil, los dos controles tienen un área de toque invisible de **44 × 44 px** sin cambiar su dibujo.

#### Área de texto (modo normal)

- CodeMirror a pantalla completa, fondo `--bg`, sin contorno al enfocar, **scroll vertical sin barra visible**. En iOS el scroll tiene inercia y no provoca el «tirar para recargar».
- El contenido ocupa **todo el ancho**: relleno lateral de 1 rem (más la zona segura) y relleno superior igual al alto de la barra de tabs más 0,5 rem. El relleno inferior es de **60 vh** (60 dvh si existe; 45 dvh en móvil) para poder escribir con la línea activa a media pantalla.
- Ajuste de línea activado (`lineWrapping`), tabulación de 4.
- **Cursor**: barra de 2 px en `--fg`, con parpadeo nativo. **Selección**: `--sel`.
- Se hacen visibles los caracteres especiales invisibles (`highlightSpecialChars`).
- Sin corrector nativo, sin autocorrección y sin mayúsculas automáticas (`spellcheck="false"`, `autocorrect="off"`, `autocapitalize="off"`).

### 2.4. Decoraciones del texto

Todas son visuales. El archivo sigue siendo texto plano.

| Convención | Regla | Aspecto |
|---|---|---|
| **Título** | La línea empieza por `#` (con espacios o tabuladores opcionales delante) | Fondo `--heading-bg` a todo lo ancho de la línea; texto en su color normal. Deja un **hueco de 7,5 px debajo** (relleno con el fondo recortado al contenido, así que se ve como un margen). |
| **Tarea hecha** | La línea empieza por `--` pero no por `---` (con espacios o tabuladores opcionales) | **Toda la línea tachada** (línea de 1 px en `--fg`), texto en `--fg-dim`. Gana a «título» si coinciden las dos. `---` o más se consideran separadores y no se tachan. |
| **Enlace** | `https?://…` o `www.…`, hasta un espacio o `< > " ' ( )` | Subrayado `--fg-faint` con separación de 2 px; con el ratón encima, subrayado `--fg`. Cursor de mano. El color del texto es `--fg`, así que un enlace nunca sale en rojo aunque el corrector lo marque. |
| **Error ortográfico** | Palabra que Hunspell no reconoce (§3.8) | Texto en `--misspell`. **Sin subrayado.** |

### 2.5. Modo zen

Un modo de escritura concentrada que imita al editor Folio original. Se activa y desactiva desde el menú y se recuerda entre sesiones. Todo lo visual cuelga de `html[data-zen]`.

- **Columna centrada** de **38 rem (≈ 722 px)** sin relleno lateral (1 rem en móvil). Relleno superior `max(22vh, barra + 0,5 rem)`. Interlineado **1,65**.
- **Separación entre párrafos** de 0,6 em. Cada línea del documento es un párrafo, aunque ocupe varias líneas en pantalla. La última no lleva hueco. Bajo un título se suman 0,6 em y 7,5 px.
- **Focus mode invertido**: todo el texto se ve **tenue** (`--fg-dim`), y solo la **línea del cursor** se ve en `--fg`, siempre que el usuario haya colocado el cursor y la línea tenga texto.
  - Al abrir, o tras un clic en los márgenes, no hay línea activa: todo tenue, sin cursor visible (caret transparente).
  - Un clic en una línea, escribir, pulsar una tecla de edición o de navegación, o cambiar de tab vuelven a colocar el cursor.
  - Un clic en los márgenes o en el relleno quita el cursor del texto sin moverlo, y el editor conserva el foco.
  - Las líneas hechas siguen tenues aunque sean la activa. Los enlaces toman el color de su línea.
- **Barra de tabs transparente** que no recibe el ratón. Solo se ve el título de la tab o subtab abierta, en `--fg-dim`, sin píldora ni fondo, en el primer hueco. El separador se oculta. El texto pasa por debajo de la barra y de la marca.
- **Sustituciones al teclear** (solo en zen):
  - `-` justo detrás de otro `-` (y no de `--`) → los dos se convierten en **raya `—`**.
  - `"` → **`«`** al principio de palabra (inicio, espacio, salto, `( [ { — -`) y **`»`** en los demás casos.
  - Consecuencia: en zen, teclear `--` al principio de línea produce `—`, no una tarea hecha. Las líneas `--` ya existentes se siguen viendo tachadas.

### 2.6. Paneles (menú, diálogos, diccionario, historial)

- **Velo**: `--overlay-bg` a pantalla completa, `z-index: 10`, fundido de entrada de 120 ms. El panel se alinea arriba, a **14 vh** del borde (4 vh los paneles altos).
- **Panel**: `min(34rem, 92vw)` de ancho, alto máximo 70 vh (92 vh los altos), fondo `--panel-bg`, borde de 1 px `--panel-border`, **radio de 8 px**, sombra `0 12px 40px rgba(0,0,0,.08)`, 0,9 rem.
- **Filas del menú**: relleno de 0,45 rem × 1 rem, etiqueta a la izquierda (cortada con «…») y metadato a la derecha (atajo, 0,72 rem, `--fg-dim`). **Fila activa**: fondo `--sel`. **Fila informativa**: 0,8 rem, `--fg-dim`, no se selecciona.
- **Botones** (`.btn`): 0,85 rem, radio de 5 px, borde `--panel-border`; con el ratón encima, fondo `--sel`. **Principal**: borde `--fg`. **Discreto**: sin borde y texto `--fg-dim`. En táctil, alto mínimo de 44 px.
- **Cabecera** de los paneles altos: franja de 0,72 rem en `--fg-dim` con un borde inferior.
- **Móvil (≤ 700 px)**: los paneles son **hojas inferiores** a todo el ancho, pegadas abajo, con radio de **14 px arriba**, sin borde inferior, relleno para la zona segura, alto máximo de 85 dvh, 17 px y una entrada deslizando 12 px en 160 ms.

### 2.7. Avisos

- Una línea centrada abajo (a 1,4 rem del borde; 3,4 rem en móvil, para no tapar los controles). Fondo `--panel-bg`, borde, radio de 6 px, relleno de 0,4 × 0,8 rem, 0,78 rem, `--fg-dim`, ancho máximo de 90 vw.
- Aparece y desaparece con un fundido de 200 ms. Dura **3,5 s** por defecto (6 s u 8 s en algunos casos, §4). Un aviso nuevo sustituye al anterior. `role="status"`, `aria-live="polite"`.

### 2.8. Pantalla de inicio

- Columna centrada vertical y horizontalmente, con 2,5 rem entre bloques. La marca «FOLIO» sigue arriba a la derecha.
- Acciones apiladas: **`OPEN`**, **`NEW`** y, si hay un archivo anterior recordado, **`CONTINUE «nombre»`** (sin extensión, más pequeño, 0,75 rem y `--fg-dim`).
  - Estilo: 0,85 rem, mayúsculas, `letter-spacing: 0.05em`, color `--fg`, sin borde. Con el ratón encima, opacidad 0,7. En táctil, alto mínimo de 44 px.
- Si el navegador no permite escribir en archivos (modo degradado), aparece debajo una nota de 0,8 rem en `--fg-dim`, centrada y con un ancho máximo de 28 rem:
  - Escritorio: «Tu navegador no permite guardar directamente en el archivo. folio guardará un borrador local y podrás descargar el .txt cuando quieras. Para la experiencia completa, usa Chrome o Edge.»
  - Táctil: «En el móvil los cambios se guardan como borrador en este navegador; puedes descargar el .txt desde el menú cuando quieras.»

### 2.9. Móvil y táctil

Se detecta **pantalla estrecha** con `max-width: 700px` y **táctil** con `pointer: coarse` (`html[data-touch]`).

- **Barra de tabs**: 52 px más la zona segura superior; relleno de 8 px más la zona segura. Tabs de tamaño natural (máximo 42 vw), 36 px de alto; relleno de 10 px y separación de 14 px. Imán de scroll al centro de cada tab. El gesto horizontal es de la barra y el vertical, del editor.
- La **marca se oculta**. El **contador de tareas hechas** baja a la **esquina inferior izquierda**, simétrico al grupo de estado y menú.
- Paneles como hojas inferiores (§2.6). Avisos más arriba (§2.7).
- **Teclado virtual**: folio nunca lo abre por su cuenta.
  - Al abrir un archivo no se enfoca el editor.
  - Pulsar una tab mantiene el teclado como estaba: si estaba cerrado, sigue cerrado.
  - Al cerrar un panel no se vuelve a enfocar el editor.
  - `interactive-widget=resizes-content`: el teclado encoge la ventana en vez de tapar el editor. Se usan unidades `dvh`.
- En el menú no se muestran atajos y la primera fila indica el estado del guardado (§3.10).
- **Enlaces**: un toque sobre un enlace lo abre si el editor no tenía el foco (se estaba leyendo). Si se estaba escribiendo, el toque coloca el cursor.
- Zonas seguras (`env(safe-area-inset-*)`) en todos los elementos fijos. `viewport-fit=cover`.
- Botones sin el resaltado gris al tocar y sin retraso por doble toque.

### 2.10. Icono

Cuadrado redondeado (radio 12/64) de fondo claro con **tres viñetas grises** (`#9E9E9E`): tres círculos a la izquierda y tres barras a la derecha, como una lista. Hay un SVG, PNG de 192 y 512 px, una versión enmascarable de 512 px (con margen del 10 %) y el `apple-touch-icon` de 180 px, todos con fondo `#F5F4F0`.

---

## 3. Funcionalidad

### 3.1. Abrir un archivo

| Acción | Comportamiento |
|---|---|
| **OPEN** | Selector del sistema. Acepta `.txt`, `.md` y `.markdown` (los `.md` son de versiones anteriores y tienen el mismo formato). |
| **NEW** | Diálogo «Guardar como» con el nombre `folio.txt` (solo `.txt`). Crea el archivo vacío y lo abre. En modo degradado no hay diálogo: se trabaja con un `folio.txt` en memoria. |
| **CONTINUE «nombre»** | Solo con File System Access. Reabre el último archivo con el que se trabajó y pide permiso de escritura si hace falta. Si se deniega: «Sin permiso para abrir el archivo.». Si el archivo ya no existe, se olvida y se avisa: «El archivo ya no está disponible.». |
| **Desde el sistema** | Con la PWA instalada, folio se ofrece para abrir `.txt`, `.md` y `.markdown`. Si ya hay un archivo abierto, se guarda y se cierra antes. |

Al abrir se hace, en este orden:

1. Leer el archivo y normalizarlo: quitar la BOM y convertir `\r\n` y `\r` a `\n`. No se reescribe hasta la primera edición.
2. Identificar el archivo (§3.13) y pedir almacenamiento persistente al navegador.
3. **Bloqueo entre pestañas** (§3.12).
4. **Versión de apertura** en el historial, si toca (§3.11).
5. **Recuperar el borrador**: si hay un borrador vivo más reciente que el archivo y con otro contenido, se pregunta **«Hay cambios sin guardar de ‹hace X›. ¿Quieres recuperarlos?»** con **[Descartar]** y **[Recuperar]** (principal). Si se recupera, el borrador sustituye al contenido y se guarda en cuanto se pueda. Si se descarta, se borra para que no vuelva a preguntar.
6. Mostrar el editor con la **primera tab** (nunca una subtab) y el cursor al final. En escritorio el editor recibe el foco; en táctil, no.

Si algo falla: «No se pudo abrir el archivo.» o «Algo ha fallado al acceder al archivo.», y se vuelve a la pantalla de inicio.

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

Reglas:

- Marcador de tab: `[todo:tab N]` en una línea propia, con N entre 1 y 10. Marcador de subtab: `[todo:tab N.M]`, con M entre 1 y 10, justo después del contenido de su tab (y de las subtabs anteriores).
- Una tab o subtab **vacía** se escribe solo con su marcador, para que exista al reabrir. Se considera vacía si solo tiene espacios o saltos, y en ese caso ese contenido se pierde al guardar.
- Un documento con **una sola tab vacía y sin subtabs** se guarda como un **archivo vacío**.
- Al guardar se quitan los saltos de línea finales de cada tab.
- Al leer:
  - Si el archivo **no empieza por un marcador** (texto plano cualquiera), todo va a la tab 1.
  - El número de tabs lo marca el **marcador más alto** (mínimo 1, máximo 10). Los huecos se leen como tabs o subtabs vacías, así nada cambia de sitio.
  - Se ignoran los marcadores fuera de rango.
- **Bloque del diccionario**: comentario HTML **al final** del archivo: marcador, dos líneas de descripción, una línea vacía y una palabra por línea. Solo cuentan como palabras las líneas sin espacios. Si no hay palabras, no se escribe el bloque. `-->` dentro del bloque se escribe como `--\>`. Si el bloque no está al final o está mal cerrado, se trata como texto normal de la última tab.
- Abrir y guardar un archivo que ya tiene este formato no lo cambia.
- Los prefijos `todo:` vienen del nombre anterior de la app y se mantienen por compatibilidad.

### 3.3. Tabs y subtabs

| Aspecto | Tabs | Subtabs |
|---|---|---|
| Cantidad | De 1 a **10**. Un archivo nuevo tiene 1. | De 0 a **10** por tab. Un solo nivel. |
| Nombre | La **primera palabra** del contenido (letras y números, con apóstrofo o guion internos: `[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*`); si pasa de 16 caracteres, los 15 primeros y «…». Sin palabras: su **número** (`1`…`10`). | Igual, con su número dentro de la tab (`1`…`10`). |
| `title` del botón | «Tab N: ‹nombre›», o «Tab N» si está vacía | «Subpestaña M de la tab N[: ‹nombre›]» |
| Dónde | En la barra, en orden | Detrás de todas las principales y del separador. Solo las de la tab abierta. |
| Abrir | Clic, **⌘/Ctrl+1…9, 0** (0 = la 10), o un dígito con el menú abierto | Clic o **⌘⌥/Ctrl+Alt+1…9, 0** |
| Crear | Menú **«Crear pestaña»**: solo desde una tab principal y con menos de 10. Se añade al final y se abre. | Menú **«Crear subpestaña»**: solo desde una tab principal que tenga menos de 10. Se añade al final y se abre. |
| Eliminar | Menú **«Eliminar pestaña N»** (la abierta): solo si está vacía, sus subtabs están todas vacías y no es la única. Se abre la que ocupa su sitio (o la última). | Menú **«Eliminar subpestaña M»**: solo si está vacía. Se abre la que ocupa su sitio, o la tab madre si no quedan. |

- **Nunca se borra texto**: no hay forma de eliminar una tab o subtab con contenido.
- Solo hay **una activa**, la que se edita. Con una subtab abierta, la madre no se marca como activa, pero lleva el fondo de las subtabs.
- Al cambiar de tab: el editor carga su contenido, el cursor va **al final**, el título de la barra se actualiza y la activa se centra si la barra se desplaza. El foco se mantiene según §2.9.
- Pulsar la tab que ya está abierta solo devuelve el foco.
- Los atajos a una tab o subtab que no existe no hacen nada. ⌘N siempre abre la tab principal.
- Mientras se escribe, el título de la tab se actualiza en cada pulsación.
- La tab activa **no se recuerda** entre sesiones.

### 3.4. Guardado automático

| Disparador | Acción |
|---|---|
| 1,5 s sin escribir | Guardar |
| Cada 30 s mientras haya cambios sin guardar | Guardar |
| La pestaña pasa a segundo plano (`visibilitychange → hidden`), `pagehide` | Guardar (lo que dé tiempo) y volcar el borrador |
| `beforeunload` con cambios pendientes | Guardar y pedir confirmación al salir (diálogo nativo) |
| **⌘/Ctrl+S** | Guardar ya. En modo degradado, descargar el `.txt`. Se evita el «Guardar página» del navegador. |

- Solo hay una escritura a la vez. Si se escribe mientras se guarda, se vuelve a guardar al terminar.
- Si el texto no ha cambiado desde lo último guardado, no se escribe.
- Lo que se guarda son todas las tabs y subtabs más el diccionario personal (§3.2). Añadir o quitar palabras del diccionario también cuenta como cambio.
- **Justo antes de escribir** se consulta la fecha de modificación del archivo. Si es **posterior** a la de la versión cargada, no se escribe: se relee el archivo y **su contenido sustituye al local** (§3.5).
- **Errores**:

| Causa | Estado | Aviso | Recuperación |
|---|---|---|---|
| Permiso revocado (`NotAllowedError` / `SecurityError`) | `error` | «folio perdió el permiso de escritura. Pulsa el punto de estado para recuperarlo.» (6 s) | Al pulsar el punto se pide el permiso y se reintenta. Si se deniega: «Sin permiso de escritura. Puedes guardar en otro archivo desde el menú.» |
| Archivo borrado o movido (`NotFoundError`) | `error` | «El archivo ya no está donde estaba. Pulsa el punto de estado para guardarlo en otro sitio.» (6 s) | Al pulsar el punto se abre «Guardar como…»; si va bien: «Guardado en ‹nombre›». |
| Cualquier otro | `error` | — | Reintento automático cada 2, 4, 8… hasta 60 s |

  Tras un error, el menú también ofrece **«Reintentar guardado»**.
- **Regla absoluta**: con la pestaña abierta, el texto no se pierde. Siempre queda al menos el borrador vivo.

### 3.5. Cambios hechos desde otro dispositivo

Pensado para archivos en iCloud Drive u otras carpetas sincronizadas.

- Cada **10 s**, y también al **volver a la pestaña** o al **recuperar el foco** la ventana, se compara la **fecha de modificación** del archivo con la de la versión cargada. No se lee el contenido.
- Si la del disco es **posterior**, se relee el archivo y se vuelca en el editor. Se conservan la tab activa (o la última que exista, si ahora hay menos) y la posición del cursor. Se recarga también el diccionario personal. Aviso: **«El archivo cambió en otro dispositivo: se ha cargado la versión más reciente.»**
- **El disco manda**, aunque haya cambios locales sin guardar (se pierden como mucho unos segundos). No hay diálogo de conflicto. La única excepción es que se esté escribiendo en ese momento: entonces se espera al siguiente ciclo.
- Si la comprobación falla (por ejemplo, iCloud aún no tiene el archivo), se ignora y se reintenta.
- En modo degradado no hay comprobación.

### 3.6. Borrador vivo

- Copia del documento entero en el almacenamiento del navegador (IndexedDB), **300 ms** después de cada cambio.
- Se borra al guardar el archivo. Al abrir, sirve para ofrecer la recuperación (§3.1).
- En modo degradado es el único guardado automático real.

### 3.7. Convenciones del texto

- **Títulos** (`#…`), **tareas hechas** (`--…`) y **enlaces**: ver §2.4.
- **Contador de tareas hechas**: número de líneas `--` de la tab o subtab abierta (§2.3).
- **Enlaces**: **⌘/Ctrl+clic** abre la URL en una pestaña nueva (`noopener`). Las que empiezan por `www.` se abren con `https://` delante. Un clic simple solo coloca el cursor. En táctil, ver §2.9.
- La tecla **Tab** inserta un tabulador. Deshacer y rehacer funcionan con los atajos estándar de CodeMirror (⌘Z / ⌘⇧Z o Ctrl+Z / Ctrl+Y).

### 3.8. Corrector ortográfico

- **Activado por defecto.** Se activa o desactiva desde el menú y se recuerda.
- Solo **español** (Hunspell, `dictionary-es`), en un **Web Worker**. El diccionario se descarga la primera vez que se necesita y queda en caché. Si falla: «No se pudo cargar el diccionario ortográfico.».
- **Solo marca**, nunca sugiere: las palabras desconocidas se ven en rojo apagado (§2.4).
- Se revisa la parte visible de la tab abierta con un margen de ±2.000 caracteres, 400 ms después del último cambio, movimiento del cursor o scroll.
- **No se marcan**:
  - la palabra en la que está el cursor, mientras siga ahí;
  - palabras de una letra;
  - palabras con dígitos;
  - fragmentos de URL;
  - palabras del diccionario personal.
- Palabra = letras y marcas diacríticas, con apóstrofo o guion internos.
- Al desactivarlo desaparecen las marcas y no se activa el corrector nativo.

### 3.9. Diccionario personal

- Conjunto de palabras aceptadas que **distingue mayúsculas**. Se guarda **dentro del propio archivo** (§3.2) y viaja con él.
- **Añadir**: **⌘/Ctrl+⇧+D** con el cursor en una palabra, o desde el menú con **«Añadir «palabra» al diccionario»** (solo con el corrector activado y el cursor sobre una palabra). Aviso: «‹palabra› añadida al diccionario.».
- **Gestionar**: menú **«Diccionario»** (solo con el corrector activado). Panel alto con la cabecera «Diccionario personal · pulsa una palabra para quitarla» y las palabras en **píldoras** por orden alfabético español. Pulsar una la quita; con el ratón encima se ve tachada en `--err`, y en táctil llevan una «×». Vacío: «El diccionario personal está vacío.». Botón **[Cerrar]**.

### 3.10. Menú

- Se abre con **⌘/Ctrl+K**, con el botón de menú o pulsando el punto de estado cuando no hay error ni modo degradado. **⌘/Ctrl+K** con un panel abierto lo cierra.
- Es una lista sin buscador. **↑/↓** mueven la selección (saltando las filas informativas), **Enter** ejecuta, **Esc** o un clic fuera cierran. Con ratón, pasar por encima selecciona la fila. Al abrirse, la primera fila seleccionable está activa.
- **Un dígito** (1…9, 0) con el menú abierto cierra el menú y abre esa tab principal, si existe. En modo zen, además, **desactiva el zen**.
- Al cerrar, en escritorio el foco vuelve al texto.
- **Entradas, en este orden** (cada una solo si se cumple su condición):

| # | Entrada | Condición | Efecto |
|---|---|---|---|
| — | ‹Estado del guardado› (informativa) | Solo en táctil | Muestra «Guardado hace…», «Cambios sin guardar»… |
| 1 | **Modo zen** / **Desactivar modo zen** | Siempre | Activa o desactiva el zen (§2.5) |
| 2 | **Tema oscuro** / **Tema claro** | Siempre | Cambia al otro tema y lo fija (deja de seguir al sistema) |
| 3 | **Pantalla completa** / **Salir de pantalla completa** | El navegador tiene la API (no en iPhone) | Si falla: «El navegador no permite la pantalla completa aquí.» |
| 4 | **Desactivar corrector** / **Activar corrector** | Siempre | §3.8 |
| 5 | **Diccionario** | Corrector activado | §3.9 |
| 6 | **Crear pestaña** | En una tab principal y con < 10 tabs | §3.3 |
| 7 | **Crear subpestaña** | En una tab principal con < 10 subtabs | §3.3 |
| 8 | **Eliminar pestaña N** / **Eliminar subpestaña M** | La abierta se puede eliminar | §3.3 |
| 9 | **Historial** | No en modo degradado | §3.11 |
| 10 | **Añadir «palabra» al diccionario** `⌘⇧D` | Corrector activado y cursor sobre una palabra | §3.9 |
| 11 | **Descargar el .txt** | Modo degradado | Descarga el documento como `‹nombre›.txt` |
| 12 | **Reintentar guardado** | Tras un error de guardado | §3.4 |

  En escritorio, a la derecha de cada entrada se muestra su atajo si lo tiene; hoy solo lo tiene la 10.

### 3.11. Historial de versiones

- Cada versión es una **copia del archivo completo** (tabs, subtabs y diccionario) en el almacenamiento del navegador, ligada a la identidad del archivo (§3.13).
- **Cuándo se guarda**:
  - **Al abrir**, si hace más de una hora de la última versión o no hay ninguna. Se guarda lo que había en el disco, antes de recuperar ningún borrador.
  - **Cada hora** mientras el archivo está abierto.
  - **Al pulsar «Guardar versión»**, en ese momento.
- **Sin duplicados**: no se guarda una versión idéntica (mismo SHA-256) a la **más reciente**. «Guardar versión» sin cambios avisa: **«Sin cambios desde la última versión.»**.
- Se conservan las **50 más recientes**.
- **Panel** (alto):
  - Cabecera «Historial · N versiones» («1 versión»).
  - Una fila por versión, de la más reciente a la más antigua: fecha y hora con segundos (p. ej. «7 sept 2026, 13:42:05»), «N palabras» y el botón **[Descargar]**.
  - Palabras: las de todas las tabs y subtabs, sin contar líneas `# ` ni separadores.
  - Sin versiones: «Todavía no hay versiones de este archivo.». Si falla la lectura: «No se pudo leer el historial.».
  - Pie: **[Cerrar]** y **[Guardar versión]** (principal, desactivado mientras guarda). Tras guardar: «Versión guardada.» y la lista se actualiza.
- **Descargar** ofrece guardar como `‹nombre› — AAAA-MM-DD HH.mm.txt` (o lo descarga directamente sin File System Access). Aviso: «Versión guardada en ‹nombre›».
- **No existe «restaurar», a propósito**: una versión nunca vuelve al editor ni al archivo. Para recuperar algo, se descarga y se abre.
- En modo degradado no hay historial.

### 3.12. Varias pestañas del navegador con el mismo archivo

- Solo una pestaña puede editar un archivo a la vez (Web Locks + BroadcastChannel).
- Si ya está abierto en otra: **«Este archivo ya está abierto en otra pestaña.»** con **[Volver]** y **[Editar aquí]** (principal).
  - **Editar aquí**: se pide a la otra pestaña que guarde y ceda.
    - Si cede, esa pestaña muestra «Este archivo se está editando en otra pestaña.» y esta abre el archivo.
    - Si tiene cambios que no puede guardar, se niega: «La otra pestaña tiene cambios que aún no ha podido guardar. Resuélvelo allí antes de abrir el archivo aquí.» (8 s), y se vuelve al inicio.
    - Si no responde en **3 s** (congelada o descartada), se abre igualmente: «La otra pestaña no responde. Se abre aquí; si allí sigue abierto, prevalecerá lo último que se guarde.» (8 s).
  - **Volver**: pantalla de inicio.

### 3.13. Identidad del archivo

- Con File System Access, un archivo se identifica primero por **handle** (mismo archivo físico) y, si no, por **nombre**. Dos archivos con el mismo nombre comparten identidad, y con ella historial, borrador y bloqueo. Así la identidad sobrevive a copias y renombrados de la sincronización.
- En modo degradado, la identidad es nombre + tamaño.
- Se recuerda el último archivo con handle para ofrecer **CONTINUE**.

### 3.14. Modo degradado (sin File System Access: Firefox, Safari, móvil)

- Abrir con el selector de archivos del navegador. No se puede escribir en el archivo.
- El punto de estado queda en `degraded` (visible). Pulsarlo **descarga el `.txt`**. ⌘S también descarga («Descargado.»). En el menú aparece «Descargar el .txt».
- El borrador vivo es el guardado automático. No hay historial ni comprobación de cambios externos.

### 3.15. Preferencias

Se guardan en `localStorage` y se aplican antes del primer pintado:

| Clave | Valores | Por defecto |
|---|---|---|
| `todo.theme` | `light` \| `dark` \| `system` | `system` (sigue al sistema en vivo) |
| `todo.spell.enabled` | `true` \| `false` | `true` |
| `todo.zen` | `true` \| `false` | `false` |

El archivo abierto, la tab activa y el tamaño de letra no son preferencias.

### 3.16. Atajos de teclado

`Mod` es ⌘ en Mac y Ctrl en el resto. Los dígitos se reconocen por la **tecla física**, así que funcionan con cualquier distribución de teclado.

| Atajo | Acción |
|---|---|
| `Mod+K` | Abrir o cerrar el menú |
| `Mod+1` … `Mod+9`, `Mod+0` | Tab principal 1…10 |
| `Mod+Alt+1` … `Mod+Alt+0` | Subtab 1…10 de la tab abierta (no con ⇧, porque ⌘⇧3/4/5 son capturas de pantalla en macOS) |
| `Mod+Shift+D` | Añadir la palabra del cursor al diccionario |
| `Mod+S` | Guardar ahora (descargar en modo degradado) |
| `Esc` | Cerrar el panel abierto |
| `1`…`0` con el menú abierto | Ir a esa tab principal |
| `↑` `↓` `Enter` en el menú | Navegar y ejecutar |
| `Tab` en el editor | Insertar un tabulador |
| Estándar de CodeMirror | Deshacer, rehacer, selección, movimiento |

Pantalla completa, tema y zen no tienen atajo: solo el menú.

### 3.17. PWA y funcionamiento sin conexión

- Instalable (`display: standalone`, nombre «FOLIO», `lang: es`, colores `#F5F4F0`).
- Service Worker con actualización automática. La app (HTML, JS, CSS, fuentes e iconos) se guarda en caché al instalarse. El diccionario ortográfico se guarda la primera vez que se usa. Todo funciona sin conexión.
- Abre archivos desde el sistema (§3.1).
- Se publica en GitHub Pages bajo `/folio/`.

### 3.18. Lo que folio no hace, a propósito

- No interpreta Markdown (no hay negritas, listas ni encabezados reales).
- No centra el texto al escribir (sin «typewriter scrolling»).
- No tiene contador de palabras en pantalla (solo en el historial).
- No sugiere correcciones ni corrige en otros idiomas.
- No tiene diálogo de conflictos: el disco más reciente gana.
- No restaura versiones del historial.
- No cambia el tamaño de letra.
- No tiene botones en la barra de tabs para crear, cerrar o quitar.

---

## 4. Textos de la interfaz

| Contexto | Texto |
|---|---|
| Borrador | «Hay cambios sin guardar de ‹hace X›. ¿Quieres recuperarlos?» · [Descartar] [Recuperar] |
| Bloqueo | «Este archivo ya está abierto en otra pestaña.» · [Volver] [Editar aquí] |
| Cedido | «Este archivo se está editando en otra pestaña.» |
| Avisos (3,5 s salvo que se indique) | «No se pudo abrir el archivo.» · «Algo ha fallado al acceder al archivo.» · «Sin permiso para abrir el archivo.» · «El archivo ya no está disponible.» · «El archivo cambió en otro dispositivo: se ha cargado la versión más reciente.» · «folio perdió el permiso de escritura. Pulsa el punto de estado para recuperarlo.» (6 s) · «El archivo ya no está donde estaba. Pulsa el punto de estado para guardarlo en otro sitio.» (6 s) · «Sin permiso de escritura. Puedes guardar en otro archivo desde el menú.» · «Guardado en ‹nombre›» · «Descargado.» · «No se pudo cargar el diccionario ortográfico.» · «‹palabra› añadida al diccionario.» · «El navegador no permite la pantalla completa aquí.» · «Versión guardada.» · «Sin cambios desde la última versión.» · «No se pudo guardar la versión.» · «Versión guardada en ‹nombre›» · «No se pudo descargar la versión.» · Bloqueo rechazado o sin respuesta (8 s, §3.12) |
| Tiempo relativo | «hace un momento» (< 45 s) · «hace N min» · «hace N h» · fecha corta a partir de 24 h |

---

## 5. Constantes

| Constante | Valor |
|---|---|
| Tabs máximas / subtabs máximas por tab | 10 / 10 |
| Retardo del guardado automático / guardado periódico | 1,5 s / 30 s |
| Reintento tras error | 2 s → ×2 → máximo 60 s |
| Retardo del borrador vivo | 300 ms |
| Comprobación de cambios externos | 10 s, y al volver a la pestaña o recuperar el foco |
| Espera de respuesta de la otra pestaña | 3 s |
| Intervalo del historial / versiones guardadas | 1 h / 50 |
| Retardo del corrector / margen revisado | 400 ms / ±2.000 caracteres |
| Longitud máxima del título de tab | 16 caracteres (15 + «…») |
| Punto de corte móvil | 700 px |
| Área mínima de toque | 44 px |

## 6. Identificadores heredados (no cambiar)

El proyecto se llamó **to-do**. Para no perder datos ni romper archivos se mantienen:

- marcadores `[todo:tab N]`, `[todo:tab N.M]` y `<!-- todo:diccionario -->`;
- claves `todo.*` de `localStorage`;
- base de datos IndexedDB `to-do` (v2: stores `files`, `drafts`, `backups`);
- canal de BroadcastChannel y nombre de los locks `to-do`;
- caché del Service Worker `todo-dictionaries`.
