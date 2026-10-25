# GUIDO

Plataforma de gestión territorial para organizar equipos, registrar simpatizantes y dar seguimiento al trabajo de cada zona.

**Acceso:** https://aionos-stom.github.io/POLITIC-GUIDO/

## Funciones

- Inicio de sesión con usuario o correo y recuperación de contraseña mediante la integración de Supabase.
- Solicitud de acceso organizada por información personal, equipo y territorio, y contraseña. Todas las solicitudes requieren aprobación de un administrador.
- Administración de perfiles y asignación de equipos, consulta con filtros, exportaciones y auditoría.
- Planeta de bienvenida y mapa territorial con detalle de zonas y sectores. El mapa privado requiere el backend protegido y respeta el alcance autorizado de cada cuenta.
- Diseño adaptable a móviles, tabletas y pantallas grandes, navegación por teclado y tema oscuro.

El primer administrador se crea manualmente en la base de datos. Las cuentas de demostración locales no sirven para acceder a producción.

## Publicación

Esta rama contiene los archivos estáticos que necesita GitHub Pages: `index.html`, `sw.js`, `manifest.json`, `.nojekyll`, los paquetes compactados en `assets/`, la geografía pública, la fuente y los iconos. No requiere instalar dependencias ni compilar en GitHub.

El JavaScript y el CSS se entregan agrupados y compactados, sin mapas de código fuente. El navegador necesita recibir el HTML, el CSS y el JavaScript para ejecutar la web y permite inspeccionarlos.

La base de datos y las funciones de Supabase se despliegan por separado; publicar esta web no las crea ni las modifica. Las claves privadas y los secretos del servidor no forman parte de estos archivos.

## Trabajo local

Las fuentes editables, las pruebas, el backend, los comandos de administración y la documentación técnica se conservan en Ubuntu dentro de `.local/desarrollo`, excluido de Git. Para preparar una nueva publicación desde este equipo:

```bash
/home/caos/.nvm/versions/node/v22.23.4/bin/node .local/desarrollo/scripts/preparar-publicacion.cjs
```

El comando reutiliza las herramientas locales instaladas y no actualiza dependencias. Solo se debe subir una publicación después de revisarla y autorizarla. Esta copia local debe conservarse: clonar la rama de publicación descarga los archivos de la web, no las fuentes de desarrollo.

## Créditos

Desarrollado por **JyB Technology Solutions SRL**.

Manrope se distribuye bajo SIL Open Font License; se conserva su licencia en `assets/fonts/OFL.txt`. Las atribuciones de la geografía pública están en `assets/NOTICE.txt`.
