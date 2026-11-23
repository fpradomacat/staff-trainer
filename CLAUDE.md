# staff-trainer

App web de capacitación ("250 Grammi Team Academy") para el staff del restaurante 250 Grammi (Noosaville, QLD). Trivia por equipo (Front of House, Bar, Cocina), reportes de progreso, panel de administración de contenido y test para candidatos.

Detalle técnico completo: `docs/ARQUITECTURA.md`. Leelo antes de tocar el modelo de datos o el flujo de publicación.

## Contexto y decisiones tomadas

- **Sin backend, por decisión.** La app es 100 % cliente y así se queda por ahora. Un backend es un "quizás más adelante": no proponerlo como arreglo ni como requisito.
- **Doble propósito**: herramienta real de capacitación del staff y **pieza de muestra para reclutadores**. Las decisiones de UX y de pulido pesan tanto como la funcionalidad.
- **El login pasa a ser un selector de usuario** (elegir perfil y entrar, sin contraseña), en lugar del formulario actual con credenciales simuladas. Pendiente de implementar en la fase de mejoras.
- En consecuencia, nada de lo relacionado con autenticación, contraseñas en el cliente o persistencia compartida entre dispositivos cuenta como bug: es consecuencia esperada de no tener backend.

## Stack y estructura

- **Un solo archivo**: `index.html` (~210 KB, ~900 líneas) con `<style>` y un único `<script>` inline. Sin framework, sin módulos, JS vanilla. El render es con template strings sobre `innerHTML`.
- `build.js`: toma `index.html`, envuelve el script en una IIFE, lo ofusca (`javascript-obfuscator`) o solo lo minifica (`--light`, terser), minifica el HTML y escribe `dist/index.html`. Si existe `data.json` junto a `build.js`, lo embebe en el anclaje `let PUB=null;`. **Cada paso falla ruidosamente**: si hay más de un `<script>` inline, si el `data.json` no parsea, si el anclaje no está, si el JS generado no parsea o si el HTML construido pierde `<main id="app">`, el build corta con `exit 1` y un mensaje que dice qué arreglar.
- `tests/run.js`: red de seguridad sin dependencias. Extrae el `<script>` de `index.html`, lo corre en Node con stubs de DOM y `localStorage`, y verifica invariantes que ya se rompieron una vez. No cubre la UI: cubre lo que falla en silencio.
- `backup/`: snapshots del contenido (preguntas, platos, etc.) en JSON y CSV. Está en `.gitignore`, no se publica. Ver `backup/LEEME.md`.
- `package.json`: solo devDependencies de build. `dist/`, `node_modules/` y `backup/` no se versionan. `data.json` **sí** se versionaría si existe: decidir en la fase de mejoras si eso se quiere.
- No hay backend, base de datos ni linter.

## Comandos

```
npm install
npm run build        # dist/index.html ofuscado + minificado
npm run build:min    # dist/index.html solo minificado (más fácil de depurar)
npm test             # tests/run.js
```

Correr `npm test` antes y después de cualquier cambio en `index.html`. Es rápido y no necesita `npm install`.

Para desarrollo basta abrir `index.html` directo en el navegador (o servirlo con cualquier servidor estático; `init()` intenta hacer `fetch("data.json")`).

## Modelo mental

Todo el contenido vive en variables globales al inicio del script y se persiste como un único JSON en `localStorage["g250db"]`:

| Var | Qué es |
|---|---|
| `D` | Platos: `{n, c(sección), p(precio), i[ingredientes]}`. Se carga desde strings `"nombre~sección~precio~ing;ing"` |
| `H` | Preguntas escritas a mano `[tema, pregunta, correcta, "mala1|mala2|mala3", explicación]`. Una concatenación grande (línea ~333) agrega preguntas autogeneradas |
| `CATS` | Temas (id → nombre) |
| `PROF` | Equipos (`foh`, `bar`, `kitchen`) con su lista de temas `t` |
| `PR` | Procedimientos (pasos de servicio, listas de mise en place) |
| `FL` | Plano del salón: sección → `[mesa, comensales]` |
| `T`, `O` | Diccionario de términos italianos y reglas "qué ofrecer" por plato |
| `USERS` | Usuarios y roles (`admin` / `user`) |
| `TPL`, `TPS` | Plantilla del test de candidatos |

Otras claves de `localStorage`: `g250st` (estadísticas de rondas), `g250cand` (candidatos), `g250timed`, `snd`, y flags de migración/seed (`g250seed`, `g250cseed`, `g250hmig`).

Flujo de arranque: `init()` → carga `PUB` (embebido o `data.json`) → pisa con `localStorage` si hay ediciones locales → seed de demo si es primera vez → `route()` (`#/test` = test de candidato; si no, login).

## Flujos principales

- **Trivia**: elegir equipo → tema (o "Everything") → 10 preguntas → feedback con explicación → resultado y resumen de errores. Modo cronometrado opcional (20 s). Las opciones se barajan en `start()`.
- **Reportes**: por usuario (rondas, promedio, mejor ronda, temas más débiles, preguntas más falladas). Admin ve a todos.
- **Admin** (solo rol admin): Questions, Topics, Teams, Procedures, Dishes, Floor, Dictionary, Offers, Users, Candidates, Test template, Data. Tablas editables genéricas definidas en el objeto `TC`; Questions y Dishes tienen editores propios.
- **Publicar contenido**: Admin → Data → *Export data.json* → copiar junto a `build.js` → `npm run build` → desplegar `dist/index.html`.
- **Test de candidatos**: `<url>#/test`, sin login, preguntas desde la plantilla, 20 s por pregunta, resultado visible solo para admin.

