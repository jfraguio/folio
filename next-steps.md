# Folio — Próximos pasos

Análisis del código a fecha 30-09-2026 (commit `1fc1e66`). Dos bloques:

1. **Arquitectura y código**: qué conviene reorganizar o limpiar.
2. **Rendimiento, ligereza y resiliencia**: cómo hacer la app más rápida, ligera y robusta **sin cambiar su funcionalidad**.

Al final hay un plan por fases. Las referencias van como `archivo:línea`.

## Estado de partida

- ~6.300 líneas (TS + CSS + tests). Vanilla TS + CodeMirror 6 + `idb` + `nspell` en un worker + PWA.
- `vitest`: **91 tests en verde** (9 archivos). `tsc --noEmit`: sin errores.
- Build: JS principal 329 KB (109 KB gzip), CSS 15 KB (3,8 KB gzip), worker 9,5 KB. Diccionario `es.dic` + `es.aff`: 873 KB (232 KB gzip), se carga aparte.
- `nspell` con el diccionario español tarda **~500 ms en parsear y ocupa ~50 MB de heap** en el worker (medido en Node).
- La base es sólida: autosave con máquina de estados probada, borrador vivo, bloqueo entre pestañas, sondeo por `mtime`, historial con dedupe por hash y bastante atención a móvil y táctil.

## Hallazgos prioritarios (resumen)

| #   | Hallazgo                                                                                                                                                                                                       | Tipo        | Gravedad    | Ref.                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- | ------------------------------------------------------------------ |
| 1   | **⌘Z después de cambiar de tab mete el texto de la tab anterior en la actual**, y el autosave lo escribe en el archivo. Lo he reproducido.                                                                     | Bug / datos | **Crítica** | `session.ts:235`, `session.ts:434`                                 |
| 2   | **En Windows, con teclado español, no se pueden escribir `@`, `#`, `\|` ni `~`**: AltGr llega como Ctrl+Alt y cae en los atajos de subtabs. Sin `#` no hay títulos.                                            | Bug         | **Alta**    | `shortcuts.ts:20-33`                                               |
| 3   | **Si se cierra con Esc o con clic fuera el diálogo de «recuperar borrador» o el de «abierto en otra pestaña», la apertura se queda colgada** (la promesa nunca se resuelve y el bloqueo sigue cogido).         | Resiliencia | **Alta**    | `Dialog.ts:30`, `Menu.ts:55-62`, `session.ts:67`, `session.ts:123` |
| 4   | **Un archivo de texto plano con una línea `[todo:tab N]` en medio cambia de estructura al guardarlo y reabrirlo** (el texto se reparte entre tabs). Lo he reproducido.                                         | Datos       | Alta        | `todoBlocks.ts:105-111`                                            |
| 5   | **Si el corrector falla una vez al cargar, queda roto toda la sesión** (`ready` sigue a `true` con la promesa rechazada) y no hay forma de reintentar.                                                         | Resiliencia | Media       | `SpellService.ts:13-35`                                            |
| 6   | **Quitar una palabra del diccionario recarga Hunspell entero** (~500 ms de CPU y 50 MB). No hace falta: el diccionario personal ya se filtra en el hilo principal.                                             | Rendimiento | Media       | `session.ts:398`, `spellcheck.ts:46`                               |
| 7   | La identidad del archivo va por **nombre**, y todo archivo nuevo se llama `folio.txt`. Dos archivos distintos comparten borrador, historial y bloqueo, y se puede **ofrecer recuperar en B el borrador de A**. | Datos       | Media       | `files.ts:31-42`                                                   |
| 8   | Cuando iCloud cambia el `mtime` sin cambiar el contenido, se recarga el archivo, sale un aviso falso y **se descartan los últimos segundos de escritura**.                                                     | Resiliencia | Media       | `autosave.ts:142-151`, `fileWatcher.ts:57`                         |
| 9   | Carrera entre el borrador vivo y el guardado: al pasar a `saved` se borra el borrador pendiente aunque haya pulsaciones posteriores sin guardar.                                                               | Resiliencia | Baja-media  | `session.ts:336`, `liveDraft.ts:37-42`                             |
| 10  | El smoke test (`scripts/smoke.mjs`) no funciona: `playwright-core` no está instalado, usa rutas absolutas de tu máquina y espera un orden de menú antiguo.                                                     | Tooling     | Media       | `scripts/smoke.mjs:4,7,134`                                        |

