# Análisis de mejoras - staff-trainer

Fase 3 del flujo acordado. Escrito el 2026-11-23, después de documentar la app y arreglar
los bugs de la fase 2. Ordenado por valor sobre esfuerzo, no por orden de descubrimiento.

## El hallazgo que reordena todo

Rastreando qué consume cada estructura de contenido, el resultado es este:

| Contenido | Cuánto hay | Quién lo lee hoy |
|---|---|---|
| `D` platos | 67, con sección, precio e ingredientes | el editor de Admin y el helper `pl()` |
| `PR` procedimientos | 26 pasos de servicio + 26 tareas de mise en place | solo el editor de Admin |
| `T` diccionario | 16 términos italianos | solo el editor de Admin |
| `O` qué ofrecer | 9 reglas por plato | solo el editor de Admin |
| `W` vinos | 5, con región, notas de cata, pitch de venta y ocasión | **nadie** |
| `FL` salón | 5 secciones, 25 mesas | el editor de Admin y `guide()` |
| `H` preguntas | 535 | el quiz |

O sea: la app es un quiz sobre el contenido, más una guía de salón. **El contenido en sí es
invisible para la gente que lo necesita en el turno.** Un mozo que quiere saber qué lleva la
Mantovana, o cuál es el paso que sigue en el servicio, o qué decir para vender el Shiraz, no
tiene dónde mirarlo. Y el cheatsheet de vinos, que es el contenido más trabajado del archivo
(notas de cata y pitch de venta escritos a mano), no está conectado a ninguna pantalla.

Esto no es una falta de features: es contenido ya escrito y pagado que no se muestra. Es el
mejor retorno disponible y además mejora la demo, porque le da al reclutador más que clickear.

## Tier 1 - Alto valor, bajo esfuerzo

### 1.1 Pantallas de consulta para el contenido existente  ✅ HECHO (2026-11-23)
Menú buscable (por plato y por ingrediente, que es lo que se necesita cuando preguntan por
una alergia), glosario, pasos del servicio, mise en place por equipo, cheatsheet de vinos.
El patrón ya está escrito en `guide()`: una pantalla que lee una estructura y la pinta en
tarjetas. Convierte la app de "quiz que hago una vez" en "app que abro durante el turno",
que es un cambio de categoría, no de grado.

### 1.2 `store.set` se come los errores, así que "Saved" puede ser mentira  ✅ HECHO (2026-11-23)
```js
const store={set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
```
`save()` no devuelve nada y Admin igual muestra "Saved 535 questions." Si `localStorage` está
lleno o deshabilitado (Safari en privado, iOS con el almacenamiento restringido), el admin cree
que guardó y perdió el trabajo. Es exactamente la familia de bug que arreglamos en la fase 2:
una operación que falla y sigue de largo. Arreglo: que `store.set` devuelva un booleano, que
`save()` lo propague y que los mensajes digan la verdad.

### 1.3 "Repasar lo que fallé"  (esfuerzo: S, impacto: alto)
`stats[].m` ya guarda hasta 10 preguntas falladas por ronda, y Reports ya muestra las más
repetidas. Falta el botón que arma una ronda con ellas. Es la mejora pedagógica más grande
por el menor esfuerzo: sin esto, el que falla las mismas seis preguntas las sigue fallando.

### 1.4 README del repo  ✅ HECHO (2026-11-23, falta screenshot y link a la demo)
Para el objetivo "pieza de muestra", la puerta de entrada es GitHub, no la app. Hoy el repo
es un `index.html` de 210 KB y nada que lo explique. Con un screenshot, el link a la demo, el
porqué del archivo único y una mención al build y a los tests, la lectura cambia por completo.
Es lo más barato de esta lista y probablemente lo que más mueve la aguja de ese objetivo.

### 1.5 Selector de usuario + pantalla de bienvenida  ✅ HECHO (2026-11-23)
Ya decidido para la fase 4. Vale agregarle lo que falta alrededor: un reclutador que entra
necesita saber en diez segundos qué está mirando, quién lo hizo y qué conviene clickear. Y un
botón de "restaurar la demo" visible, para que pueda tocar Admin sin miedo (hoy existe
"Discard local edits", pero está escondido en Data y es solo para admins).

## Tier 2 - Valor alto, esfuerzo medio

### 2.1 Regenerar en runtime las 412 preguntas derivadas  (esfuerzo: M/L, impacto: alto)
Mata tres problemas de una: se desactualizan solas cuando cambia un plato, son ~98 KB en una
sola línea que hace ilegible cualquier diff, e `index.html` bajaría casi a la mitad.
La pista de que esto existió está en el código: `MR`, una regex de carnes y pescados, quedó
declarada y sin usar, y es justo lo que generaría el tema "Meat or not?" (que hoy tiene 2
preguntas congeladas). Riesgo: el texto exacto de esas 412 va a cambiar. El backup en
`backup/` cubre eso.

