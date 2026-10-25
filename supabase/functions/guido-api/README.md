# API de producción compatible

Mantiene los usuarios y el formato PBKDF2 existentes. Las cuentas no se trasladan a Supabase Auth.

El runtime necesita sus variables automáticas SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Esa clave se utiliza únicamente en el servidor y no debe copiarse al frontend ni al chat.

Configuración del proyecto:

- GUIDO_PUBLIC_APP_URL: https://aionos-stom.github.io/POLITIC-GUIDO/
- GUIDO_APP_ORIGINS: https://aionos-stom.github.io
- GUIDO_ALLOW_LOCAL_ORIGINS: false en producción; true solo si se autoriza la prueba desde localhost.

Los enlaces de recuperación utilizan la URL completa configurada, incluido el subdirectorio de GitHub Pages.

La función recibe health, login, me, logout, register, query, map, reset-request, reset-check y reset-apply. Los tokens de sesión viajan en X-Guido-Session. El backend devuelve perfiles sin hashes ni tokens de recuperación. Los agregados del mapa se derivan de la sesión y de la jerarquía actual.

El esquema aditivo y el corte de acceso directo son pasos separados. Ninguno se ejecuta al desplegar esta función.
