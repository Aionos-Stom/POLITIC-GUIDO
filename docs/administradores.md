# Usuarios y administradores de producción

La aplicación sigue configurada con el mismo proyecto Supabase de producción. Las cuatro cuentas del diagnóstico se conservan. El servidor `scripts/probar-local.cjs` utiliza cuentas sintéticas en memoria y no conecta con esa base; sus credenciales no corresponden a producción.

## Consultar las cuentas existentes

En el SQL Editor del proyecto de producción, ejecutar `supabase/usuarios-produccion.sql`:

```sql
SELECT username AS usuario, name AS nombre, role AS rol, status AS estado
FROM public.users
ORDER BY role, username;
```

La consulta no devuelve contraseñas, hashes ni tokens. Las contraseñas existentes están almacenadas mediante PBKDF2; no se pueden obtener en texto. Si se desconoce una, debe utilizarse la recuperación de acceso.

## Crear un administrador manualmente

Desde Ubuntu, sin instalar paquetes:

```bash
cd /home/caos/DevOps/proyectos/POLITIC-GUIDO
python3 scripts/crear-admin-sql.py
```

El comando pregunta nombre, usuario, correo de recuperación, teléfono opcional y contraseña. La contraseña no se muestra ni se escribe en el SQL. Genera un hash compatible con el acceso actual y guarda una transacción en `.local/administracion/crear-admin-<identificador>.sql`, con permisos de archivo 600 y fuera de Git.

Abrir el archivo indicado y ejecutar su contenido en el SQL Editor de Supabase. El resultado muestra el usuario creado como `Administrador` y `Aprobado`. Se crea en **public.users**, la tabla de cuentas que utiliza esta aplicación; no en `auth.users`. El SQL no reemplaza cuentas existentes y se detiene si el usuario o correo ya existe, incluso con otra combinación de mayúsculas.

Repetir el comando para añadir más administradores con usuarios y correos diferentes. Conservar la contraseña elegida de forma privada. Este comando prepara el alta; no ejecuta escrituras en producción por sí mismo.

## Cambiar las claves de las cuatro cuentas existentes

```bash
python3 /home/caos/DevOps/proyectos/POLITIC-GUIDO/scripts/cambiar-claves-sql.py --usuarios 4
```

Introducir el nombre de usuario de cada cuenta y su nueva clave dos veces. No se necesita la clave anterior. El comando genera un archivo privado en `.local/administracion/cambiar-claves-<identificador>.sql`; las claves nuevas no aparecen en texto. Abrir el archivo indicado y ejecutar todo su contenido en el SQL Editor del mismo Supabase de producción.

La transacción cambia únicamente el hash, invalida enlaces de recuperación anteriores y conserva los roles y estados de aprobación. Si alguno de los usuarios no existe o coincide con varias cuentas, revierte el cambio completo. El comando no crea ni elimina cuentas.

Si el backend protegido está instalado, también revoca sus sesiones. Con el acceso heredado basado en el ID del navegador, cambiar la clave no revoca esas sesiones; hay que cerrar sesión en los dispositivos. Después se puede entrar con la nueva clave.

Para cambiar una sola cuenta, sustituir `--usuarios 4` por `--usuarios 1`.

## Altas posteriores

Toda solicitud desde la web se guarda como `Pendiente`, incluida una solicitud con rol Administrador y aunque no exista ningún administrador. Un administrador aprobado revisa las solicitudes desde Usuarios. El sistema no aprueba automáticamente la primera cuenta.

La restricción se aplica en el API protegido y en el flujo de interfaz compatible. La activación del backend y la revocación del acceso directo se realizan en el orden de `docs/activacion-supabase.md`.