## Convenciones del código

- Funciones cortas con nombres de 1–3 letras (`$`, `R`, `sh`, `pk`, `fin`, `ic`...). Respetar el estilo existente; no reformatear el archivo entero porque el build y los diffs dependen de él.
- Todo en inglés en la UI y el contenido. La documentación y la conversación con el dueño van en español.
- Los datos que edita un admin pasan por `save()`; cualquier campo nuevo del modelo debe agregarse a `getDB()` y `setDB()` o no se persiste ni se exporta.
- Todo texto de contenido (preguntas, platos, nombres de temas o equipos, nombres de usuario) se escapa con `ESC()` al interpolarlo en HTML. `ESQ` es un alias de `ESC`.
- Cuando se arregla un bug que fallaba en silencio, se agrega el test correspondiente en `tests/run.js`. Un reemplazo o una búsqueda que no encuentra nada tiene que gritar, no seguir de largo.
- Texto de usuario/admin: usar `ESC()` / `ESQ()` al inyectar en HTML.

## Características del diseño actual (no son bugs)

Consecuencias de ser una app sin backend. No "arreglarlas":

- `USERS` viaja dentro del JS y el login valida contra ese objeto. Se reemplazará por un selector de usuario.
- Estadísticas, candidatos y ediciones del admin viven en el `localStorage` de cada navegador. Un candidato que rinde el test en su teléfono no le llega al admin, y los reportes no se comparten entre dispositivos. La vía de publicación de contenido es exportar `data.json` y rebuildear.
- Usuarios demo (`alvaro`, `josefa`, `thais`, `maya`, `fede`) y estadísticas ficticias se siembran si no hay datos. Son deliberados: dan vida a la vista de reportes. Útiles también para la demo a reclutadores.

## Arreglado en la fase 2 (2026-11-23)

Cada uno fue reproducido antes de tocarlo y tiene su test en `tests/run.js`.

1. **Texto sin escapar en el render.** `ESC()` solo escapaba `&` y `<`, y `show()`, `ans()`, `end()`, `cshow()`, `cdone()`, `guide()`, `home()` y `main()` interpolaban contenido crudo. Un plato o pregunta con `<b>` se renderizaba como HTML. Ahora `ESC()` escapa `& < > " '` y se aplica en todas esas vistas.
2. **Pérdida silenciosa en la plantilla del test de candidatos.** `tplQuestions()` resuelve las preguntas por texto exacto, así que editar un enunciado la hacía desaparecer del test sin aviso (verificado: 2 preguntas → 1). Ahora el editor guarda el enunciado original en `q0`, y al guardar sigue los renombres hacia `TPL`, descarta las que se borraron y lo informa en el mensaje. La pantalla de plantilla avisa si quedó alguna entrada irresoluble.
3. **Columna "Type" del banco de preguntas.** Decía "Written" para las 535 porque `qpool()` ponía `w:1` en todas. Se quitó la columna: distinguir escritas de derivadas necesita un flag por pregunta en el modelo.
4. **`build.js` frágil.** Reescrito para fallar ruidosamente (ver arriba). Antes, si el anclaje `let PUB=null;` cambiaba, el build seguía adelante y publicaba un `dist/` sin el contenido.
5. **Código muerto.** Se eliminaron `TABS`, el objeto `ED` completo (13 líneas, inalcanzable porque `admin()` desvía todas las pestañas antes), el estado `ed`, el helper `cl`, `dbSaved`, el handler del `<select id="sel">` y las ramas `t:` y `save` de `adm()`.

## Deuda técnica pendiente

1. **412 de las 535 preguntas están congeladas.** Solo 123 están escritas a mano; el resto son derivadas del menú, el mise en place y el plano ("qué ingrediente lleva X"), y viven como literal dentro de `index.html`. La app **no las regenera**: `gen()` solo filtra `H`. Si se edita un plato en Admin, esas preguntas quedan desactualizadas y nadie se enterá. Es el problema de contenido más grande que queda y conviene resolverlo junto con el modelo de datos del backend.
2. **`H` es ilegible en diffs**: las preguntas derivadas son ~98 KB en una sola línea.
3. **El modelo no distingue el origen de una pregunta.** Un flag `origin` (escrita / derivada) habilitaría de nuevo la columna del banco y la regeneración selectiva. El backup en `backup/` ya trae ese dato para las 535 actuales.
4. **`data.json` se versionaría si existe.** Decidir si se commitea como contenido o se ignora.

## Flujo de mejora acordado

1. Análisis y documentación (este archivo + `docs/ARQUITECTURA.md`) ✅
2. Corrección de bugs existentes ✅ (ver arriba)
3. Análisis de mejoras y priorización ← acá estamos
4. Implementación de las mejoras elegidas

Ya decidido y pendiente de implementar en la fase 4: el login pasa a selector de usuario.

Al trabajar en una fase, no avanzar a la siguiente sin confirmación. Mantener este archivo actualizado cuando cambie la estructura, los comandos o el modelo de datos.