---

## 1. Arquitectura y código

### 1.1. Un `EditorState` por tab (arregla el hallazgo #1)

**Problema.** Hay un único `EditorView`, y para cambiar de tab se sustituye el documento entero con una transacción normal (`showTab`, `session.ts:235-238`). Esa transacción entra en el historial de deshacer. Pasa lo mismo al cargar la versión del disco (`applyDiskVersion`, `session.ts:434-437`).

Para reproducirlo: escribe en la tab 1, cambia a la tab 2 y pulsa ⌘Z. El editor vuelve a mostrar el texto de la tab 1, el `updateListener` lo guarda como contenido de la tab 2 (`syncActive`) y el autosave lo escribe en el archivo. Lo he confirmado con un script sobre `@codemirror/state` + `@codemirror/commands`:

```
after switch:          "tab two"
after Mod-Z on tab 2:  "TAB 1 text"
```

Con la recarga desde disco pasa lo mismo: un ⌘Z tras recibir la versión de otro dispositivo devuelve el texto local y lo reescribe encima.

**Propuesta.**

- Guardar un `EditorState` por tab y subtab (`Map<TabKey, EditorState>`) y cambiar con `view.setState(state)`. Cada tab tiene así su propio deshacer, cursor y selección, y el cambio de tab no genera ninguna transacción. Las extensiones (compartimentos de zen y corrector) se crean con una función `buildExtensions()` común. Al reconfigurar un compartimento, se aplica al estado activo y se marca en los demás para aplicarlo cuando se abran.
- Como mínimo, si se quiere un parche inmediato: anotar esas transacciones con `Transaction.addToHistory.of(false)`, y además reiniciar el historial al cambiar de tab (un estado nuevo, o `isolateHistory`). Solo con `addToHistory: false` no basta, porque el historial anterior seguiría aplicándose sobre el documento nuevo.
- Añadir un test que cubra «⌘Z tras cambiar de tab no cambia la tab».

### 1.2. Dividir `session.ts` (752 líneas, una sola función)

`startSession` es un cierre enorme que mezcla lectura del archivo, bloqueo, borrador, UI, modelo de tabs, autosave, sondeo, corrector, comandos y ciclo de vida. Todo comparte variables mutables (`activeTab`, `activeSub`, `file`, `tabs`...), así que no se puede probar por partes. De hecho no hay ningún test de las reglas de crear y eliminar tabs, de recuperar el borrador ni de recargar desde disco.

Propuesta de módulos (sin cambiar el comportamiento):

| Módulo                   | Responsabilidad                                                                                                                | Testeable sin DOM    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `app/TabModel.ts`        | `tabs`, `active{Tab,Sub}`, `add/addSub/remove/canRemove/select`, `textOf/setTextOf`; emite eventos (`change`, `activeChange`). | Sí                   |
| `app/DocumentSync.ts`    | Autosave, borrador vivo, `FileWatcher`, `applyDiskVersion`, `reloadFromDisk`, `saveAs`.                                        | Sí (con IO simulada) |
| `app/SpellController.ts` | Carga, activación, añadir y quitar palabras, re-escaneo.                                                                       | Casi                 |
| `app/sessionCommands.ts` | Registro de comandos (hoy `session.ts:498-694`).                                                                               | Sí                   |
| `app/lifecycle.ts`       | `visibilitychange`, `pagehide`, `beforeunload`, `focus`, cesión del bloqueo.                                                   | —                    |
| `app/session.ts`         | Solo orquesta: crea y conecta lo anterior y devuelve `close()`.                                                                | —                    |

### 1.3. Modelo de tabs explícito en lugar de arrays compartidos

`TabBar` recibe el array `tabs` por referencia y lo relee en cada `render()`, mientras la sesión lo modifica con `splice`/`push` (`session.ts:262`, `302`, `425`). Es un acoplamiento implícito: cualquier cambio del array exige acordarse de llamar a `tabBar.render()`/`setActive()`. Con `TabModel` (1.2) emitiendo eventos, `TabBar` se suscribe y deja de depender de que la sesión recuerde repintar.

### 1.4. Abstracción de archivos más limpia

