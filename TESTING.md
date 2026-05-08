# Casos de prueba manuales — Genealogía del Cine

Ejecutar antes de cada release importante. Completar la columna **Estado** con ✓ (pasa), ✗ (falla) o — (no ejecutado).

---

## Autenticación

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| A1 | Login con Google | Abrir la app sin sesión activa → hacer clic en "Iniciar sesión con Google" → seleccionar cuenta | Redirige al listado de campos con el avatar del usuario en el header | — |
| A2 | Sesión persistente | Iniciar sesión → cerrar la pestaña → volver a abrir la URL | La app carga directamente sin pedir login | — |
| A3 | Cerrar sesión | Hacer clic en el avatar → Cerrar sesión | Redirige a la pantalla de login | — |
| A4 | Acceso sin sesión | Intentar acceder a la URL raíz sin estar autenticado | Redirige a la pantalla de login | — |

---

## Listado de campos

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| L1 | Estado vacío | Ingresar con una cuenta sin campos | Se muestra un estado vacío (sin tabla) | — |
| L2 | Visualización de campos | Tener al menos un campo creado | La tabla muestra nombre, género, universo, diferenciales, calificación y estado | — |
| L3 | Badge de estado | Revisar los badges de campos en distintas etapas | "Sin muestra", "Sin calificar", "En proceso" y "Completo" aparecen según corresponda | — |
| L4 | Abrir un campo | Hacer clic en una fila de la tabla | Abre la pantalla del campo en el tab Descripción | — |
| L5 | Exportar campos | Hacer clic en Exportar con al menos un campo | Se descarga un archivo JSON con los datos | — |
| L6 | Importar campo | Hacer clic en Importar → seleccionar un JSON exportado previamente | El campo aparece en el listado | — |

---

## Crear campo

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| C1 | Formulario completo | Completar todos los campos → hacer clic en Crear | El campo aparece en el listado de campos | — |
| C2 | Cargar vista previa | Completar género, décadas y votos mínimos → hacer clic en "Cargar datos" | Se muestra el total del universo y los cinco gráficos de preview | — |
| C3 | Filtro de países | Seleccionar un país en el formulario → cargar vista previa | El total del universo refleja solo películas del país seleccionado | — |
| C4 | Excluir géneros | Seleccionar géneros a excluir → cargar vista previa | El total del universo es menor que sin exclusiones | — |
| C5 | Nombre vacío | Intentar crear un campo sin nombre | No se crea el campo; se indica el error | — |
| C6 | Universo bloqueado | Crear un campo → volver a abrirlo | Los parámetros de género, décadas y votos no son editables | — |

---

## Tab Descripción

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| D1 | Stat cards | Abrir un campo con datos | Se muestran las 6 stat cards con valores correctos (género, total, rating promedio, votos mínimos, décadas, países) | — |
| D2 | Gráficos de distribución | Verificar los seis gráficos | Se renderizan sin errores: décadas, taquilla, géneros secundarios, países, rating y votos | — |
| D3 | Renombrar campo | Hacer clic en el botón Renombrar → escribir un nombre nuevo → confirmar | El nombre se actualiza en el header y en el listado | — |

---

## Tab Muestra

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| M1 | Generar muestra | Abrir un campo nuevo → ir al tab Muestra → hacer clic en Generar | Se genera una muestra del tamaño indicado | — |
| M2 | Slider de tamaño | Mover el slider → hacer clic en Generar | La muestra se regenera con el nuevo tamaño | — |
| M3 | Índice de representatividad | Generar una muestra | Se muestra el índice global y los gráficos comparativos campo/muestra | — |
| M4 | Agregar película manualmente | Hacer clic en "+" → buscar una película → agregarla | La película aparece en la tabla con el badge "manual" | — |
| M5 | Buscar en la tabla | Escribir en el buscador de la tabla | La tabla filtra los resultados en tiempo real | — |
| M6 | Ordenar por columna | Hacer clic en los encabezados de la tabla | La tabla se ordena correctamente por cada columna | — |
| M7 | Regenerar con opciones | Hacer clic en Generar con películas ya calificadas → marcar "Mantener calificadas" | Las películas calificadas se conservan en la nueva muestra | — |
| M8 | Quitar película | Hacer clic en ✕ de una película | La película se elimina de la muestra | — |
| M9 | Ver detalle desde muestra | Hacer clic en ↗ de una película | Se abre el modal de detalle de la película | — |
| M10 | Estado de calificación | Tener películas en distintos estados | La columna muestra ✓, ◐ y ○ según corresponda | — |

---

