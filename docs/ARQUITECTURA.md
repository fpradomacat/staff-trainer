# Arquitectura de staff-trainer

Documento de referencia generado al analizar `index.html` (898 líneas) y `build.js`. Los números de línea son aproximados y cambian con las ediciones.

## 1. Mapa de `index.html`

| Líneas | Contenido |
|---|---|
| 1–128 | `<head>`, CSS inline (variables en `:root`, layout `#shell` con sidebar, responsive a 800 px, `prefers-reduced-motion`) |
| 131 | `<main id="app">` (único nodo de render) |
| 134–206 | **Datos**: `D` (platos, strings `~`/`;`), `S` (nombres de pizzas ↔ pecados capitales) |
| 208–332 | **`H`**: preguntas a mano por tema |
| 333 | `H=H.concat([...])` ~98 KB de preguntas generadas (ingredientes, precios, etc.) |
| 336–349 | `T` (diccionario), `O` (ofertas), `K`/`MISE` (mise en place), `MR` (regex de carnes), `FLOW`, `FL` (salón) |
| 350–365 | `W` (vinos), motor: `CATS`, helpers (`$`, `R`, `sh`, `pk`), `store`, sonido (`beep`, `tick`), `gen(cat)` |
| 366–445 | Íconos, `USERS`, navegación (`page`, `main`, `enter`, `go`), login, `seedDemo`, `home`, `guide` |
| 446–473 | `SEC`, `PROF`, migraciones (`mig`), `getDB`/`setDB`/`save`, `init`, `route` |
| 474–520 | Test de candidatos (`cand`, `cstart`, `cshow`, `csel`, `cnext`, `cdone`) y `start()` del quiz |
| 521–581 | Admin: editor de texto `ED`, editor de platos (`dishes`, `drows`, `dact`) |
| 582–620 | Editor de preguntas (`questions`, `qrows`, `qact`), `fin`/`pl`/`cap` (normalización de respuestas) |
| 622–708 | Editor genérico de tablas `TC` (users, floor, topics, teams, procedures, items, dict, offers) |
| 709–791 | Candidatos y plantilla de test (`defTpl`, `tplQuestions`, `tpl`, `candSave`, `cands`) |
| 792–816 | Reportes (`summ`, `reports`, `rlist`, `rview`) |
| 817–849 | `admin()`, Data (export/import/discard), `adm`, `root.onchange` |
| 850–896 | Timer (`tmStart`/`tmStop`), quiz (`show`, `ans`, `end`), handlers globales (`root.onclick`, `onkeydown`), `init()` |

## 2. Modelo de datos

`getDB()` serializa `{v:1, D, H, T, O, FL, PR, TO:CATS, TM:PROF, U:USERS, TP:TPL, TS:TPS}`. Ese objeto es:

- lo que se guarda en `localStorage["g250db"]` (`save()`),
- lo que exporta el botón *Export data.json*,
- lo que `build.js` embebe como `PUB`,
- la base del "Discard local edits" (`SEED` = estado inicial del código, o `PUB` si existe).

Orden de precedencia al iniciar: datos del código < `PUB` (data.json / embebido) < `localStorage`.

Estructuras:

```
D[]   {n, c: pizza|pasta|ante|mains|dessert|bar|spritz, p, i: string[]}
H[]   [tema, pregunta, correcta, "mala1|mala2|mala3", explicación]
CATS  {id: "Nombre visible"}   // "all" siempre presente
PROF  {id: {n, d, t: string[] temas}}
PR[]  {id, n, k: "steps"|"list", tm: string[] equipos, it: [{g: área, t: texto}]}
FL    {sección: [[mesa, personas], ...]}
USERS {usuario: {p, role, n, tm}}
TPL[] {c: tema, q: texto de la pregunta}   // referencia a H por texto
stats [{u, p, c, s, t, d, m: preguntas falladas}]   // g250st
CANDS [{id, n, m, r, ans..., st}]                    // g250cand
```

Las preguntas del test de candidatos se resuelven buscando por **texto exacto** en `H` (`tplQuestions`): si se edita el texto de una pregunta, desaparece de la plantilla.

## 3. Generación de una ronda

`start()`:
1. Si el tema es `all`, toma 3 preguntas al azar por cada tema del equipo; si no, todas las del tema (`gen(cat)` filtra `H`).
2. `fin()` normaliza respuestas (mayúscula inicial, nombres de pizzas con " pizza" y pecado capital entre paréntesis).
3. Baraja opciones, descarta preguntas con opciones repetidas o sin la correcta, corta a 10.

`ans(k)` registra acierto/error, muestra explicación; `end()` guarda la ronda en `stats` (solo si hay usuario).

## 4. Roles y navegación

- `user.role == "admin"`: ve todo el menú. `user` con `tm`: solo su equipo en Trivia.
- `go(n)` pide confirmación al abandonar editores con cambios sin guardar (`te.dirty`, `tpd`, `qc`, `dc`).
- Ruta `#/test` se evalúa en `route()` antes del login.

## 5. Publicación

```
Admin → Data → Export data.json
copiar data.json al lado de build.js
npm run build            → dist/index.html
```

`build.js` busca `/<script>([\s\S]*?)<\/script>/` (primer `<script>`), reemplaza `let PUB=null;` por `let PUB=<json>;`, envuelve en IIFE, ofusca/minifica y minifica el HTML. Si el JSON es inválido el build falla.

## 6. Riesgos y deuda técnica detectados

Pendientes de verificar en la fase 2 (bugs):

- Credenciales y roles en el cliente (`USERS`), login con delay simulado, sin sesión persistente.
- Estadísticas, candidatos y ediciones atadas al navegador; no hay sincronización.
- Inyección HTML sin escapar en vistas de quiz/test.
- Mezcla de editores viejos (`ED`, `TABS`) y nuevos (`TC`).
- `H` mezcla preguntas a mano y autogeneradas en un literal de ~98 KB en una sola línea; difícil de diffear.
- Test de candidatos: la pantalla "Submitting your answers..." es un `setTimeout`; el resultado solo existe en el `localStorage` del dispositivo del candidato.
- `data.json` se espera junto a `build.js` pero no está en `.gitignore`: puede terminar versionado con usuarios y contraseñas.
- Sin tests automáticos; cualquier cambio se prueba a mano.
