# Globo y mapa territorial

La entrada presenta un planeta digital ilustrativo, centrado entre el título y la descripción. No muestra datos personales, cantidades de simpatizantes ni una disponibilidad ficticia. En el panel, el globo admite giro, zoom, centrado en RD y navegación con teclado. Los colores azul, rojo y blanco mantienen la identidad de GUIDO.

## Alcance por rol

| Perfil | Registros visibles | Gestión |
| --- | --- | --- |
| Administrador | Toda la organización, incluidos registros conservados sin propietario | Usuarios, aprobación, asignación de equipos, registros y auditoría |
| Coordinador | Propios y de los integrantes aprobados de su equipo, incluidos equipos descendientes | Crea registros y edita los propios |
| Registrador y demás perfiles | Propios | Crea y edita sus registros |

El equipo se define mediante `users.manager_id`, asignable por el administrador al editar un usuario. Compartir provincia o zona no concede permisos. La base de datos rechaza autorreferencias, ciclos y responsables que no sean administradores o coordinadores aprobados; también conserva al menos un administrador aprobado.

## Backend compatible con las cuentas existentes

El diagnóstico recibido de producción confirmó cuatro perfiles aprobados, cero cuentas en Supabase Auth y RLS desactivado. La solución preparada conserva los usuarios y las contraseñas PBKDF2 actuales: no requiere trasladarlos a Supabase Auth.

La Edge Function `guido-api` verifica la contraseña en el servidor y emite una sesión aleatoria de 256 bits, con vencimiento de ocho horas. Guarda únicamente su hash SHA-256. Cada petición vuelve a comprobar el perfil aprobado y su rol actual. Cerrar sesión o restablecer la contraseña revoca las sesiones correspondientes.

El cliente envía `X-Guido-Session`. Nunca decide el actor ni el alcance mediante un rol o un ID de usuario. El adaptador conserva las consultas de las pantallas actuales, pero el servidor limita tablas, campos, operaciones y propietarios. Los perfiles devueltos no incluyen hashes de contraseña ni tokens de recuperación.

La llamada del mapa se transforma en la acción `map`. El backend deriva el actor de la sesión y ejecuta `guido_territory_map(uuid)`, que solo puede invocar `service_role`. El navegador recibe zonas y cantidades agregadas, sin nombres, teléfonos ni cédulas. Las credenciales privadas permanecen en el runtime de Supabase.

El cliente mantiene el modo heredado únicamente si el endpoint devuelve 404 o confirma expresamente que el cambio de acceso sigue inactivo. Un fallo de red o una respuesta inválida cierra el acceso; no activa una alternativa sin protección. Tras el corte, el frontend antiguo tampoco podrá acceder directamente a las tablas.

## Ubicación y cantidades

`territory_zones` define coordenadas de referencia para una combinación de provincia, municipio, zona y sector. Cada círculo representa agregados, nunca la posición de una persona. El color es estable y el texto también identifica la zona.

Si falta una ubicación exacta, se utiliza una referencia provincial claramente indicada. Las zonas que comparten esa referencia forman un círculo con la suma visible. Los puntos cercanos se agrupan al alejar el mapa y se separan al acercarlo; la lista conserva todos los sectores y cantidades. Pulsar cualquier círculo abre una ventana que desglosa provincia, municipio, zona, sector o barrio y cantidad por cada zona incluida, incluso cuando el círculo reúne varios puntos. El botón «Ver en el mapa» permite acercarse después de consultar la información. No se inventan posiciones distintas para sectores sin coordenadas. Las zonas sin referencia permanecen en la lista.

`python3 scripts/preparar-geografia.py` descarga el límite público verificado de [geoBoundaries DOM ADM1](https://www.geoboundaries.org/api/current/gbOpen/DOM/ADM1/), comprueba su SHA-256 y calcula centroides aproximados. Los contornos mundiales proceden de Natural Earth. Fuentes y licencias en `assets/data/FUENTES.md`.

El mapa consulta agregados cada 30 segundos, al volver a la ventana y tras cambios de registros. Se pausa en segundo plano y elimina los datos al cerrar sesión. Descarta respuestas que lleguen después de ese cierre. La ventana abierta renueva sus cantidades al actualizar y se vacía si caduca la sesión o se pierde la autorización. “Actualizado” indica una consulta correcta.

## Activación

La preparación local no modifica producción. La migración aditiva, el despliegue de las funciones y el corte de acceso son pasos separados. El procedimiento y la reversión están en [activacion-supabase.md](activacion-supabase.md). RLS no debe activarse por separado sobre el frontend heredado.

Referencias técnicas: [RLS en Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [secretos de Edge Functions](https://supabase.com/docs/guides/functions/secrets), [autenticación de Edge Functions](https://supabase.com/docs/guides/functions/auth).