## Tab Diferenciales

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| DI1 | Crear diferencial | Hacer clic en "+" → completar nombre, polo− y polo+ → guardar | El diferencial aparece en la lista | — |
| DI2 | Editar diferencial | Hacer clic en un diferencial → modificar campos → guardar | Los cambios se reflejan en la lista | — |
| DI3 | Eliminar diferencial | Seleccionar un diferencial → hacer clic en eliminar | El diferencial desaparece de la lista | — |
| DI4 | Importar de otro campo | Hacer clic en "Importar" → seleccionar un campo con diferenciales | Los diferenciales del otro campo se agregan al actual | — |

---

## Tab Calificación

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| CA1 | Calificar película | Seleccionar una película pendiente → mover los sliders → guardar | La película pasa al grupo "Calificadas"; la metaestabilidad se calcula correctamente | — |
| CA2 | Metaestabilidad en tiempo real | Mover un slider durante la calificación | El valor de metaestabilidad se actualiza mientras se mueve el slider | — |
| CA3 | Navegación anterior/siguiente | Calificar una película → hacer clic en siguiente | Avanza a la próxima película pendiente | — |
| CA4 | Película en proceso | Guardar con solo algunos diferenciales completados | La película aparece en el grupo "En proceso" con el ícono ◐ en la muestra | — |

---

## Tab Análisis

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| AN1 | Stat cards | Tener al menos una película calificada | Se muestran las 4 stat cards: calificadas, metaestabilidad promedio, transformadoras y diferenciales | — |
| AN2 | Ranking de metaestabilidad | Verificar el gráfico de barras | Las 15 películas con mayor metaestabilidad aparecen ordenadas de mayor a menor | — |
| AN3 | Evolución por década | Verificar el gráfico de líneas | Muestra la metaestabilidad promedio por década con datos correctos | — |
| AN4 | Radar comparativo | Seleccionar dos películas en los selectores | Se renderiza el radar con los perfiles de ambas películas | — |

---

## Sección Películas

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| P1 | Búsqueda por filtros | Seleccionar un género → hacer clic en Buscar | Se muestra la tabla de resultados con películas del género | — |
| P2 | Búsqueda por título | Escribir un título en el campo Título → Buscar | Se muestran resultados de búsqueda textual; aparece la nota ámbar de modo título | — |
| P3 | Filtros combinados | Combinar género, país y rango de décadas → Buscar | Los resultados respetan todos los filtros simultáneamente | — |
| P4 | Décadas condicionadas | Seleccionar "Desde: 1990" → verificar el select "Hasta" | Las opciones anteriores a 1990 aparecen deshabilitadas en "Hasta" | — |
| P5 | Máscara de votos | Escribir 1500 en votos mínimos → hacer clic fuera | El campo muestra "1.500" | — |
| P6 | Ordenar resultados | Hacer clic en los encabezados Título, Año, País, Votos, Rating | La tabla se ordena correctamente por cada columna | — |
| P7 | Paginación | Obtener resultados con más de una página → navegar | Los resultados cambian al pasar de página | — |
| P8 | Detalle de película | Hacer clic en una fila | Se abre el modal con póster, título original, datos y sinopsis | — |
| P9 | Link a TMDB | Abrir el detalle de una película → hacer clic en "Ver en TMDB →" | Se abre la página de la película en TMDB en una pestaña nueva | — |
| P10 | Cargar gráficos | Hacer una búsqueda con resultados → hacer clic en "Cargar gráficos" | Se renderizan los seis gráficos con valores escalados al total de resultados | — |
| P11 | Limpiar búsqueda | Hacer una búsqueda → hacer clic en Limpiar | Se vacían todos los filtros, desaparece la tabla y los gráficos | — |

---

## Menú de usuario

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| U1 | Abrir menú | Hacer clic en el avatar | Se despliega el menú con nombre, email y botones | — |
| U2 | Listado de usuarios | Hacer clic en "Usuarios" | Se abre el modal con la tabla de usuarios y fecha de último ingreso | — |
| U3 | Historial de actividad | En el listado de usuarios → hacer clic en "Ver actividad →" de un usuario | Se abre el modal con el historial de acciones del usuario | — |

---

## Estados de error y borde

| # | Escenario | Pasos | Resultado esperado | Estado |
|---|-----------|-------|--------------------|--------|
| E1 | Sin conexión | Desactivar la red → intentar cargar datos de un campo | Se muestra un mensaje de error; la app no se rompe | — |
| E2 | Campo sin muestra | Abrir el tab Calificación de un campo sin muestra | Se indica que no hay películas para calificar | — |
| E3 | Campo sin diferenciales | Abrir el tab Calificación sin diferenciales definidos | Se indica que no hay diferenciales para calificar | — |
| E4 | Búsqueda sin resultados | Buscar con filtros muy restrictivos | Se muestra "Sin resultados" sin romper la UI | — |