- `mtime()` solo existe en `FsAccessAdapter`, y la sesión hace `adapter instanceof FsAccessAdapter` (`session.ts:326`, `331`, `468`, `490`). Conviene añadir `mtime?(f)` (o `capabilities.watch`) a `FileAdapter`.
- `download()` y `saveToNewFile()` viven en `FallbackAdapter.ts`, pero los usan la sesión y el historial en cualquier modo. Mejor moverlos a `fs/download.ts`.
- `isTouch()` / `applyTouchFlag()` están en `fs/detect.ts` y no tienen nada que ver con archivos. Mejor en `ui/env.ts` o `platform.ts`.
- `FsAccessAdapter.write` no llama a `writable.abort()` si falla la escritura (`FsAccessAdapter.ts:37-44`), y puede quedar un `.crswap` huérfano junto al archivo (ver 2.2.8).

### 1.5. Comandos y atajos

- **AltGr (hallazgo #2).** `comboOf` (`shortcuts.ts:20-33`) trata Ctrl+Alt como `Mod-Alt`. En Windows, AltGr genera `ctrlKey && altKey`, así que AltGr+2 (`@`), AltGr+3 (`#`), AltGr+1 (`|`) y AltGr+4 (`~`) en teclado español se interpretan como «subtab 2/3/1/4» y se cancelan con `preventDefault`. Solución: ignorar el evento si `e.getModifierState('AltGraph')` y, fuera de Mac, no aceptar `Mod-Alt-dígito` cuando `e.key` es un carácter imprimible distinto del dígito. Añadir un test.
- `CommandRegistry.run` (`commands.ts:29-34`) no comprueba `when()`. Por atajo se pueden ejecutar comandos que el menú no ofrecería: por ejemplo, ⌘⇧D añade la palabra al diccionario con el corrector desactivado. Propuesta: `run(id, { force })`, que respete `when` por defecto.
- `Command.shortcut` nunca se usa (todo sale de `SHORTCUTS`), y `prettyShortcut` conserva casos de `=`/`-` de los atajos de tamaño de letra retirados. Se puede simplificar.
- Los atajos globales siguen activos con un diálogo abierto (⌘1 cambia de tab por detrás del historial). Conviene ignorarlos mientras haya un overlay, salvo ⌘K y ⌘S.

### 1.6. Formato del archivo: ida y vuelta estable (hallazgo #4)

`parseTabs` (`todoBlocks.ts:105-111`) carga en la tab 1 cualquier archivo que no empiece por un marcador. Pero al guardar se antepone `[todo:tab 1]`, y en la siguiente apertura cualquier línea `[todo:tab N]` del texto pasa a ser un marcador real. Resultado reproducido:

```
abrir:    [{"text":"Notas pegadas\n[todo:tab 2]\nsecreto"}]
guardar:  "[todo:tab 1]\nNotas pegadas\n[todo:tab 2]\nsecreto"
reabrir:  [{"text":"Notas pegadas"},{"text":"secreto"}]
```

Pasa lo mismo si el usuario escribe o pega una línea que parece un marcador, o un bloque `<!-- todo:diccionario … -->` al final de la última tab.

Propuesta, compatible con los archivos existentes:

- Al serializar, **escapar** las líneas de contenido que coinciden con `TAB_RE` o con la apertura del bloque de diccionario. Por ejemplo, anteponer `\` (`\[todo:tab 2]`) y quitarlo al leer solo en las líneas que, sin la barra, serían un marcador. Los archivos actuales no contienen esas líneas escapadas, así que se leen igual.
- Añadir una propiedad de ida y vuelta al test: `split(join(split(x))) == split(x)` para textos arbitrarios (fast-check o una tabla de casos).
- Aprovechar para documentar que un tab con solo espacios o saltos se escribe vacío (`todoBlocks.ts:95`).

### 1.7. Identidad de archivo (hallazgo #7)

`resolveTodoId` (`files.ts:12-57`) reutiliza el id del primer registro con el **mismo nombre**, y «NEW» siempre propone `folio.txt`. Así, dos `folio.txt` en carpetas distintas:

- comparten historial (versiones mezcladas);
- comparten borrador: al abrir B puede aparecer «Hay cambios sin guardar… ¿Recuperar?» con el texto de A, y al aceptar se escribe en B;
- comparten el bloqueo `to-do:<id>`, así que no se pueden abrir a la vez en dos pestañas.

En modo degradado el id es `file:<nombre>:<tamaño>` (`files.ts:54`), que cambia en cuanto el archivo cambia de tamaño.

Propuesta sin cambiar la funcionalidad visible:

- Mantener la identidad por nombre para el historial, que era la intención (sobrevive a renombrados y copias de iCloud), pero **ligar el borrador a su versión base**: guardar en `DraftRecord` el `baseHash` (SHA-256 del texto del disco del que parte) y ofrecer recuperarlo solo si coincide con el archivo abierto, o si el archivo abierto es el `handle` con el que se escribió (`isSameEntry`).
- Usar como bloqueo el `handle` (`isSameEntry`) en lugar del id por nombre, o incluir en la clave el id del registro que coincide por `isSameEntry`.

### 1.8. Convenciones de texto en un solo sitio

Hay varias expresiones regulares para lo mismo, y no siempre coinciden:

| Concepto         | Dónde                                                                 | Diferencia                                                                                                      |
| ---------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Palabra          | `TabBar.ts:6`, `words.ts:3`, `spellcheck.ts:20`                       | La del corrector no acepta dígitos; las otras sí.                                                               |
| URL              | `links.ts:15`, `spellcheck.ts:23`                                     | Duplicada.                                                                                                      |
| Título `#`       | `strikethrough.ts:16` (`^[ \t]*#`), `words.ts:5` (`^\s{0,3}#{1,6}\s`) | El historial no descuenta como título `#Compra` y sí descuenta `# Compra`; el editor pinta los dos como título. |
| Línea hecha `--` | `strikethrough.ts:14`                                                 | —                                                                                                               |

Propuesta: un módulo `text/conventions.ts` con `WORD_RE`, `URL_RE`, `HEADING_RE`, `DONE_RE`, `isHeading()`, `isDone()`, usado por todos. De paso, corregir el comentario de `strikethrough.ts:8-9`, que dice que los títulos se pintan «en el rojo habitual», cuando el CSS (`editor.css:192-196`) les pone fondo y color normal.

### 1.9. Código muerto y dependencias sin uso

- Dependencias que no se importan en ninguna parte: `@codemirror/lang-markdown`, `@lezer/highlight`, y `@codemirror/language` como dependencia directa (`package.json:22-26`). La propia spec dice que `lang-markdown` se retiró.
- Código sin uso: `prefs.toggle` (`prefs.ts:44`), `SpellService.cached`/`markCorrect` (`SpellService.ts:38`, `72`), `AbortedByUser`/`isAbort` (`FileAdapter.ts:48-57`), `MenuOptions.onClose`, `Command.shortcut`.
- CSS sin uso: `.panel__input`, `.panel__item--nested`, `.panel__item--current` (`overlays.css:51-65`, `96-99`, `120-122`). `.panel__footer` se usa como cabecera con estilos inline que invierten el borde (`History.ts:23`, `DictionaryManager.ts:37`): mejor una clase `.panel__header`.
- Fuentes Italic, Bold y BoldItalic declaradas y precacheadas pero nunca usadas (ver 2.1.4).

### 1.10. Nombres heredados («todo» → «folio»)

El código mezcla `Todo*` (tipos, `todoId`, `todoBlocks`, `TODO_*`) con la marca `folio`. Los identificadores **persistidos** (`[todo:tab N]`, `todo.*`, BD `to-do`, canal y lock `to-do`) deben seguir igual, pero pueden vivir en un único `persistence/legacyIds.ts`, y el resto del código puede renombrarse (`FolioFile`, `fileId`, `folioFormat.ts`...) sin tocar datos. Es una mejora de legibilidad de baja prioridad.

### 1.11. Tooling, CI y dependencias

- **Smoke test roto** (`scripts/smoke.mjs`, y lo mismo en `scripts/icons.mjs`): importa `playwright-core` por ruta absoluta de tu máquina, el paquete no está en `package.json` ni en `node_modules`, y usa el Chrome del sistema. Además comprueba un orden de menú que ya no existe (`smoke.mjs:134`). Propuesta: pasarlo a `@playwright/test` (`tests/e2e/*.spec.ts`) con el shim de File System Access como fixture, y ejecutarlo en CI tras el build.
- **CI**: Node 20 dejó de tener soporte en abril de 2026 (`deploy.yml:23`), así que conviene pasar a Node 22/24 LTS. No hay lint ni formateo. Propuesta: ESLint (`typescript-eslint`) + Prettier + un job `npm run typecheck && npm test && npm run build && npm run e2e`.
- **Dependencias**: Vite 5 → 7/8, Vitest 2 → 3+, `vite-plugin-pwa` 0.20 → 1.x, más parches menores de CodeMirror (`npm outdated`). Mejor hacerlo después de tener el e2e, para detectar regresiones.
- `.playwright-mcp/` aparece como no versionado: añadirlo a `.gitignore`.
- `specs.md` estaba desfasado respecto al código (menú abajo a la izquierda, «sin focus mode», «sin tipografía», letra de 21 px, buscador en el menú...). Se ha reescrito (ver `specs.md`).

### 1.12. Tests que faltan

Con la división de 1.2 son fáciles de escribir:

- `TabModel`: crear y eliminar tabs y subtabs, límites de 10, «nunca se borra texto», qué tab queda activa al eliminar.
- Undo aislado por tab (1.1).
- `comboOf` con AltGr (1.5).
- Ida y vuelta de `todoBlocks` (1.6).
- Recuperación del borrador: solo si es de esta base; con Esc no se cuelga (2.2.1).
- `applyDiskVersion`: con menos tabs o subtabs en disco, el diccionario cambia y se recarga (o no) el corrector.
- `SpellService`: fallo de carga → reintento; `dispose` rechaza lo pendiente.
- E2E (1.11): flujo completo, zen, móvil (viewport estrecho), modo degradado.

### 1.13. Accesibilidad (sin cambiar la funcionalidad)

- Los overlays tienen `role="dialog"` y `aria-modal`, pero no retienen el foco: con Tab se sale al editor que queda debajo.
- El `aria-label` del punto de estado es fijo («Estado del guardado»). Podría llevar el texto del estado (`describeStatus`).
- El contraste de `--fg-dim` sobre `--bg` en tema claro es ~2,6:1 (tabs inactivas, marca, metadatos). Si se quiere mantener la estética, al menos subir el foco visible (`outline` de 1 px `--fg-dim`).

---

## 2. Rendimiento, ligereza y resiliencia (sin cambiar la funcionalidad)

### 2.1. Más rápida y más ligera

#### 2.1.1. Menos trabajo por pulsación

En cada tecla (`session.ts:209-216` y `313-317`) se hace esto:

1. `syncActive()` → `doc.toString()` de la tab (O(n)).
2. `tabBar.render()` → repinta los títulos y `title` de **todas** las tabs y subtabs.
3. `refreshDone()` → otro `doc.toString()` + `split('\n')` de toda la tab.
4. `liveDraft.schedule(getText())` → otro `syncActive()` + `joinDocument` de **todo el documento** + `dictionary.list()` ordenado.
5. `autosave.markDirty()` → `onState('dirty')` → `SaveStatus` → `StatusDot` + título de la marca con `formatDateTime` (`toLocaleString` crea un formateador `Intl` en cada llamada).

Con notas pequeñas no se nota, pero crece con el tamaño del archivo (y en móvil). Propuesta:

- `LiveDraft.schedule()` sin argumento: marcar como sucio y serializar **en el flush** (una vez cada 300 ms en vez de en cada tecla).
- `syncActive()` solo al cambiar de tab, en el flush y en `getText()`. En el listener basta con marcar la tab activa como sucia.
- `tabBar` solo repinta el botón activo, y solo si cambia su primera palabra (se puede calcular con la primera línea no vacía).
- `refreshDone()` agrupado en un `requestAnimationFrame`, o calculado incrementalmente con `u.changes` (solo cambian las líneas tocadas).
- `SaveStatus`: no notificar si el estado no cambia (`dirty` → `dirty`), y actualizar el `title` de la marca solo en `saved`/`error`.
- Crear una vez los `Intl.DateTimeFormat` / `NumberFormat` (`el.ts:42-64`, `words.ts:19-21`).

#### 2.1.2. Corrector: no recargar Hunspell (hallazgo #6)

- `shouldSkip` (`spellcheck.ts:43-48`) ya descarta las palabras del diccionario personal antes de consultar al worker. Por eso **no hace falta** mandarlas a `nspell` (`spell.addWords(dictionary.list())`, `session.ts:383`, `632`) ni, sobre todo, **recargar el worker al quitar una palabra** (`reloadSpell`, `session.ts:398-401`, `443`). Basta con invalidar esa palabra en la caché de `SpellService` (`cache.delete(w)`) y re-escanear. Así se evitan ~500 ms de CPU y el pico de ~50 MB por cada palabra quitada o cambio del diccionario desde disco.
- Cargar el diccionario **cuando el navegador esté libre** (`requestIdleCallback`) y no justo al abrir, que es cuando compite con el primer pintado y el primer escaneo.
- Como opción a medio plazo: sustituir `nspell` por Hunspell compilado a WASM (p. ej. `hunspell-asm`) o por un diccionario precompilado. Carga más rápida y bastante menos memoria. Es un cambio interno, sin efecto visible.

#### 2.1.3. Separar el código de la pantalla de inicio

`main.ts` importa `session.ts` de forma estática, así que la pantalla de inicio espera a que se descarguen y evalúen los 329 KB de CodeMirror. Propuesta: `const { startSession } = await import('./app/session')` en `enter()` y un `import()` especulativo justo después de pintar la pantalla de inicio (o `<link rel="modulepreload">`). La pantalla de inicio sale antes y el editor está listo igual de rápido. El SW lo precachea igual.

#### 2.1.4. Fuentes

- Solo se usa `Regular` (no hay cursiva ni negrita en uso, ver 1.9). Se pueden quitar las otras tres de `@font-face` y del precache (`vite.config.ts:19`), ~128 KB menos en la instalación de la PWA.
- Precargar la Regular (`<link rel="preload" as="font" type="font/woff2" crossorigin>`) para evitar el salto de `system-ui` a iA Writer (FOUT) en la primera visita.
- Opcional: subconjunto latino (`pyftsubset`), otro ~30-40 % menos.

#### 2.1.5. PWA y caché

- Los iconos y las fuentes se precachean dos veces (`includeAssets` + `globPatterns`, visible en `dist/sw.js`). Basta con `globPatterns`.
- El diccionario se cachea en runtime con `CacheFirst`, sin versión ni caducidad (`vite.config.ts:24-30`). Si se actualiza `dictionary-es`, el cliente seguiría para siempre con el antiguo. Propuesta: servirlo con hash en el nombre (importarlo con `?url` o copiarlo a `dict/es.<hash>.dic`) o meterlo en el precache con `revision`.
- Comprobar que GitHub Pages sirve `.dic`/`.aff` comprimidos (tienen un tipo MIME poco común). Si no, se descargan 873 KB en lugar de 232 KB. Alternativa: renombrarlos a `.txt` o precomprimirlos.

#### 2.1.6. Historial en IndexedDB

- `saveVersion` lee con `getAll` **todas** las versiones (hasta 50 textos completos) solo para comprobar colisiones de `ts` y aplicar la retención (`backups.ts:49-56`). Con `getAllKeys` (o un cursor de claves) basta.
- El panel de historial carga los 50 textos para mostrar fecha y palabras (`backups.ts:72-76`). Propuesta: listar metadatos con cursor (o un store `versionsMeta`) y leer el texto solo al pulsar «Descargar».

#### 2.1.7. Temporizadores en segundo plano

- `FileWatcher` sigue sondeando cada 10 s con la pestaña oculta. Al volver ya se comprueba al instante (`session.ts:704-711`), así que se puede **parar el intervalo con `hidden` y reanudarlo con `visible`**, que ahorra batería y accesos a iCloud.
- Lo mismo vale para el temporizador del historial si se quisiera (es horario y apenas cuesta).

### 2.2. Más resiliente

#### 2.2.1. Diálogos que cuelgan la apertura (hallazgo #3)

`openDialog` monta un overlay que se cierra con Esc o con clic fuera (`Menu.ts:48-67`), pero ese cierre no llama a ninguna acción. La sesión espera la respuesta con `new Promise(resolve => openDialog(...))` (`session.ts:67-75`, `123-131`): si el usuario pulsa Esc, **la promesa nunca se resuelve**, la pantalla de inicio se queda como está y, en el caso del borrador, el bloqueo del archivo sigue cogido hasta recargar.

Propuesta: `openDialog` devuelve `Promise<string | null>` y resuelve con la acción `quiet` (o `null`) en `onClose`. La sesión trata `null` como «Descartar» / «Volver».

#### 2.2.2. Deshacer que cruza tabs (hallazgo #1)

Ver 1.1. Es el riesgo de pérdida de datos más fácil de provocar sin querer.

#### 2.2.3. Corrector: fallos pegajosos (hallazgo #5)

- `SpellService.ready` devuelve `this.loaded !== null`, que sigue a `true` aunque la carga falle (`SpellService.ts:13-15`, `31`). Después, `setSpellEnabled` no reintenta (`session.ts:394`) y cada `check()` relanza el error (`SpellService.ts:50-52`), que acaba como rechazo no gestionado en `spellcheck.ts:114`. Solución: poner `loaded = null` si falla, exponer `state: 'idle' | 'loading' | 'ready' | 'failed'` y reintentar al reactivar (o con backoff).
- El worker no comprueba `r.ok` (`spell.worker.ts:25-26`): un 404 o una página de error se pasa a `nspell` como si fuera diccionario.
- No se escucha el evento `error` del `Worker`. Si el script del worker no carga (por ejemplo, tras un despliegue nuevo con otra versión en caché, ver 2.2.9), las promesas pendientes no se resuelven nunca. `dispose()` tampoco rechaza las pendientes.
- `run()` del plugin no captura errores (`spellcheck.ts:84-126`): envolverlo en `try/catch`.

#### 2.2.4. Borrador vivo borrado antes de tiempo

`onState('saved')` → `liveDraft.clear()` (`session.ts:336`), y `clear()` cancela también el borrador **pendiente** (`liveDraft.ts:37-42`). Si el usuario escribe mientras se guarda (`pendingAgain`), esas pulsaciones pierden su borrador hasta la siguiente escritura (~1,5 s). Si el navegador se cierra en ese intervalo, se pierden. Además, cada guardado hace un `delete` en IndexedDB.

Propuesta: `clear()` solo borra si el texto guardado coincide con el último borrador escrito, sin tocar `pending`. Por ejemplo, `clearIfSaved(savedText)`.

#### 2.2.5. `mtime` que cambia sin cambiar el contenido (hallazgo #8)

La política «el disco manda si su `mtime` es posterior» se aplica solo con el `mtime`, en dos sitios: el sondeo y la comprobación previa a cada escritura (`autosave.ts:142-151`). iCloud (y otros sincronizadores) a veces **cambian el `mtime` sin cambiar el contenido** (al descargar, al resolver metadatos, o por relojes distintos). Entonces:

- aparece «El archivo cambió en otro dispositivo…» sin motivo;
- si había cambios locales, **se descartan** (`onNewerOnDisk` → `applyDiskVersion`).

Propuesta, con la misma política: cuando el `mtime` es posterior, leer el contenido (solo en ese caso, así el sondeo sigue siendo ligero) y compararlo con `lastSavedText`. Si coincide, aceptar el `mtime` nuevo en silencio y, en el autosave, **seguir con la escritura**. Solo si difiere se aplica la regla de que el disco manda.

Complemento opcional: antes de descartar cambios locales por una versión más nueva del disco, guardarlos como versión del historial. No cambia la política ni la interfaz; solo añade una entrada al historial.

#### 2.2.6. IndexedDB

- `getDB()` guarda la promesa aunque falle (`db.ts:41-75`): un fallo puntual al abrir (por ejemplo, `blocked`) deja la BD inutilizable toda la sesión. Hay que poner `dbPromise = null` en el `catch`.
- No hay manejadores `blocking`/`blocked`/`terminated`. Si un despliegue futuro sube la versión de la BD (v3) mientras hay otra pestaña abierta con v2, la nueva se queda esperando para siempre en `resolveTodoId` y no llega a abrir el archivo. Propuesta: `blocking() { db.close(); dbPromise = null; }` y `terminated() { dbPromise = null; }`.
- `requestPersistentStorage()` se llama al abrir cada archivo. Bien, pero su resultado no se mira: si el navegador lo deniega, se podría avisar una vez (el historial vive en IndexedDB y podría borrarse por falta de espacio).

#### 2.2.7. Avisos repetidos con errores de guardado

Con el permiso revocado o el archivo movido, cada pulsación pasa a `dirty` → intento → error → `notice(...)` de 6 s (`session.ts:340-343`), así que el aviso se repite cada ~1,5 s mientras se escribe. Propuesta: avisar solo al **entrar** en `error` (o si cambia el tipo de error), y mientras tanto no reintentar en cada tecla. Basta con marcar el cambio y esperar a un gesto (pulsar el punto) o al backoff.

#### 2.2.8. Escrituras a medias

`FsAccessAdapter.write` (`FsAccessAdapter.ts:37-44`): si falla `write()` o `close()`, llamar a `writable.abort()` para no dejar el `.crswap` ni el handle en un estado raro. El intercambio atómico del navegador ya protege el archivo original; esto solo limpia.

#### 2.2.9. Actualizaciones del Service Worker con la sesión abierta

Con `registerType: 'autoUpdate'`, un despliegue nuevo activa el SW nuevo y limpia el precache antiguo mientras la pestaña sigue abierta. Si después el usuario activa el corrector, se pide el `spell.worker-<hash-viejo>.js`, que ya no existe ni en caché ni en GitHub Pages. Opciones: `registerType: 'prompt'` para recargar tras guardar, recargar solo con estado `saved` y sin overlays abiertos, o como mínimo gestionar el `error` del worker (2.2.3).

#### 2.2.10. Cesión del archivo a otra pestaña

Cuando otra pestaña toma el archivo, esta se queda en «Este archivo se está editando en otra pestaña.» sin ninguna acción (`session.ts:731-739`), y `main.ts` sigue apuntando a la sesión cerrada. Propuesta: botones «Volver al inicio» y «Recuperar aquí» (que vuelve a pedir el bloqueo), y limpiar `session` en `main.ts`.

#### 2.2.11. Integridad del formato

Ver 1.6 (marcadores dentro del contenido) y 1.7 (borrador de otro archivo con el mismo nombre). Los dos pueden reordenar o sustituir texto sin que el usuario haga nada raro.

#### 2.2.12. Cierre de la pestaña

`beforeunload`/`pagehide` lanzan `liveDraft.flush()` y `autosave.flush()` sin esperar (no se puede). Chrome suele completar la escritura en IndexedDB, pero no está garantizado. Como red extra barata, se puede escribir en `pagehide` una copia síncrona en `localStorage` (clave `todo.draft.<id>`, solo si cabe) y tratarla en la apertura igual que el borrador.

---

## 3. Plan sugerido

**Fase 1 — Integridad de datos (1-2 días)**

1. Undo por tab (1.1), con test.
2. AltGr (1.5), con test.
3. Diálogos que resuelven con Esc o clic fuera (2.2.1), con test.
4. Escape de marcadores y test de ida y vuelta (1.6).
5. Borrador ligado a su base (1.7) y `clearIfSaved` (2.2.4).
6. Comparar contenido cuando cambia el `mtime` (2.2.5).

**Fase 2 — Robustez (1 día)**

7. `SpellService` con estados, `r.ok`, evento `error`, `try/catch` (2.2.3).
8. `getDB` con `blocking`/`terminated` y sin promesa rechazada en caché (2.2.6).
9. Avisos de error sin repetición (2.2.7), `abort()` en escrituras (2.2.8), SW en modo `prompt` o recarga segura (2.2.9).

**Fase 3 — Ligereza (1 día)**

10. No recargar Hunspell; diccionario personal solo en el hilo principal (2.1.2).
11. Serialización diferida y menos trabajo por tecla (2.1.1).
12. Carga diferida de la sesión y CodeMirror (2.1.3); fuentes (2.1.4); precache y diccionario versionado (2.1.5); historial sin textos en la lista (2.1.6); sondeo parado en segundo plano (2.1.7).

**Fase 4 — Arquitectura y tooling (2-3 días)**

13. E2E con `@playwright/test` en CI, Node 22/24, ESLint + Prettier (1.11).
14. Dividir `session.ts` en `TabModel`, `DocumentSync`, `SpellController` y comandos (1.2, 1.3), con tests unitarios (1.12).
15. `FileAdapter` sin `instanceof`, convenciones de texto centralizadas, limpieza de código y dependencias muertas (1.4, 1.8, 1.9).
16. Actualizar Vite, Vitest y `vite-plugin-pwa` con el e2e como red (1.11).
17. Accesibilidad (1.13) y renombrado interno `todo` → `folio` (1.10), cuando haya tiempo.
