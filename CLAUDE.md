# CLAUDE.md — Cine y Géneros

Contexto completo del proyecto para Claude Code. Leé este archivo antes de hacer cualquier cambio.

---

## Qué es este proyecto

**Cine y Géneros** es una app web estática (HTML + JS + CSS) para que investigadores analicen géneros cinematográficos usando un método propio basado en la teoría de Simondon.

El método: el investigador selecciona una muestra representativa de películas de un género, define **diferenciales** (tensiones narrativas binarias, ej: Cuerpo/Máquina), asigna a cada película un valor de −3 a +3 en cada diferencial, y calcula la **metaestabilidad** (promedio de |valores| / 3, escala 0–3). Las películas con metaestabilidad alta son "transformadoras" del género; las de baja son "estables".

---

## Stack técnico

- **HTML estático** — un solo archivo `cine_generos.html`, sin build system, sin framework
- **Chart.js 4.4.1** — todos los gráficos
- **TMDB API** — datos de películas (géneros, discover, detalles)
- **localStorage** — persistencia de todos los datos del usuario
- **Google Fonts** — DM Sans + DM Mono

**TMDB API Key (Bearer token):**
```
eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MmRhYWUyNWE0MGIzNzA2NjgyNGFkODVmZmJjNzA5OSIsIm5iZiI6MTc3NjcyMDg5Ny4zNjIsInN1YiI6IjY5ZTY5YzAxOWY5YzU1ZTFjNjY5MzVmOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.GfwS7LwX_ZB4RO1Pln5N1O8KQ2q8fqIz1-hl7xDJ5s0
```

Siempre se usa como `Authorization: Bearer <token>` en los headers. Base URL: `https://api.themoviedb.org/3`.

---

## Arquitectura de pantallas

La app tiene **3 pantallas** (`screen-home`, `screen-new-field`, `screen-field`) que se muestran con `position: fixed; top: 46px; inset: 0; overflow-y: auto`. Solo la activa tiene clase `active`.

### Header global (siempre visible, `position: fixed; top: 0; height: 46px`)
- Logo "Cine y Géneros" + badge TMDB

### Pantalla 1 — Home (`screen-home`)
- Lista de campos del investigador en tabla
- Columnas: Nombre, Género, Campo (total universo), Diferenciales, Calificación (barra progreso + X/Y), Estado (badge)
- Botón "+ Nuevo" en header2

### Pantalla 2 — Nuevo campo (`screen-new-field`)
- Layout 50/50: izquierda = formulario, derecha = vista previa (scrollable independiente)
- **Formulario:** Nombre, Género (carga dinámica desde TMDB), Mínimo de votos, Décadas inicio/fin, Países (multiselect con búsqueda — carga desde `/configuration/countries`), Excluir géneros secundarios (chips dinámicos, ninguno excluido por defecto), Toggle películas fuera de clasificación TMDB
- **Vista previa:** botón "Cargar datos" (a demanda, no automático), stat card con total, 5 gráficos: décadas, taquilla promedio top40, rating (horizontal invertido), géneros secundarios (horizontal), países (horizontal)
- Una vez creado el campo, los parámetros del universo quedan bloqueados para siempre

### Pantalla 3 — Campo (`screen-field`)
- Header2: nombre del campo + botón Renombrar + botón Cerrar
- 5 tabs: Descripción, Muestra, Diferenciales, Calificación, Análisis

#### Tab Descripción
- 6 stat cards: Género, Total películas, Rating promedio, Votos mínimos, Décadas, Países
- Sección "Distribución por décadas": gráfico cantidad (barras verticales) + taquilla promedio top40 por década (barras verticales)
- Sección "Distribución por categoría": géneros secundarios top10 (horizontal, 280px alto) + países top10 (horizontal, 280px alto)
- Sección "Distribución de scores": rating (horizontal invertido 9-10 arriba) + votos (barras)
- Todos los conteos escalados al universo total con factor `universeTotal / (páginas * 20)`

