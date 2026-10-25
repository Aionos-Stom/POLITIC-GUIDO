# Activación de Supabase

Estado: implementación local; ningún SQL ni despliegue de esta propuesta se ha ejecutado en producción. Se necesita aprobación concreta antes de modificar Supabase o publicar la web; cada `git push` requiere el permiso del propietario.

## Revisión y pruebas locales

Se preservan el esquema heredado, las cuatro cuentas y el formato de sus contraseñas. No se instala otro framework ni se requiere una actualización de Node en producción: el frontend sigue siendo estático y el API se ejecuta en Supabase Edge.

```bash
node tests/api.test.mjs
node tests/cliente-api.test.mjs
node tests/territorio.test.cjs
node tests/mapa.test.cjs
node tests/globo.test.cjs
node scripts/verificar-db.cjs
node scripts/verificar-ui.cjs
```

El verificador de SQL crea un PostgreSQL desechable con datos sintéticos, red desactivada, sin puertos publicados ni directorios del host montados. Elimina el contenedor al terminar. Usa `postgres:17.6-alpine`; `GUIDO_TEST_POSTGRES_IMAGE` permite contrastarlo con otra versión autorizada. No cambia la versión de la base real. El informe queda en `.local/qa/base-datos.json`.

La prueba de navegador revisa el modo heredado y el nuevo API real con almacenamiento en memoria. Intercepta y bloquea el tráfico externo; no utiliza usuarios reales ni envía correos. El informe queda en `.local/qa/resultado.json`. Las pruebas locales no sustituyen una comprobación controlada del despliegue real.

## Orden de producción, pendiente de aprobación

1. Obtener una copia de seguridad restaurable de la base y conservar la versión anterior de ambas funciones y de la web. Confirmar los permisos y las políticas actuales con `supabase/diagnostico-mapa.sql`. No utilizar `supabase_setup.sql` como migración: es el instalador heredado y vuelve a desactivar RLS.
2. Aplicar `supabase/migrations/202610250001_territory_backend.sql` y después `supabase/migrations/202610250002_public_backend_status.sql`. La segunda migración permite consultar únicamente la versión y los booleanos de activación; no concede acceso a cuentas ni registros. Añade responsable de equipo, catálogo geográfico, sesiones, límites de intentos, funciones privadas y validaciones. Conserva inicialmente el acceso de las pantallas anteriores. Si existen usuarios o correos duplicados ignorando mayúsculas, se detiene la transacción; no renombra ni elimina cuentas.
3. Configurar la URL y el origen que confirmó el propietario: `GUIDO_PUBLIC_APP_URL=https://aionos-stom.github.io/POLITIC-GUIDO/` y `GUIDO_APP_ORIGINS=https://aionos-stom.github.io`. Mantener `GUIDO_ALLOW_LOCAL_ORIGINS=false` en producción. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son variables del runtime: no copiarlas al frontend ni enviarlas por chat.
4. Desplegar `guido-api` con la configuración de `supabase/config.toml` y la actualización de `enviar-correo`. El API usa sesiones opacas propias; su endpoint tiene `verify_jwt=false`. La función de correo conserva el proveedor y el secreto Gmail existente. Mientras el corte está inactivo admite el flujo anterior; después acepta únicamente al backend privado. Los enlaces se restringen a la URL pública configurada, incluido su subdirectorio.
5. Comprobar `health` y probar directamente login, `me`, mapa y logout del API con una cuenta autorizada, sin exponer sus credenciales. En esta fase `enabled=false`. Revisar que los agregados concuerdan con los registros y que los perfiles no contienen hashes ni tokens de recuperación. Login y logout generan auditoría; esta comprobación requiere autorización para esas escrituras controladas.
6. Publicar la web compatible, con autorización previa para la rama y el `push` concretos. Verificar la entrada, recursos, recuperación y acceso heredado antes del corte. No ejecutar el corte si faltan las funciones o el frontend compatible.
7. En la ventana acordada, aplicar **solo** `supabase/activacion/02-activar-api.sql`. Activa RLS en `users`, `voters` y `audit_logs`, revoca el acceso directo de `PUBLIC`, `anon` y `authenticated`, y activa el API en la misma transacción. El resultado debe indicar `enabled=true` y `protected=true`.
8. Recargar la web e iniciar sesión de nuevo. Comprobar Administrador, Registrador y un equipo de Coordinador asignado explícitamente; probar alta pendiente, aprobación, consulta, edición, exportación, recuperación y cierre. Verificar que el REST directo con clave pública falla y que el correo directo sin credencial privada devuelve 403. Confirmar el resultado antes de dar la activación por terminada.

No se modifica automáticamente la jerarquía de las cuentas existentes. El administrador asigna los responsables en Usuarios. Hasta esa asignación, un coordinador ve sus propios registros. Las coordenadas exactas de los sectores pueden incorporarse a `territory_zones` desde Supabase con datos revisados; mientras tanto se muestran referencias provinciales aproximadas.

## Reversión

`supabase/activacion/03-revertir-corte.sql` desactiva el nuevo modo y restaura el acceso CRUD heredado para el diagnóstico recibido. Requiere aprobación explícita porque vuelve a abrir el acceso directo anterior. No restaura `TRUNCATE`, `TRIGGER` ni `REFERENCES`, que la web no utiliza. Conserva cuentas, registros, sesiones y columnas nuevas; no elimina datos.

Si la incidencia está en los archivos públicos o en el proveedor de correo, restaurar además la versión revisada de esos archivos o funciones. La copia de seguridad y las versiones anteriores deben estar disponibles antes del corte.

## Administración manual

Todas las solicitudes web quedan pendientes, incluida la primera. El administrador inicial se crea desde el SQL Editor con el archivo que genera `python3 scripts/crear-admin-sql.py`. La consulta de usuarios y las instrucciones están en [administradores.md](administradores.md). No se eliminan ni se cambian las cuatro cuentas existentes.
