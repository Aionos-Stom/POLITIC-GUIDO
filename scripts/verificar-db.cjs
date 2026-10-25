#!/usr/bin/env node
'use strict';
// PostgreSQL efímero, sin puertos publicados, volúmenes del host ni credenciales reales.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'.local','qa');fs.mkdirSync(output,{recursive:true});
const name='guido-db-qa-'+process.pid+'-'+Date.now();
const image=process.env.GUIDO_TEST_POSTGRES_IMAGE||'postgres:17.6-alpine';
const report={status:'running',started:new Date().toISOString(),image,checks:[]};
let created=false;
function docker(args,input,allowFailure=false) {
 const result=spawnSync('docker',args,{input,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
 if(!allowFailure&&(result.error||result.status!==0))throw Error(result.error?.message||result.stderr||result.stdout||'Docker no disponible');
 return result;
}
function sql(source){return docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','--no-psqlrc'],source);}
function file(relative){sql(fs.readFileSync(path.join(root,relative),'utf8'));}
function check(label,source){sql(source);report.checks.push(label);console.log('✓ '+label);}
(async()=>{
 try {
  docker(['version','--format','{{.Server.Version}}']);
  docker(['run','--detach','--rm','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data:rw','--env','POSTGRES_HOST_AUTH_METHOD=trust',image]);created=true;
  let ready=false;
  for(let attempt=0;attempt<60;attempt++) {
   if(docker(['exec',name,'pg_isready','-U','postgres'],undefined,true).status===0){ready=true;break;}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!ready)throw Error('El PostgreSQL de prueba no inició.');
  sql('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; GRANT USAGE ON SCHEMA public TO service_role,authenticated;');
  file('supabase_setup.sql');file('tests/sql/fixture.sql');
  file('supabase/migrations/202610250001_territory_backend.sql');
  file('tests/sql/assertions.sql');report.checks.push('preparación, permisos, jerarquía, agregados, sincronización y límites');
  file('supabase/migrations/202610250001_territory_backend.sql');
  check('migración repetible sin perder cuentas',"SELECT public.qa_assert((SELECT count(*)=5 FROM public.users),'cuentas conservadas');");
  file('supabase/activacion/02-activar-api.sql');
  check('corte protegido confirmado',"SELECT public.qa_assert((public.guido_backend_status()->>'protected')::boolean AND (public.guido_backend_status()->>'enabled')::boolean,'corte protegido');");
  for(const role of ['anon','authenticated']) for(const table of ['users','voters','audit_logs','guido_sessions','territory_zones']) {
   const response=docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','--no-psqlrc'],`SET ROLE ${role}; SELECT * FROM public.${table};`,true);
   if(response.status===0||!response.stderr.includes('permission denied'))throw Error(role+' pudo leer '+table+' o la comprobación falló por otra causa.');
   report.checks.push(role+': acceso directo denegado a '+table);
  }
  check('service_role consulta perfiles y agregados tras el corte',"SET ROLE service_role; SELECT public.guido_login_lookup('qa.admin'); SELECT public.guido_territory_map('00000000-0000-4000-8000-000000000002'); RESET ROLE;");
  check('actualización por backend mantiene el trigger',"SET ROLE service_role; UPDATE public.users SET name='Edición protegida' WHERE username='qa.reg'; RESET ROLE; SELECT public.qa_assert((SELECT registered_by_name='Edición protegida' FROM public.voters WHERE registered_by_id='00000000-0000-4000-8000-000000000004'),'trigger bajo service_role');");
  file('supabase/activacion/03-revertir-corte.sql');
  check('reversión explícita comprobada en entorno desechable',"SELECT public.qa_assert(NOT (public.guido_backend_status()->>'enabled')::boolean AND has_table_privilege('anon','public.users','SELECT'),'reversión');");
  report.status='passed';
 }catch(error){report.status='blocked';report.error=error.message;process.exitCode=1;console.error(error.message);}
 finally {
  if(created)docker(['rm','--force','--volumes',name],undefined,true);
  report.finished=new Date().toISOString();fs.writeFileSync(path.join(output,'base-datos.json'),JSON.stringify(report,null,2));
  console.log('Resultado DB: '+report.status+' · '+report.checks.length+' comprobaciones. Informe: .local/qa/base-datos.json');
 }
})();
