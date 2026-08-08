# CLAUDE.md — Cine y Géneros

Contexto completo del proyecto para Claude Code. Leé este archivo antes de hacer cualquier cambio.

---

## Qué es este proyecto

**Cine y Géneros** es una app web para que investigadores analicen géneros cinematográficos usando un método propio basado en la teoría de Simondon.

El método: el investigador selecciona una muestra representativa de películas de un género, define **diferenciales** (tensiones narrativas binarias, ej: Cuerpo/Máquina), asigna a cada película un valor dentro del rango ±max del campo en cada diferencial, y calcula la **metaestabilidad** (`promedio(|valores|)` de los diferenciales activos — escala 0 a `field.max`). Las películas con metaestabilidad alta son "transformadoras" del género; las de baja son "estables".

La versión actual es **v6.40**.

---

## Stack técnico

- **Node.js / Express** — servidor en `server.js`, desplegado en Railway
- **HTML + JS + CSS** — frontend en `index.html` (sin framework, sin build system)
- **PostgreSQL** — base de datos (provisión Railway), accedida vía `pg` Pool
- **Google OAuth 2.0** — autenticación vía Passport.js (`passport-google-oauth20`)
- **express-session + connect-pg-simple** — sesiones persistidas en tabla `session`
- **Chart.js 4.4.1** — todos los gráficos
- **TMDB API** — datos de películas (géneros, discover, detalles)
- **lib/logic.js** — módulo CommonJS con funciones puras de cálculo; cargado como `<script>` en el browser (globals) y `require()`d en tests Jest
- **Jest** — suite de tests unitarios en `tests/logic.test.js` (43 tests), ejecutar con `npm test`
- **Google Fonts** — DM Sans + DM Mono

**TMDB API Key (Bearer token):**
```
eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MmRhYWUyNWE0MGIzNzA2NjgyNGFkODVmZmJjNzA5OSIsIm5iZiI6MTc3NjcyMDg5Ny4zNjIsInN1YiI6IjY5ZTY5YzAxOWY5YzU1ZTFjNjY5MzVmOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.GfwS7LwX_ZB4RO1Pln5N1O8KQ2q8fqIz1-hl7xDJ5s0
```

Siempre se usa como `Authorization: Bearer <token>` en los headers. Base URL: `https://api.themoviedb.org/3`.

---

## Estructura de archivos

```
/
├── server.js          — Express + Auth + API endpoints
├── index.html         — Frontend completo (JS inline, CSS inline)
├── login.html         — Página de login pública
├── help.html          — Centro de ayuda (artículos + release notes)
├── lib/
│   └── logic.js       — Funciones puras exportadas (CommonJS + globals)
├── tests/
│   └── logic.test.js  — Jest: 43 tests unitarios
├── help-img/          — Imágenes para help.html
├── package.json       — Dependencias + script "test": "jest"
└── CLAUDE.md          — Este archivo
```

---

## Backend: server.js

### Base de datos (PostgreSQL)

Tablas:

| Tabla | Propósito |
|---|---|
| `users` | Usuarios autenticados (google_id, email, name, picture, last_login) |
| `session` | Sesiones express (connect-pg-simple) |
| `shared_state` | Estado único compartido por todos los usuarios — **una sola fila** (id=1) |
| `activity_log` | Registro de acciones por usuario |

`shared_state` tiene `CONSTRAINT single_row CHECK (id = 1)` y guarda el JSON completo de `{ fields: [] }`. Todos los usuarios ven y modifican el mismo espacio de trabajo (aislamiento por tenant, no por usuario).

### Endpoints API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/auth/google` | Inicia flujo OAuth |
| `GET` | `/auth/google/callback` | Callback OAuth, redirige a `/` |
| `GET` | `/auth/logout` | Cierra sesión |
| `GET` | `/auth/me` | Devuelve `{ id, name, email, picture }` del usuario actual |
| `GET` | `/api/state` | Devuelve `shared_state.data` (requiere auth) |
| `PUT` | `/api/state` | Reemplaza `shared_state.data` con el body (requiere auth) |
| `GET` | `/api/users` | Lista todos los usuarios (requiere auth) |
| `POST` | `/api/activity` | Registra una acción en `activity_log` (requiere auth) |
| `GET` | `/api/users/:id/activity` | Historial de acciones del usuario (requiere auth) |

`login.html` y `help.html` son públicos. El resto de archivos estáticos requieren auth.

