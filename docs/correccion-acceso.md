# Corrección del acceso tras publicar la web

El frontend publicado intentaba consultar `guido-api`, que todavía devolvía 404. Los errores 404 de plataforma de Supabase Functions no se pueden leer desde el navegador cuando falla su preflight CORS. Por ello, la comprobación de 404 del cliente no llegaba a ejecutarse y se mostraba «No pudimos conectar con el acceso protegido» antes de validar la contraseña.

La detección corregida consulta únicamente `guido_backend_status` mediante PostgREST si falla el endpoint Edge. Si la base confirma que el modo protegido está inactivo o que esa RPC no existe en el esquema anterior (PGRST202), conserva el acceso compatible con las cuentas existentes. No consulta usuarios ni votantes para detectar el modo. Los errores de permisos, los fallos de red de ambos servicios y un API ya activado no permiten volver al acceso directo.

Este arreglo de frontend no requiere modificar las cuentas ni restablecer contraseñas. La activación completa del API y del mapa privado sigue el orden de `activacion-supabase.md`. La segunda migración solo publica el estado de preparación (versión y booleanos); no expone cuentas ni habilita permisos de lectura de datos.

Pruebas añadidas: error de preflight oculto por CORS con esquema anterior; estado de preparación inactivo; fallo de un API activado; rechazo de errores de permisos y red. El verificador de navegador ahora simula una petición Edge bloqueada, en lugar de devolverle un 404 legible artificialmente.

Referencia: [Supabase: Edge Function 404 error response](https://supabase.com/kb/troubleshooting/edge-function-404-error-response).
