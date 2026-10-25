-- Solo consulta los usuarios de la aplicación. No devuelve hashes ni tokens.
-- Ejecutar con la cuenta administradora de Supabase, en el SQL Editor.
SELECT username AS usuario, name AS nombre, role AS rol, status AS estado
FROM public.users
ORDER BY role, username;
