CREATE OR REPLACE FUNCTION public.qa_assert(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'QA: %',message; END IF; END $$;
SELECT public.qa_assert((public.guido_backend_status()->>'enabled')::boolean=false,'la preparación no activa el corte');
SELECT public.qa_assert(has_table_privilege('anon','public.users','SELECT'),'el acceso anterior se conserva durante preparación');
SELECT public.qa_assert(NOT has_table_privilege('anon','public.guido_sessions','SELECT'),'sesiones privadas');
SELECT public.qa_assert(NOT has_function_privilege('anon','public.guido_territory_map(uuid)','EXECUTE'),'el navegador no elige actor');
SELECT public.qa_assert(NOT has_function_privilege('authenticated','public.guido_login_lookup(text)','EXECUTE'),'hashes solo en backend');
SELECT public.qa_assert(has_function_privilege('service_role','public.guido_territory_map(uuid)','EXECUTE'),'backend autorizado');
UPDATE public.users SET manager_id='00000000-0000-4000-8000-000000000002' WHERE username='qa.sub';
UPDATE public.users SET manager_id='00000000-0000-4000-8000-000000000003' WHERE username IN ('qa.reg','qa.pending');
SELECT public.qa_assert(cardinality(public.guido_scope_ids('00000000-0000-4000-8000-000000000002'))=3,'equipo anidado sin pendientes');
SELECT public.qa_assert(cardinality(public.guido_scope_ids('00000000-0000-4000-8000-000000000004'))=1,'registrador propio');
SELECT public.qa_assert((SELECT sum((z->>'count')::int)=3 FROM jsonb_array_elements(public.guido_territory_map('00000000-0000-4000-8000-000000000002')->'zones') z),'mapa de equipo');
SELECT public.qa_assert((SELECT sum((z->>'count')::int)=7 FROM jsonb_array_elements(public.guido_territory_map('00000000-0000-4000-8000-000000000001')->'zones') z),'admin incluye registros conservados y pendientes');
DO $$ BEGIN
 BEGIN UPDATE public.users SET manager_id=id WHERE username='qa.reg'; RAISE EXCEPTION 'QA: autorreferencia admitida'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'QA:%' THEN RAISE; END IF; END;
 BEGIN UPDATE public.users SET manager_id='00000000-0000-4000-8000-000000000003' WHERE username='qa.coord'; RAISE EXCEPTION 'QA: ciclo admitido'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'QA:%' THEN RAISE; END IF; END;
 BEGIN UPDATE public.users SET manager_id='00000000-0000-4000-8000-000000000005' WHERE username='qa.reg'; RAISE EXCEPTION 'QA: responsable sin rol admitido'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'QA:%' THEN RAISE; END IF; END;
 BEGIN DELETE FROM public.users WHERE username='qa.admin'; RAISE EXCEPTION 'QA: último admin eliminado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'QA:%' THEN RAISE; END IF; END;
 BEGIN UPDATE public.users SET role='Registrador' WHERE username='qa.admin'; RAISE EXCEPTION 'QA: último admin degradado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'QA:%' THEN RAISE; END IF; END;
 BEGIN INSERT INTO public.users(name,username,email,password_hash) VALUES('Duplicado','QA.ADMIN','duplicado@example.invalid','hash'); RAISE EXCEPTION 'QA: duplicado por mayúsculas'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
UPDATE public.users SET name='Nombre actualizado',zone='Zona actualizada' WHERE username='qa.reg';
SELECT public.qa_assert((SELECT registered_by_name='Nombre actualizado' AND registered_by_zone='Zona actualizada' FROM public.voters WHERE registered_by_id='00000000-0000-4000-8000-000000000004'),'registrador sincronizado atómicamente');
SELECT public.qa_assert((SELECT bool_and(public.guido_consume_attempt('prueba')) FROM generate_series(1,10)),'diez intentos disponibles');
SELECT public.qa_assert(NOT public.guido_consume_attempt('prueba'),'intento once bloqueado');
DELETE FROM public.users WHERE username='qa.other';
SELECT public.qa_assert((SELECT registered_by_id IS NULL FROM public.voters WHERE cedula='000-0000005-0'),'eliminar usuario conserva simpatizantes');
