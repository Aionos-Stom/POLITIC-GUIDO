-- Fase 1 ADITIVA: conservar las cuentas y contraseñas existentes.
-- No cambia RLS ni permisos de users/voters/audit_logs. No activar producción sin revisión.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON public.users(manager_id);
-- Si hay identificadores duplicados por mayúsculas, este paso se detiene sin renombrar cuentas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_guido_users_username_ci ON public.users(lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_guido_users_email_ci ON public.users(lower(email));

CREATE TABLE IF NOT EXISTS public.guido_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.guido_settings(id,enabled) VALUES(true,false) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.guido_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_guido_sessions_user ON public.guido_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_guido_sessions_expiry ON public.guido_sessions(expires_at);
CREATE TABLE IF NOT EXISTS public.guido_login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guido_login_attempts_key ON public.guido_login_attempts(identifier_hash,created_at);
CREATE TABLE IF NOT EXISTS public.territory_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province text NOT NULL, municipio text NOT NULL DEFAULT '',
  zone text NOT NULL DEFAULT '', sector text NOT NULL DEFAULT '',
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  color text NOT NULL DEFAULT '#4585ff' CHECK (color ~ '^#[a-fA-F0-9]{6}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_territory_zone_key ON public.territory_zones
  (lower(btrim(province)),lower(btrim(municipio)),lower(btrim(zone)),lower(btrim(sector)));
ALTER TABLE public.guido_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guido_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guido_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_zones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guido_settings,public.guido_sessions,public.guido_login_attempts,public.territory_zones FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.guido_settings,public.guido_sessions,public.guido_login_attempts,public.territory_zones TO service_role;
REVOKE ALL ON SEQUENCE public.guido_login_attempts_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.guido_login_attempts_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.guido_backend_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'version',1,
    'enabled',coalesce((SELECT enabled FROM public.guido_settings WHERE id),false),
    'protected',(
      SELECT count(*)=3 AND bool_and(c.relrowsecurity)
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('users','voters','audit_logs')
    ) AND NOT (
      has_table_privilege('anon','public.users','SELECT') OR has_table_privilege('anon','public.voters','SELECT')
      OR has_table_privilege('anon','public.audit_logs','SELECT')
      OR has_table_privilege('authenticated','public.users','SELECT')
      OR has_table_privilege('authenticated','public.voters','SELECT')
      OR has_table_privilege('authenticated','public.audit_logs','SELECT')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.guido_login_lookup(p_identifier text)
RETURNS SETOF public.users LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT u.* FROM public.users u
  WHERE lower(u.username)=lower(btrim(p_identifier)) OR lower(u.email)=lower(btrim(p_identifier))
  LIMIT 2;
$$;

CREATE OR REPLACE FUNCTION public.guido_consume_attempt(p_identifier_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_identifier_hash));
  DELETE FROM public.guido_login_attempts WHERE created_at < now()-interval '15 minutes';
  IF (SELECT count(*) FROM public.guido_login_attempts WHERE identifier_hash=p_identifier_hash) >= 10 THEN RETURN false; END IF;
  INSERT INTO public.guido_login_attempts(identifier_hash) VALUES(p_identifier_hash);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.guido_scope_ids(p_actor_id uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.users%ROWTYPE; ids uuid[];
BEGIN
  SELECT * INTO actor FROM public.users WHERE id=p_actor_id AND status='Aprobado';
  IF actor.id IS NULL THEN RAISE EXCEPTION 'Perfil no habilitado' USING ERRCODE='42501'; END IF;
  IF actor.role='Administrador' THEN
    RETURN ARRAY(SELECT id FROM public.users);
  END IF;
  WITH RECURSIVE team AS (
    SELECT actor.id AS id,ARRAY[actor.id] AS visited
    UNION ALL
    SELECT u.id,t.visited || u.id FROM public.users u JOIN team t ON u.manager_id=t.id
    WHERE actor.role ~* '^Coordinador' AND u.status='Aprobado' AND u.role<>'Administrador' AND NOT u.id=ANY(t.visited)
  ) SELECT array_agg(id) INTO ids FROM team;
  RETURN ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.guido_validate_user_hierarchy()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE parent_role text; parent_status text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(82461025);
  IF TG_OP='DELETE' THEN
    IF OLD.role='Administrador' AND OLD.status='Aprobado'
      AND (SELECT count(*) FROM public.users WHERE role='Administrador' AND status='Aprobado')<=1 THEN
      RAISE EXCEPTION 'No se puede eliminar el último administrador aprobado';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.role='Administrador' AND OLD.status='Aprobado'
    AND (NEW.role IS DISTINCT FROM 'Administrador' OR NEW.status IS DISTINCT FROM 'Aprobado')
    AND (SELECT count(*) FROM public.users WHERE role='Administrador' AND status='Aprobado')<=1 THEN
    RAISE EXCEPTION 'Debe permanecer un administrador aprobado';
  END IF;
  IF NEW.manager_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.manager_id=NEW.id THEN RAISE EXCEPTION 'Un usuario no puede coordinarse a sí mismo'; END IF;
  SELECT role,status INTO parent_role,parent_status FROM public.users WHERE id=NEW.manager_id;
  IF parent_status IS DISTINCT FROM 'Aprobado' OR NOT (parent_role='Administrador' OR parent_role ~* '^Coordinador') THEN
    RAISE EXCEPTION 'El responsable debe ser un administrador o coordinador aprobado';
  END IF;
  IF EXISTS(
    WITH RECURSIVE ancestors AS (
      SELECT u.id,u.manager_id,ARRAY[u.id] AS visited FROM public.users u WHERE u.id=NEW.manager_id
      UNION ALL
      SELECT u.id,u.manager_id,a.visited || u.id FROM public.users u JOIN ancestors a ON u.id=a.manager_id
      WHERE NOT u.id=ANY(a.visited)
    ) SELECT 1 FROM ancestors WHERE id=NEW.id
  ) THEN RAISE EXCEPTION 'La asignación produciría un ciclo en el equipo'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_territory_manager ON public.users;
DROP TRIGGER IF EXISTS guido_validate_user_hierarchy ON public.users;
CREATE TRIGGER guido_validate_user_hierarchy BEFORE INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guido_validate_user_hierarchy();

-- Mantiene los datos del registrador en la misma transacción que su perfil.
CREATE OR REPLACE FUNCTION public.guido_sync_registrar()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  UPDATE public.voters SET registered_by=NEW.username,registered_by_name=NEW.name,
    registered_by_role=NEW.role,registered_by_region=NEW.region,registered_by_province=NEW.province,
    registered_by_municipio=NEW.municipio,registered_by_distrito=NEW.distrito,registered_by_zone=NEW.zone
  WHERE registered_by_id=NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guido_sync_registrar ON public.users;
CREATE TRIGGER guido_sync_registrar AFTER UPDATE OF name,username,role,region,province,municipio,distrito,zone ON public.users
  FOR EACH ROW WHEN (ROW(OLD.name,OLD.username,OLD.role,OLD.region,OLD.province,OLD.municipio,OLD.distrito,OLD.zone)
    IS DISTINCT FROM ROW(NEW.name,NEW.username,NEW.role,NEW.region,NEW.province,NEW.municipio,NEW.distrito,NEW.zone))
  EXECUTE FUNCTION public.guido_sync_registrar();

CREATE OR REPLACE FUNCTION public.guido_territory_map(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.users%ROWTYPE; ids uuid[]; result jsonb;
BEGIN
  SELECT * INTO actor FROM public.users WHERE id=p_actor_id AND status='Aprobado';
  IF actor.id IS NULL THEN RAISE EXCEPTION 'Perfil no habilitado' USING ERRCODE='42501'; END IF;
  ids:=public.guido_scope_ids(actor.id);
  WITH grouped AS (
    SELECT coalesce(v.province,'') AS province,coalesce(v.municipio,'') AS municipio,
      coalesce(v.zone,'') AS zone,coalesce(v.sector,'') AS sector,count(*) AS count
    FROM public.voters v
    WHERE actor.role='Administrador' OR v.registered_by_id=ANY(ids)
    GROUP BY coalesce(v.province,''),coalesce(v.municipio,''),coalesce(v.zone,''),coalesce(v.sector,'')
  ), located AS (
    SELECT g.*,z.latitude,z.longitude,z.color FROM grouped g LEFT JOIN public.territory_zones z ON
      lower(btrim(z.province))=lower(btrim(g.province)) AND lower(btrim(z.municipio))=lower(btrim(g.municipio)) AND
      lower(btrim(z.zone))=lower(btrim(g.zone)) AND lower(btrim(z.sector))=lower(btrim(g.sector))
  )
  SELECT jsonb_build_object(
    'scope',CASE WHEN actor.role='Administrador' THEN 'all' WHEN actor.role ~* '^Coordinador' THEN 'team' ELSE 'own' END,
    'zones',coalesce(jsonb_agg(jsonb_build_object(
      'id',md5(concat_ws('|',province,municipio,zone,sector)),
      'name',coalesce(nullif(sector,''),nullif(zone,''),nullif(municipio,''),nullif(province,''),'Sin zona asignada'),
      'province',province,'municipio',municipio,'zone',zone,'sector',sector,
      'count',count,'latitude',latitude,'longitude',longitude,'color',color
    ) ORDER BY count DESC),'[]'::jsonb)
  ) INTO result FROM located;
  RETURN result;
END;
$$;
-- Estas funciones con ID de actor solo son accesibles al backend con service_role.
-- El endpoint público deriva el ID de la sesión validada; el navegador no lo controla.
REVOKE ALL ON FUNCTION public.guido_backend_status(),public.guido_login_lookup(text),public.guido_consume_attempt(text),
  public.guido_scope_ids(uuid),public.guido_validate_user_hierarchy(),public.guido_sync_registrar(),public.guido_territory_map(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guido_backend_status(),public.guido_login_lookup(text),public.guido_consume_attempt(text),
  public.guido_scope_ids(uuid),public.guido_territory_map(uuid) TO service_role;
COMMIT;