#### Tab Muestra
- 3 stat cards: Mínimo sugerido, Tamaño elegido, Sin calificar
- Slider + input para tamaño de muestra (libre, el investigador decide)
- Buscador + tabla paginada (20 por página) con orden por columna
- Botón "Generar" (grisado si no hay cambios pendientes) + "+" Agregar película
- Sección expandible (por defecto expandida): distribución comparativa campo vs muestra con índice de representatividad (similitud de coseno)

#### Tab Diferenciales
- Lista reordenable con drag handle
- Editor lateral: nombre, polo−, polo+, descripción, progreso de calificación
- Botón importar de otro campo

#### Tab Calificación
- Sidebar: lista de pendientes / calificadas
- Área principal: poster TMDB + metadata + sliders −3 a +3 por diferencial
- Metaestabilidad calculada en tiempo real
- Navegación anterior/siguiente + guardar

#### Tab Análisis
- 4 stat cards: calificadas, met. promedio, transformadoras (>1.8), diferenciales
- Ranking top 15 por metaestabilidad (barras horizontales)
- Evolución por década (líneas)
- Mapa de calor diferenciales × décadas (HTML, no canvas)
- Radar comparativo 2 películas (selectores dinámicos)

---

## Algoritmo de muestreo

**Tamaño mínimo sugerido:** cobertura esperada por categoría. Para cada variable categórica (décadas, países, géneros secundarios), si una categoría tiene X% en el universo, necesitás al menos 1/X películas. El máximo de todos esos mínimos es el número sugerido. El investigador puede subir o bajar libremente (el índice de representatividad lo refleja).

**Distribución 60/40:**
- 60% alto alcance: películas más taquilleras y votadas por década
- 40% bajo alcance: franja baja de votos y rating (se intuye que son las estables del género)

**Distribución de variables:** las distribuciones de rating, votos, décadas, países y géneros secundarios de la muestra replican las del universo. Se controla a nivel de toda la muestra.

**Índice de representatividad:** similitud de coseno entre vectores de distribución del campo y la muestra, por variable. Índice global = promedio ponderado. 1 = idéntico, baja a medida que diverge.

**Regenerar:** modal con dos checkboxes no excluyentes:
- Mantener películas agregadas manualmente
- Mantener películas ya calificadas

---

## Estado del appState

```js
appState = {
  fields: [],           // array de campos (persiste en localStorage)
  currentFieldId: null, // ID del campo activo
  samplePage: 1,
  sampleSort: { col: 'year', dir: 'asc' },
  sampleFilter: '',
  previewChart: null,         // Chart.js instances para la vista previa
  previewRatingChart: null,
  previewGenresChart: null,
  previewRevenueChart: null,
  previewCountriesChart: null,
  descCharts: {},             // Chart.js instances para tab Descripción
  distCharts: {},             // para distribución de muestra
  analysisCharts: {},         // para tab Análisis
  regenOpts: { manual: false, rated: false },
  selectedFilmToAdd: null,
  currentCalFilm: null,
  addFilmTimeout: null,
  allGenres: [],              // géneros cargados desde TMDB
}
```

**Estructura de un campo:**
```js
{
  id: 'f_' + Date.now(),
  name: string,
  genreId: number,        // ID TMDB del género principal
  votes: number,          // mínimo de votos
  decFrom: number,        // ej: 1920
  decTo: number,          // ej: 2020
  excludedGenres: [],     // array de IDs TMDB
  countries: [],          // array de códigos ISO (vacío = todos)
  allowOutside: boolean,
  universeTotal: number,
  minSuggested: number,
  sampleSize: number,
  sample: [               // array de películas en la muestra
    {
      id: number,         // ID TMDB
      title: string,
      year: number,
      votes: number,
      rating: number,
      country: string,
      genreIds: [],
      ratings: {},        // { diffId: value } — valores asignados por el investigador
      manual: boolean,    // fue agregada manualmente
      manualReason: string,
    }
  ],
  differentials: [
    {
      id: 'd_' + Date.now(),
      name: string,       // ej: "Cuerpo / Máquina"
      negPole: string,    // ej: "Cuerpo"
      posPole: string,    // ej: "Máquina"
      desc: string,
    }
  ],
  createdAt: string,      // ISO date
}
```

---

## TMDB endpoints usados