### lib/logic.js — funciones exportadas

| Función | Qué hace |
|---|---|
| `minSampleForTarget(counts, target)` | Mínimo N para que el overlap L1 de una distribución supere `target` |
| `calculateMinSample(field)` | Mínimo sugerido de muestra: max de todos los mínimos por variable + piso por décadas activas, cap en 80% del universo |
| `l1Overlap(a, b)` | Overlap L1 entre dos distribuciones (suma de mínimos normalizados), rango [0,1] |
| `cosineSimilarity(a, b)` | Similitud de coseno, clampeada a [0,1] |
| `calculateRepIndex(f)` | Índice de representatividad de décadas: `l1Overlap(univCounts, sampleCounts) × sizeFactor` |
| `calcMet(film, diffs)` | Metaestabilidad: `promedio(|valor|)` de los diferenciales activos con rating — escala 0 a `field.max` |
| `calClassify(film, totalDiffs)` | Estado de calificación: `'pending'` / `'inProgress'` / `'done'` |
| `fmtRevenue(r)` | Formatea ingresos: `'$150M'`, `'$2.5B'`, `'—'` |

---

## Arquitectura de pantallas

La app tiene **3 pantallas** (`screen-home`, `screen-new-field`, `screen-field`) con `position: fixed; top: 46px; inset: 0; overflow-y: auto`. Solo la activa tiene clase `active`.

### Header global (siempre visible, `position: fixed; top: 0; height: 46px`)
- Logo "Cine y Géneros" + badge TMDB + avatar de usuario (menú: perfil, otros usuarios, historial, logout)

### Pantalla 1 — Home (`screen-home`)
- Lista de campos en tabla
- Columnas: Nombre, Género, Campo (total universo), Diferenciales, Calificación (barra progreso + X/Y), Estado (badge)
- Botón "+ Nuevo" en header2

### Pantalla 2 — Nuevo campo (`screen-new-field`)
- Layout 50/50: izquierda = formulario, derecha = vista previa (scrollable independiente)
- **Formulario:** Nombre, Género (carga dinámica desde TMDB), Mínimo de votos, Décadas inicio/fin, Países (multiselect con búsqueda — carga desde `/configuration/countries`), Excluir géneros secundarios (chips dinámicos, ninguno excluido por defecto), Toggle películas fuera de clasificación TMDB
- **Vista previa:** botón "Cargar datos" (a demanda, no automático), stat card con total, 5 gráficos: décadas, taquilla promedio top40, rating (horizontal invertido), géneros secundarios (horizontal), países (horizontal)
- Al crear el campo, si no se cargaron los gráficos manualmente, el sistema los genera automáticamente antes de guardar (auto-cache)
- Una vez creado el campo, los parámetros del universo quedan bloqueados para siempre

### Pantalla 3 — Campo (`screen-field`)
- Header2: nombre del campo + botón Renombrar + botón Cerrar
- 6 tabs: Descripción, Muestra, Diferenciales, Calificación, Calificación detallada, Análisis

#### Tab Descripción
- 6 stat cards: Género, Total películas, Rating promedio, Votos mínimos, Décadas, Países
- Sección "Distribución por décadas": gráfico cantidad (barras verticales) + taquilla promedio top40 por década (barras verticales)
- Sección "Distribución por categoría": géneros secundarios top10 (horizontal, 280px alto) + países top10 (horizontal, 280px alto)
- Sección "Distribución de scores": rating (horizontal invertido 9-10 arriba) + votos (barras)
- Los gráficos se renderizan desde el **cache snapshot** guardado al crear el campo (no hacen llamadas TMDB en tiempo real)
- Todos los conteos escalados al universo total con factor `universeTotal / (páginas * 20)`

#### Tab Muestra
- 3 stat cards: Mínimo sugerido, Tamaño elegido, Sin calificar
- Slider + input para tamaño de muestra (libre, el investigador decide)
- Buscador + tabla paginada (20 por página) con orden por columna
- Botón "Generar" (grisado si no hay cambios pendientes) + "+" Agregar película
- Sección expandible (por defecto expandida): distribución comparativa campo vs muestra con índice de representatividad por variable (décadas, rating, votos, géneros, países, taquilla)

#### Tab Diferenciales
- Lista reordenable con drag & drop
- Editor lateral: nombre, polo−, polo+, **RANGO ±** (input numérico para `field.max`, aplica a todos los diferenciales del campo — default 3, máximo 20), descripción, progreso de calificación
- Botón importar de otro campo

