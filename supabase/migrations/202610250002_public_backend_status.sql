-- Estado público de activación: solo versión y booleanos, sin cuentas ni datos personales.
-- Aplicar después de 202610250001_territory_backend.sql, antes de activar el API.
BEGIN;
GRANT EXECUTE ON FUNCTION public.guido_backend_status() TO anon,authenticated;
COMMIT;
