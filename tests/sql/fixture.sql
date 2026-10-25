-- Datos sintéticos, solo para el contenedor desechable de verificar-db.cjs.
INSERT INTO public.users(id,name,username,email,phone,password_hash,role,status,province) VALUES
 ('00000000-0000-4000-8000-000000000001','Admin','qa.admin','admin@example.invalid','809-000-0000','hash-sintetico','Administrador','Aprobado','Santo Domingo'),
 ('00000000-0000-4000-8000-000000000002','Coordinador','qa.coord','coord@example.invalid','809-000-0000','hash-sintetico','Coordinador Nacional','Aprobado','Santo Domingo'),
 ('00000000-0000-4000-8000-000000000003','Coordinador hijo','qa.sub','sub@example.invalid','809-000-0000','hash-sintetico','Coordinador Provincial','Aprobado','Santo Domingo'),
 ('00000000-0000-4000-8000-000000000004','Registrador','qa.reg','reg@example.invalid','809-000-0000','hash-sintetico','Registrador','Aprobado','Santo Domingo'),
 ('00000000-0000-4000-8000-000000000005','Otro equipo','qa.other','other@example.invalid','809-000-0000','hash-sintetico','Registrador','Aprobado','Santo Domingo'),
 ('00000000-0000-4000-8000-000000000006','Pendiente','qa.pending','pending@example.invalid','809-000-0000','hash-sintetico','Registrador','Pendiente','Santo Domingo');
INSERT INTO public.voters(name,cedula,province,municipio,zone,sector,registered_by_id)
 SELECT 'Persona '||n,'000-000000'||n||'-0','Santo Domingo','Este','Zona 1','Sector '||n,('00000000-0000-4000-8000-00000000000'||n)::uuid FROM generate_series(1,6) n;
INSERT INTO public.voters(name,cedula,province,sector) VALUES('Registro conservado','000-0000007-0','Santiago','Sector sin propietario');