#### Tab Calificación
- Sidebar: buscador por título + lista de pendientes / en progreso / calificadas (secciones colapsables)
- Área principal: poster TMDB + metadata + sliders −max a +max por diferencial
- Cada diferencial tiene un toggle de activación (●) y un textarea de descripción editable inline que auto-guarda al tipear
- Metaestabilidad calculada en tiempo real (escala 0 a `field.max`)
- Navegación anterior/siguiente + guardar

#### Tab Calificación detallada
- Sidebar: buscador por título + secciones colapsables PENDIENTES / CALIFICADAS (igual que Cal. general)
- Cronómetro por película: ▶ Reanudar / ⏸ Pausar / ↺ Reiniciar; muestra tiempo acumulado en mm:ss
- Flujo de períodos por diferencial:
  - Al pausar, en cada diferencial expandido aparece el panel de creación de período, **de forma independiente por diferencial** (crear un período en un diferencial no afecta los paneles de los demás)
  - El panel muestra `from` (último `to` de los períodos existentes en ESE diferencial, o 0) → `to` (minuto actual del cronómetro), slider de valor
  - Mientras el cronómetro corre, los botones de acción quedan deshabilitados (los inputs sí son editables)
  - El campo "fin" se marca en rojo si ≤ inicio
  - No se muestra panel si los períodos de ESE diferencial ya cubren hasta el minuto actual
- **Agregar manual**: siempre disponible; abre un panel con campos de inicio/fin/valor para insertar un período arbitrario
- Los períodos se muestran como filas editables con mini-timeline visual; se pueden borrar o editar sus límites (modal si hay solapamiento con el período adyacente)
- Botón "Cerrar diferencial": extiende el último período hasta el runtime del film
- Botón "Cerrar diferenciales": aplica lo anterior a todos los diferenciales de una vez
- Botón "⊞ Ver mapa de calor": modal con:
  - Gráfico de **metaestabilidad global** (área escalonada): segmentos cuya altura = `met/field.max`, coloreados con la paleta warm, línea punteada amber = índice global ponderado por tiempo
  - **Tooltip** al hacer hover sobre el gráfico: minuto, índice en ese momento, valores de cada diferencial activo
  - Filas de diferenciales (timeline de períodos coloreados)
  - Eje Y relativo a `field.max`; leyenda con entrada para línea punteada
- Cada diferencial tiene un textarea de descripción editable inline que auto-guarda al tipear
- **Cal. detallada es completamente independiente de Cal. general**: `detailedRatings` no escribe en `film.ratings`, no afecta los sliders ni la metaestabilidad de Cal. general
- La tab se oculta en mobile (sin soporte responsive)

#### Tab Análisis
- 4 stat cards: calificadas, met. promedio, transformadoras (>1.8), diferenciales
- Ranking top 15 por metaestabilidad (barras horizontales)
- Evolución por década (líneas)
- Mapa de calor diferenciales × décadas (HTML, no canvas)
- Radar comparativo 2 películas (selectores dinámicos)

---

## Estado del appState

```js
appState = {
  fields: [],                 // array de campos (persiste en PostgreSQL via /api/state)
  currentFieldId: null,
  samplePage: 1,
  sampleSort: { col: 'year', dir: 'asc' },
  sampleFilter: '',
  sampleGenreFilter: '',
  previewCache: null,         // snapshot del universo durante la creación
  previewChart: null,
  previewVotesChart: null,
  descCharts: {},
  distCharts: {},
  analysisCharts: {},
  regenOpts: { manual: true, rated: true },
  selectedFilmToAdd: null,
  currentCalFilm: null,
  calFilter: '',
  calCollapsed: { pending: false, inProgress: false, done: false },
  addFilmTimeout: null,
  currentDetailFilm: null,    // id de la película activa en Cal. detallada
  detailExpanded: {},         // { [diffId]: boolean } — diferenciales expandidos en Cal. detallada
  detailManualCreate: {},     // { [diffId]: boolean } — panel "Agregar manual" abierto
  detailChronoFilmId: null,   // id de la película cuyo cronómetro está corriendo
  detailOpenPeriods: {},      // { [diffId]: { filmId, from, value } } — períodos abiertos por diferencial
  detFilter: '',              // filtro de búsqueda sidebar Cal. detallada
  detCollapsed: { pending: false, done: false },
}
```

