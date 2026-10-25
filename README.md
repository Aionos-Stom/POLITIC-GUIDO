# GUIDO

Plataforma de gestión territorial con acceso de equipo, registro de simpatizantes, consulta, administración de usuarios y auditoría.

La aplicación conserva su estructura de HTML, CSS y JavaScript. No requiere compilar ni instalar paquetes para abrir la interfaz. La conexión de datos y la recuperación por correo utilizan la integración de Supabase existente.

## Probar con datos ficticios

```bash
/home/caos/.nvm/versions/node/v22.23.4/bin/node scripts/probar-local.cjs
```

Abre `http://localhost:4055`. Usuario `admin`, contraseña `PruebaLocal!2026`. Los perfiles `coordinator` y `register` utilizan la misma contraseña de demostración. Este acceso pertenece exclusivamente al servidor local, no a las cuentas de producción.

El servidor reutiliza los módulos del API con almacenamiento en memoria y sustituye la configuración de Supabase únicamente al servir los archivos. No modifica `script.js`, no utiliza la base remota y no envía correo. El enlace «Bandeja de correo de prueba» permite comprobar la recuperación. Al cerrar el proceso se descartan todos los cambios de demostración. `PORT=4056` permite elegir otro puerto libre. En otro equipo puede utilizarse `node` 22 o una versión compatible ya instalada.

## Desarrollo local

Requiere Python 3 para servir los archivos. Desde esta carpeta:

```bash
python3 -m http.server 4020 --bind 127.0.0.1
```

Abre `http://localhost:4020`. Si ese puerto está ocupado, utiliza otro puerto libre. En este espacio de Ubuntu también está disponible el gestor local, que selecciona un puerto libre y comunica su valor mediante `PORT`.

La interfaz carga Manrope y la geografía desde `assets/`. El planeta se dibuja en el navegador con WebGL y dispone de un modo compatible. El cliente de Supabase y las herramientas de exportación conservan las referencias del repositorio. La consulta y el guardado de datos necesitan conexión.

La preparación inicial de la referencia provincial usa únicamente datos públicos:

```bash
python3 scripts/preparar-geografia.py
```

## Comprobaciones

Las pruebas de lógica usan únicamente Node.js; se verificaron con Node 22.23.4:

```bash
node tests/territorio.test.cjs
node tests/mapa.test.cjs
node tests/globo.test.cjs
node tests/api.test.mjs
node tests/cliente-api.test.mjs
node --check script.js
node --check ui.js
node --check audit.js
node --check sw.js
node --check globe.js
node --check territory-map.js
node --check data-api-client.js
node --check protected-auth.js
```

La prueba de navegador necesita Playwright 1.64.1 y Chromium. En este Ubuntu se reutilizan las herramientas locales ya instaladas:

```bash
node scripts/verificar-ui.cjs
```

Para revisar únicamente el cierre pendiente (móvil de 390 píxeles, texto al 200 % y acceso protegido en móvil y escritorio), usa `node scripts/verificar-ui.cjs --cierre`. Guarda su alcance y resultado en `.local/qa/resultado-cierre.json`, sin sobrescribir el informe de la matriz completa.

En otro entorno, proporciona la ruta de una instalación de Playwright mediante `GUIDO_PLAYWRIGHT_PATH` y, si corresponde, la de Chromium mediante `GUIDO_CHROMIUM_PATH`. El verificador también detecta un módulo `playwright` disponible en el proyecto. No instala ni actualiza dependencias automáticamente.

Para comprobar las migraciones y el corte en un PostgreSQL desechable con Docker:

```bash
node scripts/verificar-db.cjs
```

No conecta con Supabase ni modifica la base real. Si una terminal nueva no encuentra `node`, carga NVM con `source "$HOME/.nvm/nvm.sh"` y selecciona la versión ya instalada con `nvm use 22`; no hace falta reinstalar paquetes.

El verificador de navegador abre un servidor temporal en un puerto libre. Sustituye el cliente de datos durante la prueba y bloquea servicios externos: no utiliza cuentas reales, no modifica Supabase y no envía correos. Revisa acceso heredado y protegido, restauración de sesión, equipos, recuperación, ventanas de zonas y sectores, campos, filtros, menús, tema, errores, textos extensos y desbordamientos entre 320 y 3840 píxeles. Incluye orientación horizontal y texto ampliado al 200 %.

El informe queda en `.local/qa/resultado.json` y las capturas en `.local/qa/capturas/`. Son archivos de trabajo local y no se deben publicar. La emulación en Chromium complementa la comprobación en dispositivos; no certifica Safari, Android ni televisores físicos.

La dirección visual y las decisiones de adaptación están documentadas en [docs/diseno-responsive.md](docs/diseno-responsive.md).

El alcance por roles y los requisitos pendientes para activar el mapa con datos reales están en [docs/mapa-territorial.md](docs/mapa-territorial.md). El procedimiento de activación está en [docs/activacion-supabase.md](docs/activacion-supabase.md). La migración SQL está preparada localmente y no se ha aplicado a Supabase. La aplicación no presenta un mapa con datos privados si no puede verificar su acceso protegido.

El primer administrador se crea manualmente en `public.users`; todas las solicitudes web quedan pendientes. La consulta de cuentas de producción y el comando de alta manual están en [docs/administradores.md](docs/administradores.md).
