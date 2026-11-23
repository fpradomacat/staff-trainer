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
- `build.js`: toma `index.html`, envuelve el script en una IIFE, lo ofusca (`javascript-obfuscator`) o solo lo minifica (`--light`, terser), minifica el HTML y escribe `dist/index.html`. Si existe `data.json` junto a `build.js`, lo embebe reemplazando el literal `let PUB=null;`.
- `package.json`: solo devDependencies de build. `dist/`, `node_modules/` y `data.json` no se versionan según `.gitignore` (verificar: `data.json` no está en `.gitignore`).
- No hay backend, base de datos, tests ni linter.

## Comandos

```
npm install
npm run build        # dist/index.html ofuscado + minificado
npm run build:min    # dist/index.html solo minificado (más fácil de depurar)
```

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
- Texto de usuario/admin: usar `ESC()` / `ESQ()` al inyectar en HTML.

## Limitaciones conocidas (a confirmar en la fase de bugs)

Observadas leyendo el código, todavía sin reproducir:

1. **Autenticación solo en el cliente**: `USERS` con contraseñas en texto plano viaja dentro del JS (`admin/admin`, `test/test` por defecto) y el login prellena `test/test`. El "Contacting server..." es un `setTimeout` falso.
2. **Persistencia por navegador**: estadísticas, candidatos y ediciones del admin están en `localStorage`. Un candidato que rinde el test en su teléfono no le llega al admin; los reportes no se comparten entre dispositivos.
3. **Preguntas/opciones inyectadas sin escapar** en `show()`, `cshow()` y otras vistas; solo algunas partes usan `ESC`.
4. **Código posiblemente muerto**: `TABS` y `ED.f/dict/off` parecen haber sido reemplazados por `TC`; `dbSaved` en `init()` no se usa.
5. `build.js` depende de que exista exactamente un `<script>` y del literal `let PUB=null;`.
6. Usuarios demo (`alvaro`, `josefa`, `thais`, `maya`, `fede`) y estadísticas ficticias se siembran si no hay datos.

## Flujo de mejora acordado

1. Análisis y documentación (este archivo + `docs/ARQUITECTURA.md`) ✅
2. Corrección de bugs existentes
3. Análisis de mejoras y priorización
4. Implementación de las mejoras elegidas

Al trabajar en una fase, no avanzar a la siguiente sin confirmación. Mantener este archivo actualizado cuando cambie la estructura, los comandos o el modelo de datos.