**Persistencia:** `appState.fields` se sincroniza con PostgreSQL en `shared_state` (fila única, compartida por todos los usuarios). Al iniciar, se hace `GET /api/state`; al guardar, `PUT /api/state`.

**Estructura de un campo:**
```js
{
  id: 'f_' + Date.now(),
  name: string,
  genreId: number,
  votes: number,
  decFrom: number,
  decTo: number,
  excludedGenres: [],
  countries: [],          // vacío = todos
  allowOutside: boolean,
  universeTotal: number,
  minSuggested: number,
  sampleSize: number,
  max: number,            // rango ± de los diferenciales; default 3, máximo 20; aplica a todos los diffs del campo
  cache: {                // snapshot del universo al momento de crear el campo
    decadesCounts: [],    // conteo de películas por década (escala real)
    ratingBuckets: [],
    voteBuckets: [],
    genreTop10: [[name, count], ...],
    countryTop10: [[name, count], ...],
    avgRevenueByDecade: {},
  },
  sample: [
    {
      id: number,
      title: string,
      year: number,
      votes: number,
      rating: number,
      revenue: number,
      country: string,
      genreIds: [],
      ratings: {},        // { diffId: value } — poblado por Cal. general; Cal. detallada NO escribe aquí
      activeRatings: {},  // { diffId: boolean } — qué diffs cuentan hacia la metaestabilidad; ausente = legacy (todos los rateados cuentan)
      detailedRatings: {  // poblado por Cal. detallada — completamente independiente de ratings
        // key: diffId
        'd_xxx': {
          periods: [{ id: 'p_'+Date.now(), from: 0, to: 50, value: null }], // from/to en minutos
          weightedValue: null,  // Σ(value×(to-from))/runtime redondeado a 1 decimal; null si algún período sin calificar
          complete: false,      // true cuando todos los períodos tienen valor non-null (no requiere cobertura total)
        }
      },
      chronoTime: 0,      // segundos acumulados del cronómetro en Cal. detallada
      runtime: null,      // minutos, de TMDB GET /movie/{id} → runtime; configurable manualmente
      _detailPosterPath: string,  // poster_path de TMDB, buscado al abrir por primera vez en Cal. detallada
      calRelations: {},   // { diffId: [diffId, ...] } — relaciones entre diferenciales en Cal. general
      detailRelations: {},// { diffId: [diffId, ...] } — relaciones entre diferenciales en Cal. detallada
      detailNotes: {},    // { diffId: string } — notas por diferencial en Cal. detallada (textarea inline)
      manual: boolean,
      manualReason: string,
    }
  ],
  differentials: [
    {
      id: 'd_' + Date.now(),
      name: string,
      negPole: string,
      posPole: string,
      desc: string,       // descripción editable inline en Cal. general y Cal. detallada
    }
  ],
  createdAt: string,
}
```

**Migración de campos viejos:** al cargar el estado, `_migrateFields` asigna `f.max` desde `f.differentials[0].negMax` si no existe (compatibilidad con campos creados antes de v6.33).

---

## Algoritmo de muestreo (implementación actual)

### Tamaño mínimo sugerido

Calculado por `calculateMinSample(field)` en `lib/logic.js`. Para cada variable con distribución en el cache (décadas, buckets de rating, buckets de votos, top10 géneros, top10 países), calcula cuántas películas N hacen falta para que el overlap L1 supere 0.95. El resultado es el máximo de todos esos mínimos, con:
- Piso: `décadas_activas × 10` (cada década activa necesita al menos 10 películas para tener páginas con spread suficiente)
- Cap: `min(resultado, universeTotal × 0.8)`

### Generación de la muestra

La asignación de películas por década funciona así:
1. Se calculan **slots proporcionales** al universo: `slots_decade = universe_proportion × sample_size`
2. Se descuentan las películas ya **bloqueadas** (manuales + calificadas) en esa década: `remaining = max(0, slots_decade − locked_in_decade)`
3. Se normalizan los restantes para sumar `toFetch` (las que quedan por buscar)
4. Para cada década, se buscan páginas aleatorias de TMDB con `sort_by=original_title.asc` para obtener spread (no solo las más votadas)

**No hay distribución 60/40 implementada.** El muestreo actual es aleatorio dentro de cada década via páginas aleatorias de TMDB.