- `GET /genre/movie/list?language=es` — lista de géneros
- `GET /configuration/countries` — lista de países ISO
- `GET /discover/movie?with_genres=X&vote_count.gte=Y&sort_by=Z&page=N` — universo y muestreo
- `GET /movie/{id}` — detalles (revenue, budget, production_countries, poster_path)
- `GET /search/movie?query=X&year=Y` — búsqueda para agregar películas manualmente

**Parámetros de discover usados:**
- `with_genres` — género principal
- `without_genres` — géneros secundarios excluidos
- `vote_count.gte` — mínimo de votos
- `primary_release_date.gte / .lte` — rango de décadas
- `sort_by` — `vote_count.desc`, `revenue.desc`, `original_title.asc`
- `with_origin_country` — filtro de país (limitación: solo país primario, no coproduciones)

---

## Bugs conocidos y pendientes

### Críticos
- **Filtro de países en el universo:** `with_origin_country` solo filtra por país primario, no captura coproduciones. El gráfico de países en el detalle del campo siempre debería consultarse sin filtro de país para mostrar la distribución real, independientemente del filtro aplicado al universo.

### Pendientes de implementar
- Algoritmo de muestreo 60/40 real (actualmente toma las primeras N películas por votos)
- Cálculo completo del mínimo sugerido por cobertura esperada (actualmente usa décadas × 3)
- Similitud de coseno real para el índice de representatividad (actualmente usa varianza de décadas)
- Histogramas comparativos campo vs muestra en la sección expandible de la tab Muestra
- Gráfico de votos en tab Descripción (actualmente placeholder)

### UX pendiente
- Drag & drop reordenamiento de diferenciales
- Exportar campo a JSON
- Estado vacío más elaborado en home

---

## Decisiones de diseño importantes

1. **HTML estático para validación funcional.** Cuando esté validado, migrar a React + Node + PostgreSQL para múltiples usuarios.

2. **Universo bloqueado al crear.** El género, décadas y votos mínimos no se pueden cambiar. Para cambiar el universo se crea un nuevo campo. Esto protege la integridad de la investigación.

3. **Metaestabilidad es resultado, no criterio de selección.** No se usa para seleccionar la muestra — sería circular.

4. **Sin animación y géneros excluidos por defecto al crear campo.** El investigador parte de un universo lo más amplio posible y acota según su objetivo.

5. **Gráficos a demanda.** La descripción del campo y la vista previa no cargan datos automáticamente — el usuario presiona "Cargar datos". Esto evita hacer decenas de llamadas a TMDB sin que el usuario lo sepa.

6. **Escalado de gráficos.** Los conteos de géneros, países y rating se escalan al universo total con el factor `universeTotal / (páginas_consultadas × 20)`. Es una estimación, no un conteo exacto.

7. **Dark theme.** Variables CSS en `:root`, paleta oscura. Ver variables `--bg`, `--bg2`, `--bg3`, `--bg4`, `--text`, `--text2`, `--text3`, `--green`, `--blue`, `--amber`, `--red`, `--border`, `--border2`, `--border3`.

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
| `diferenciales` | Campos | Tab Diferenciales: lista, editor, importar de otro campo |
| `calificacion` | Campos | Tab Calificación: sidebar, sliders, metaestabilidad, navegación |
| `peliculas` | Películas | Sección Películas: formulario de búsqueda, tabla de resultados, detalle, distribución |
| `usuario` | General | Menú de usuario: avatar, listado de usuarios, historial de actividad |
| `mobile` | General | Versión mobile: header, navegación, pantallas |
| `indicadores` | General | Conceptos del método: metaestabilidad, índice de representatividad, distribución 60/40 |
| `release-notes` | General | Historial de versiones — **siempre actualizar** |

Los cambios en autenticación, sesiones o infraestructura de servidor van solo en Release Notes (no tienen artículo propio).

---

## Próximos pasos inmediatos

1. Corregir gráfico de países: siempre consultar sin filtro de país, mostrar distribución real
2. Implementar algoritmo de muestreo 60/40 real
3. Implementar similitud de coseno para índice de representatividad
4. Completar histogramas comparativos en tab Muestra
5. Iterar gráfico de votos en tab Descripción
