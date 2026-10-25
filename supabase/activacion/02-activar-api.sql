-- Fase 2: CORTE DE PRODUCCIÓN. Requiere aprobación y copia de seguridad.
-- Ejecutar solo después de desplegar y probar el API y el frontend compatibles.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.guido_sessions') IS NULL THEN RAISE EXCEPTION 'Falta la preparación aditiva'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE role='Administrador' AND status='Aprobado') THEN
    RAISE EXCEPTION 'Debe existir un administrador aprobado';
  END IF;
END $$;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users,public.voters,public.audit_logs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.users,public.voters,public.audit_logs TO service_role;
UPDATE public.guido_settings SET enabled=true WHERE id;
COMMIT;

SELECT public.guido_backend_status();