### Índice de representatividad

Calculado en la función `renderDistribution` (inline en `index.html`) + `calculateRepIndex` (`lib/logic.js`).

Para cada variable:
```
índice_variable = l1Overlap(distribución_universo, distribución_muestra)
```

Luego se aplica un **factor de tamaño**:
```
sizeFactor = min(1, n_muestra / minSuggested)
índice_penalizado = índice_variable × sizeFactor
```

El `sizeFactor` penaliza muestras pequeñas aunque accidentalmente tengan buena distribución. Con 1 película de 11 décadas posibles, el índice da ~1.8% (no ~9%), porque la penalización por tamaño es proporcional.

El índice global es el promedio de los 6 índices penalizados (décadas, rating, votos, géneros, países, taquilla).

---

## Escala de colores (mapas de calor)

La función `warmCell(intensity)` mapea un valor 0→1 a un color RGB:
- 0.00 → gris `rgb(34,34,38)`
- 0.33 → amber `rgb(212,130,32)`
- 0.67 → naranja-rojo `rgb(190,60,18)`
- 1.00 → rojo oscuro `rgb(122,14,8)`

Se usa siempre con `Math.abs(val) / 3` como entrada (hardcodeado a 3, no a `field.max`), para que la escala de colores sea consistente entre campos con distintos rangos. Aplica en:
- Tab Análisis: mapa de calor diferenciales × décadas
- Cal. detallada: mini-timeline y filas de períodos en el mapa de calor modal
- Cal. detallada: gráfico de metaestabilidad global en el mapa de calor modal

---

## TMDB endpoints usados

- `GET /genre/movie/list?language=es` — lista de géneros
- `GET /configuration/countries` — lista de países ISO
- `GET /discover/movie?with_genres=X&vote_count.gte=Y&sort_by=Z&page=N` — universo y muestreo
- `GET /movie/{id}` — detalles (revenue, budget, production_countries, poster_path, runtime)
- `GET /search/movie?query=X&year=Y` — búsqueda para agregar películas manualmente

**Parámetros de discover usados:**
- `with_genres` — género principal
- `without_genres` — géneros secundarios excluidos + géneros del campo si `allowOutside = false`
- `vote_count.gte` — mínimo de votos
- `primary_release_date.gte / .lte` — rango de décadas
- `sort_by` — `vote_count.desc` (para totales), `original_title.asc` (para muestreo con spread)
- `with_origin_country` — filtro de país (**limitación:** solo país primario, no coproduciones)

---

## Bugs conocidos y pendientes

### Pendientes de implementar
- Algoritmo de muestreo 60/40 real (actualmente reparte proporcionalmente por décadas con páginas aleatorias)
- Histogramas comparativos campo vs muestra en la sección expandible de la tab Muestra
- Gráfico de votos en tab Descripción (actualmente placeholder)
- Exportar campo a JSON
- Estado vacío más elaborado en home
- Perfiles de usuario para segmentar qué ve cada investigador (actualmente todos ven el mismo workspace)
- Calificación detallada: adaptación responsive para mobile (actualmente el tab se oculta en mobile)

### Limitaciones conocidas
- **Filtro de países en el universo:** `with_origin_country` solo filtra por país primario, no captura coproduciones
- **Cache de campos viejos:** campos creados antes de v6.1 no tienen `cache` y muestran los gráficos de descripción vacíos (no hay botón para regenerar post-creación; si se necesita, hay que hacerlo vía consola del browser)

---

## Decisiones de diseño importantes

1. **Espacio de trabajo compartido.** Todos los usuarios del tenant ven y editan los mismos campos. El aislamiento entre investigadores se resolverá con perfiles de usuario en una versión futura, no con estado separado por user_id.

2. **Universo bloqueado al crear.** El género, décadas y votos mínimos no se pueden cambiar. Para cambiar el universo se crea un nuevo campo. Esto protege la integridad de la investigación.

3. **Metaestabilidad es resultado, no criterio de selección.** No se usa para seleccionar la muestra — sería circular.

4. **Sin géneros excluidos por defecto al crear campo.** El investigador parte del universo más amplio posible y acota según su objetivo.

5. **Gráficos de descripción desde cache.** Los gráficos del tab Descripción se renderizan desde el snapshot guardado al crear el campo, no hacen llamadas TMDB en tiempo real. Esto garantiza que la descripción del universo sea estable aunque TMDB cambie.

