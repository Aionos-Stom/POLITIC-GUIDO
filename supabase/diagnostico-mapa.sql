-- SOLO LECTURA. Una única fila para copiar el diagnóstico completo.
-- No devuelve perfiles, nombres, correos, contraseñas ni simpatizantes.
SELECT
  (SELECT count(*) FROM auth.users) AS cuentas_auth,
  (SELECT count(*) FROM public.users) AS perfiles_users,
  (SELECT count(*) FROM public.users WHERE status='Aprobado') AS perfiles_aprobados,
  (SELECT c.relrowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='users') AS rls_users,
  (SELECT c.relrowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='voters') AS rls_voters,
  (SELECT c.relrowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='audit_logs') AS rls_audit,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='manager_id') AS tiene_manager_id,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='auth_user_id') AS tiene_auth_user_id,
  (SELECT array_agg(DISTINCT role ORDER BY role) FROM public.users) AS roles_existentes,
  coalesce((
    SELECT jsonb_agg(jsonb_build_object('tabla',tablename,'politica',policyname,'roles',roles,'comando',cmd,'condicion',qual,'verificacion',with_check))
    FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename IN ('users','voters','audit_logs')
  ),'[]'::jsonb) AS politicas;