### 2.2 Routing real por hash  (esfuerzo: M, impacto: medio)
Hoy solo `#/test` está ruteado; el resto es estado en memoria. No hay deep links, el botón
atrás no funciona y un refresh te devuelve al login. Importa para mandarle a alguien un link
a una pantalla concreta, y se lee como calidad de ingeniería.

### 2.3 PWA: manifest + service worker  (esfuerzo: M, impacto: medio/alto)
Instalable en el teléfono del staff y funcionando sin señal dentro del local, que es donde se
usa. Encaja naturalmente con el archivo único y es de las cosas que mejor se ven en una demo.

### 2.4 Modo turno: los procedimientos como checklist  (esfuerzo: M, impacto: medio/alto)
Los `PR` como lista tildeable con progreso, no como trivia. Depende de 1.1 y lo completa: la
diferencia entre estudiar el mise en place y usarlo.

## Tier 3 - Esfuerzo alto o decisión de fondo

- **Flag `origin` por pregunta y modelo pensado para multitenant.** Va con el backend. El
  backup ya trae el dato para las 535 actuales.
- **Accesibilidad**: al cambiar de pantalla, `app.innerHTML=` borra el foco y no lo mueve, así
  que quien usa lector de pantalla pierde el lugar. Revisar también contraste de `--mu`.
- **Podar `stats`** en `localStorage`: crece sin techo, con hasta 10 textos de preguntas por
  ronda. Hoy no molesta, con uso real sí.
- **Código muerto restante**: `MR`, `CT`, `CN` quedaron declarados sin uso (`CT`/`CN` son del
  test de candidatos viejo, reemplazado por `TPL`/`defTpl`). `MR` conviene no borrarlo si se
  hace 2.1, porque es parte del generador.

## La tensión del objetivo "pieza de muestra"

Hay que decirlo derecho, porque es la decisión más incómoda de esta lista. Alguien técnico que
abra `index.html` va a leer `let D=[...]`, `const $=s=>...`, `H`, `TC`, `pk`, `sh`, `fin`. Para
un dev que aplica a puestos, eso puede leerse como "no sabe estructurar código" en lugar de
"eligió una restricción a propósito". Tres caminos:

1. **Dejarlo y explicarlo en el README.** Costo cero. Funciona si el lector llega al README
   antes que al código, que no está garantizado.
2. **Renombrar solo las ~15 estructuras globales** (`D`→`DISHES`, `H`→`QUESTIONS`,
   `PROF`→`TEAMS`, `CATS`→`TOPICS`...), dejando los helpers cortos. Es mecánico, son muchos
   call sites pero todos cubiertos por `getDB`/`setDB` y por los tests. Sin ganancia funcional.
3. **Partir en módulos con un build que concatene.** Contradice la restricción del archivo
   único y es el más caro de los tres.

Recomendación: 2 más 1. El archivo único es defendible y hasta interesante como decisión; los
nombres de una letra no lo son.

Vale notar algo relacionado: el activo más fuerte que tiene hoy el proyecto para ese objetivo
no es una feature, es lo que lo rodea. Un build reproducible que falla ruidosamente, una suite
de tests que ataja fallos silenciosos, la arquitectura documentada y un backup del contenido.
Eso es lo que separa esto de un proyecto de fin de semana, y el README debería ponerlo adelante.

## Las próximas tres, si hay que elegir

Las tres recomendadas (1.1, 1.2, 1.4 y 1.5) están hechas. Lo que sigue:

1. **1.3 "Repasar lo que fallé".** Barato y es la mejora pedagógica más grande que queda.
2. **2.1 Regenerar las preguntas derivadas.** Desbloquea poder editar el menú sin que el
   contenido quede inconsistente, y baja el archivo a la mitad.
3. **La decisión sobre los nombres de los identificadores** (ver la sección de la tensión), que
   conviene tomar antes de 2.1 para no renombrar dos veces.

También quedó pendiente de 1.1 una decisión que tomé y conviene revisar: **no puse ninguna
etiqueta automática de "sin carne" o "vegetariano" en el menú**. La regex `MR` podría generarla,
pero una etiqueta derivada que se equivoca en una app que usa el mozo para contestarle a un
comensal con una restricción es un riesgo que no vale el ahorro. El buscador por ingrediente
cubre el caso real sin afirmar nada: el mozo busca "prawn" y ve qué platos lo listan.