6. **Gráficos de vista previa a demanda.** Durante la creación de un campo, el usuario presiona "Cargar datos" para ver la vista previa. Si no lo hace antes de crear, el sistema hace las llamadas automáticamente al crear.

7. **Escalado de gráficos.** Los conteos de géneros, países y rating se escalan al universo total con el factor `universeTotal / (páginas_consultadas × 20)`. Es una estimación, no un conteo exacto.

8. **Dark theme.** Variables CSS en `:root`, paleta oscura: `--bg`, `--bg2`, `--bg3`, `--bg4`, `--text`, `--text2`, `--text3`, `--green`, `--blue`, `--amber`, `--red`, `--border`, `--border2`, `--border3`.

9. **Períodos en Cal. detallada no requieren cobertura completa.** Un diferencial queda `complete = true` cuando todos sus períodos tienen valor asignado, sin importar si cubren el runtime total. Pueden existir franjas sin período.

10. **Cal. detallada no impacta Cal. general.** `detailedRatings` es completamente independiente de `ratings`. Los sliders, metaestabilidad y análisis de Cal. general se basan exclusivamente en `film.ratings`.

11. **`field.max` es único por campo.** Todos los diferenciales del campo comparten el mismo rango ±max. No hay escala por diferencial. Campos viejos (con `negMax`/`posMax` por diferencial) se migran automáticamente al cargar.

---

## Proceso pre-push

### Hecho automáticamente antes de cada commit con cambios visibles:
1. Bump el footer de `index.html` (todos los footers, formato `Genealogía del Cine vX.Y`)
2. Actualizar el artículo correspondiente en `help.html` si el cambio afecta algo visible para el usuario (ver mapa abajo)
3. Agregar entrada en el artículo **Release Notes** de `help.html` (formato: `## vX.Y — Mes Año` + lista de cambios)
4. Actualizar `README.md` si cambia la API, el stack o la arquitectura
5. Incluir la nueva versión en el mensaje del commit

### Requiere decisión del usuario antes de ejecutar:
- Crear un artículo nuevo en `help.html`
- Eliminar o fusionar artículos existentes
- Cambios estructurales en el help center (sidebar, secciones)
- Adaptación responsive de features nuevas o modificadas

**Criterio para actualizar docs:** cualquier cambio en flujo de uso, comportamiento de una feature existente o feature nueva. Los bugfixes sin impacto en la UX y los cambios de backend sin efecto visible no requieren actualización de artículos (sí van en Release Notes). Las actualizaciones de documentación no se mencionan en Release Notes.

---

## Mapa help.html → features

| Artículo (`id`) | Grupo sidebar | Cubre |
|---|---|---|
| `pantalla-inicio` | Campos | Listado de campos: tabla, columnas, badges de estado, botones Importar/Exportar/Nuevo |
| `crear-campo` | Campos | Pantalla nuevo campo: formulario, vista previa, gráficos de preview |
| `descripcion` | Campos | Tab Descripción: stat cards, gráficos de distribución |
| `muestra` | Campos | Tab Muestra: slider, tabla, generar, agregar película, índice de representatividad |
| `diferenciales` | Campos | Tab Diferenciales: lista, editor, RANGO ±, importar de otro campo |
| `calificacion` | Campos | Tab Calificación (sliders, metaestabilidad) + Tab Calificación detallada (cronómetro, períodos, mapa de calor) |
| `peliculas` | Películas | Sección Películas: formulario de búsqueda, tabla de resultados, detalle, distribución |
| `usuario` | General | Menú de usuario: avatar, listado de usuarios, historial de actividad |
| `mobile` | General | Versión mobile: header, navegación, pantallas |
| `indicadores` | General | Conceptos del método: metaestabilidad, índice de representatividad, distribución L1 |
| `release-notes` | General | Historial de versiones — **siempre actualizar** |

Los cambios en autenticación, sesiones o infraestructura de servidor van solo en Release Notes (no tienen artículo propio).

---

## Próximos pasos inmediatos

1. Completar histogramas comparativos campo vs muestra en tab Muestra
2. Implementar algoritmo de muestreo 60/40 real
3. Iterar gráfico de votos en tab Descripción
4. Exportar campo a JSON
5. Perfiles de usuario para segmentar qué ve cada investigador (actualmente todos ven el mismo workspace)
6. Calificación detallada: adaptación responsive para mobile
