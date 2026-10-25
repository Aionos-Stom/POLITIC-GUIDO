# Revisión de publicación

Repositorio: https://github.com/Aionos-Stom/POLITIC-GUIDO

Rama local: `feat/rediseno-responsive-guido`. Destino propuesto: la misma rama remota, con pull request hacia `main`. La subida y el PR están autorizados por el propietario; sigue pendiente disponer de una conexión con escritura. Supabase no se ha modificado.

## Cambio preparado

Renueva la entrada y el panel con diseño adaptable, tipografía local, navegación móvil, tema oscuro y manejo de textos extensos. Añade un planeta digital en el acceso y un mapa territorial interactivo en el panel. Los círculos abren una ventana con zonas, sectores o barrios y cantidades; los grupos conservan el desglose completo.

El API compatible conserva las cuentas y contraseñas actuales y verifica en el servidor sesiones, permisos y jerarquías de equipo. El Administrador ve toda la organización, el Coordinador su equipo asignado y el Registrador sus registros. Incluye administración de equipos, recuperación, auditoría, exportación y migraciones separadas para preparar y activar la protección. Todas las altas web quedan pendientes: el primer administrador se crea manualmente en la base. Añade el crédito de JyB Technology Solutions SRL y el enlace discreto al portafolio Caos.

## Validación

- 61 pruebas de lógica superadas con Node 22.23.4.
- 16 comprobaciones de PostgreSQL desechable superadas, con permisos, migración repetible, jerarquía, agregados y reversión.
- Cierre de navegador aprobado: 42 comprobaciones, cero incidencias, el 25 de octubre de 2026. Incluye móvil de 390 píxeles, reflujo al 200 %, ventanas de sectores, exportación y API protegido en móvil y escritorio de 1440 píxeles. Informe: `.local/qa/resultado-cierre.json`. La matriz previa recorrió 320–3840 píxeles; su última ejecución se detuvo por la comprobación transitoria de columnas CSS, corregida y validada en este cierre. No se atribuye al cierre una repetición de toda la matriz.
- Sintaxis de JavaScript, TypeScript y CSS revisada; IDs y recursos locales comprobados. La ejecución real de las funciones Edge se verifica durante el despliegue aprobado.

## Activación y límites

El acceso `admin` de `scripts/probar-local.cjs` utiliza datos ficticios en memoria y no se instala en Supabase. Las cuentas de producción se conservan. Las coordenadas exactas de sectores dependen del catálogo revisado; los puntos sin ellas muestran la referencia provincial aproximada.

La publicación requiere permiso para el push concreto. La activación de Supabase requiere aprobación y copia restaurable; el orden de operaciones y la reversión están en [activacion-supabase.md](activacion-supabase.md). La validación local no implica que las protecciones ya estén activas en producción.
