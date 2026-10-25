# Diseño de GUIDO

## Dirección visual

Una identidad institucional clara, con azul marino `#0b2040`, azul `#2361df`, superficies blancas `#ffffff`, fondo frío `#f3f6fb` y rojo `#d83846` como acento de marca. Manrope aporta jerarquía y continuidad entre títulos, controles y datos. La tipografía se sirve localmente, con su licencia OFL en `assets/fonts/OFL.txt`.

La entrada une la presentación del sistema con el acceso del equipo. Un planeta digital en azul, blanco y rojo acompaña al mensaje; el formulario conserva prioridad operativa. Las funciones de la plataforma se presentan en una franja abierta con separadores.

El panel utiliza una barra lateral, encabezado sencillo, métricas agrupadas y un globo territorial con giro, zoom y selección de zonas. Pulsar un círculo abre una ventana con el desglose de sus zonas, sectores o barrios y cantidades. Los accesos rápidos abren los flujos existentes de registro y consulta. No se introducen cifras de muestra en la aplicación; las pruebas utilizan una fuente simulada aislada.

## Componentes y adaptación

- Colores, espacios, radios y estados se definen con variables CSS; el tema oscuro utiliza la misma estructura.
- La entrada tiene un límite de lectura de 94 rem y el espacio de trabajo de 88 rem. Las columnas se calculan con `minmax`, `auto-fit` y medidas fluidas.
- En pantallas estrechas, el acceso sigue a la bienvenida. El trabajo cotidiano dispone de una navegación inferior y un menú completo con cierre de sesión.
- Los grupos de campos se adaptan al espacio disponible. El registro se divide en datos personales, ubicación e información adicional.
- La consulta separa la identificación principal de una ficha desplegable. Nombres, provincias, roles y observaciones conservan su texto completo y admiten palabras sin espacios.
- La gráfica usa barras en HTML, con sus valores en texto. Los nombres no se recortan para ajustarlos a un lienzo.
- La auditoría se convierte en fichas en móvil y conserva los detalles desplegables. Los encabezados de campo acompañan a cada dato.
- Los botones mantienen zonas de pulsación de al menos 44 píxeles con el tamaño base. Los campos utilizan una fuente base de 16 píxeles.
- Se contemplan áreas seguras de pantalla, altura dinámica del navegador, teclado virtual, orientación horizontal y reducción de movimiento.
- Los diálogos y el menú controlan el foco, aíslan el contenido de fondo y admiten cierre por teclado. Las pestañas comunican selección y relación con sus formularios.

## Estados operativos

Las pantallas incluyen acceso en proceso, validación de campos, resultados vacíos y error de conexión. Una consulta fallida se indica con datos no disponibles, en lugar de presentarla como cero registros. La búsqueda y la limpieza de filtros se coordinan, y una respuesta anterior no puede reemplazar la consulta más reciente.

El manifiesto permite cualquier orientación. La nueva versión del service worker incluye los recursos visuales locales e invalida únicamente las cachés de GUIDO.

## Referencias y recursos

Las referencias vigentes son `.local/design/concepto-globo-entrada.png` y `concepto-globo-panel.png`. Los conceptos de arquitectura anteriores se conservan como referencias retiradas en esa carpeta local. El inventario de textos y decisiones está en `.local/design/especificacion.json`.

Recursos finales:

- `assets/data/mundo.json`: contornos de tierra de Natural Earth, procesados para la escena nativa.
- `assets/data/provincias.json`: referencias provinciales públicas, preparadas con verificación SHA-256.
- `globe.js` y `globe.css`: escena 3D, navegación y estados de adaptación; no utilizan servicios externos de mapas.

El mismo planeta se adapta a móvil y escritorio. Las métricas pasan del indicador de carga a los valores disponibles. El mapa requiere una consulta protegida y separa los sectores ubicados de las referencias provinciales aproximadas. Los requisitos del backend se detallan en [mapa-territorial.md](mapa-territorial.md).

## Revisión visual

La comparación final debe revisar cinco puntos: texto y orden del acceso; composición y proporciones; tipografía y saltos de línea; paleta e imágenes; espacios y navegación en móvil. Las capturas y el resultado de la prueba de navegador se conservan durante la revisión en `.local/qa/`.

La ejecución nativa utiliza Playwright 1.64.1 con Chromium y datos sintéticos. El modo protegido ejecuta los módulos reales del backend contra un almacén en memoria. La revisión cubre 320–3840 píxeles, orientación horizontal, modo oscuro, texto al 200 %, formularios, filtros, recuperación, cambios de rol, equipos y caducidad de sesión. El contenedor PostgreSQL desechable superó 16 comprobaciones de migración, permisos, agregados y reversión; las pruebas de lógica suman 61 casos.

Se inspeccionaron las capturas de entrada, mapa y modo oscuro en móvil, tablet y escritorio, además de la vista con texto ampliado. La revisión de cierre superó 42 comprobaciones sin incidencias: texto al 200 %, ventana territorial y acceso protegido en móvil y escritorio. Su informe queda en `.local/qa/resultado-cierre.json`. La matriz completa anterior está en `.local/qa/resultado.json`; el cierre valida el ajuste del verificador que detuvo su última ejecución. La emulación no certifica Safari ni dispositivos físicos.

### Comparación con los conceptos

| Punto | Resultado de la revisión |
| --- | --- |
| Orden y texto del acceso | Se conservan el título, descripción, pestañas, campos y acción principal; el texto inventariado coincide con el HTML. |
| Composición del planeta | Se adapta la referencia por petición expresa: título centrado arriba, esfera completa en medio y descripción debajo, sin taparla. |
| Tipografía | Manrope local, tamaños fluidos y párrafos completos. Los textos extensos se revisan también con datos sintéticos. |
| Identidad y recursos | Azul, rojo y blanco; escena nativa con datos geográficos locales. El mapa añade controles reales y agregados autorizados. |
| Espaciado y navegación | Entrada en dos columnas en escritorio y apilada en móvil; navegación inferior con área segura y altura observada. |
| Detalle territorial | Los círculos individuales y agrupados abren una ventana con todos sus sectores, foco controlado y cierre por teclado. |
| Ampliación y adaptación | Las métricas y la navegación cambian sus columnas con el espacio que necesita el texto al 200 %. |

Diferencias de texto respecto al concepto generado: el aviso final dice «Acceso exclusivo para el equipo autorizado»; las descripciones de las tres funciones y el pie usan el texto definitivo de la especificación local. No se copiaron rótulos generados que prometieran actividad real o acceso sin autorización.

La implementación no pretende ser una copia por píxeles del concepto: la composición final responde a la corrección del propietario y sustituye la imagen por una escena funcional. Los archivos de referencia y las capturas permanecen en `.local/`, excluidos de Git.
