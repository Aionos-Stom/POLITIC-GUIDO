-- REVERSIÓN EXPLÍCITA al acceso heredado: restaura su superficie de acceso.
-- No ejecutar salvo aprobación de una reversión de emergencia.
-- Corresponde al diagnóstico recibido: RLS estaba desactivado en las tres tablas.
BEGIN;
UPDATE public.guido_settings SET enabled=false WHERE id;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.users,public.voters,public.audit_logs TO anon,authenticated;
-- No se restauran TRUNCATE, TRIGGER ni REFERENCES: la aplicación no los utiliza.
COMMIT;
