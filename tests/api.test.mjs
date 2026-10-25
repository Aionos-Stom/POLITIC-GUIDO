import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture,ids,password } from "./helpers/api-fixture.mjs";
import { ApiError,digest,verifyPassword } from "../supabase/functions/guido-api/core.mjs";
import { createStore } from "../supabase/functions/guido-api/store.mjs";
const failure=(status)=>error=>error instanceof ApiError&&error.status===status;
test("el login conserva PBKDF2 y devuelve perfil sin secretos",async()=>{
 const f=await fixture(),result=await f.login();
 assert.equal(result.profile.id,ids.admin);assert.match(result.token,/^[a-f0-9]{64}$/);
 assert.equal(result.profile.password_hash,undefined);assert.equal(result.profile.reset_token,undefined);
 assert.equal(f.state.guido_sessions[0].token_hash,await digest(result.token));
 assert.notEqual(f.state.guido_sessions[0].token_hash,result.token);
});
test("contraseña incorrecta y perfil pendiente no emiten sesión",async()=>{
 const f=await fixture();await assert.rejects(f.api.dispatch({action:"login",identifier:"admin",password:"Incorrecta"},null),failure(401));
 await assert.rejects(f.login("pending"),failure(403));assert.equal(f.state.guido_sessions.length,0);
});
test("el servidor limita intentos repetidos",async()=>{
 const f=await fixture();for(let i=0;i<10;i++)await assert.rejects(f.api.dispatch({action:"login",identifier:"missing",password},null),failure(401));
 await assert.rejects(f.api.dispatch({action:"login",identifier:"missing",password},null),failure(429));
});
test("la sesión caducada o el perfil deshabilitado no leen registros",async()=>{
 const f=await fixture(),session=await f.login("register");
 f.current.setUTCHours(21);
 await assert.rejects(f.api.dispatch({action:"me"},session.token),failure(401));
});
test("el mapa ignora un rol y un actor falsificados por el navegador",async()=>{
 const f=await fixture(),session=await f.login("register");
 const map=await f.api.dispatch({action:"map",role:"Administrador",actor_id:ids.admin},session.token);
 assert.equal(map.scope,"own");assert.equal(map.zones.length,1);assert.equal(map.zones[0].id,f.state.voters[2].id);
 assert.equal(f.store.calls.filter(call=>call.name==="guido_territory_map").at(-1).args.p_actor_id,ids.reg);
});
test("el coordinador consulta su equipo y excluye otro registrador",async()=>{
 const f=await fixture(),session=await f.login("coordinator");
 const response=await f.api.dispatch({action:"query",command:{table:"voters",operation:"select",columns:"*",filters:[]}},session.token);
 assert.deepEqual(response.map(row=>row.registered_by_id).sort(),[ids.coord,ids.reg].sort());
});
test("un filtro de otro propietario no amplía el alcance",async()=>{
 const f=await fixture(),session=await f.login("register");
 const response=await f.api.dispatch({action:"query",command:{table:"voters",operation:"select",filters:[{column:"registered_by_id",operator:"eq",value:ids.other}]}},session.token);
 assert.equal(response.length,0);
});
test("el administrador ve solicitudes pendientes y nunca hashes",async()=>{
 const f=await fixture(),session=await f.login();
 const response=await f.api.dispatch({action:"query",command:{table:"users",operation:"select",filters:[]}},session.token);
 assert.equal(response.length,5);assert.ok(response.some(row=>row.status==="Pendiente"));
 assert.ok(response.every(row=>!Object.hasOwn(row,"password_hash")));
 await assert.rejects(f.api.dispatch({action:"query",command:{table:"users",operation:"select",columns:"password_hash",filters:[]}},session.token),failure(400));
});
test("una persona sin sesión no puede enumerar usuarios ni leer votantes",async()=>{
 const f=await fixture();
 assert.deepEqual(await f.api.dispatch({action:"query",command:{table:"users",operation:"select",filters:[]}},null),[]);
 await assert.rejects(f.api.dispatch({action:"query",command:{table:"voters",operation:"select",filters:[]}},null),failure(401));
});
test("no se accede a tablas de sesiones ni se cambian roles desde un registrador",async()=>{
 const f=await fixture(),session=await f.login("register");
 await assert.rejects(f.api.dispatch({action:"query",command:{table:"guido_sessions",operation:"select",filters:[]}},session.token),failure(400));
 await assert.rejects(f.api.dispatch({action:"query",command:{table:"users",operation:"update",values:{role:"Administrador"},filters:[{column:"id",operator:"eq",value:ids.reg}]}},session.token),failure(403));
});
test("un registro nuevo recibe al propietario de la sesión aunque el cliente envíe otro",async()=>{
 const f=await fixture(),session=await f.login("register");
 const values={name:"Persona nueva",cedula:"000-0000009-0",phone:"809-000-0009",edad:30,province:"Santo Domingo",municipio:"Este",zone:"A",sector:"Sector",recinto:"Recinto",mesa:"9",registered_by_id:ids.admin};
 const inserted=await f.api.dispatch({action:"query",command:{table:"voters",operation:"insert",values,filters:[]}},session.token);
 assert.equal(inserted[0].registered_by_id,ids.reg);assert.equal(inserted[0].registered_by_role,"Registrador");
});
test("un coordinador no modifica un registro ajeno aunque pueda consultarlo",async()=>{
 const f=await fixture(),session=await f.login("coordinator");
 await assert.rejects(f.api.dispatch({action:"query",command:{table:"voters",operation:"update",values:{name:"Modificado"},filters:[{column:"id",operator:"eq",value:f.state.voters[2].id}]}},session.token),failure(403));
});
test("cerrar sesión revoca el token",async()=>{
 const f=await fixture(),session=await f.login("register");
 await f.api.dispatch({action:"logout"},session.token);
 await assert.rejects(f.api.dispatch({action:"map"},session.token),failure(401));
});
test("una solicitud pública de administrador permanece pendiente",async()=>{
 const f=await fixture();
 await f.api.dispatch({action:"register",name:"Solicitud nueva",username:"new",email:"new@example.invalid",phone:"8090000000",province:"Santo Domingo",zone:"A",role:"Administrador",status:"Aprobado",manager_id:ids.admin,password},null);
 const user=f.state.users.at(-1);assert.equal(user.status,"Pendiente");assert.equal(user.manager_id,null);
 assert.ok(await verifyPassword(password,user.password_hash));
});
test("la recuperación es uniforme, usa la URL del proyecto y guarda un hash",async()=>{
 const f=await fixture();
 const known=await f.api.dispatch({action:"reset-request",email:"admin@example.invalid"},null);
 const missing=await f.api.dispatch({action:"reset-request",email:"missing@example.invalid"},null);
 assert.deepEqual(known,missing);assert.equal(f.emails.length,1);
 const url=new URL(f.emails[0].link);assert.equal(url.origin,"https://aionos-stom.github.io");assert.equal(url.pathname,"/POLITIC-GUIDO/");
 assert.match(f.state.users[0].reset_token,/^sha256:[a-f0-9]{64}$/);
 assert.notEqual(f.state.users[0].reset_token,url.searchParams.get("reset_token"));
});
test("el token de recuperación se consume una vez y revoca todas las sesiones",async()=>{
 const f=await fixture(),session=await f.login();
 await f.api.dispatch({action:"reset-request",email:"admin@example.invalid"},null);
 const token=new URL(f.emails[0].link).searchParams.get("reset_token");
 assert.equal((await f.api.dispatch({action:"reset-check",token},null)).valid,true);
 await f.api.dispatch({action:"reset-apply",token,password:"UnaClaveNueva!2026"},null);
 assert.equal((await f.api.dispatch({action:"reset-check",token},null)).valid,false);
 await assert.rejects(f.api.dispatch({action:"me"},session.token),failure(401));
 assert.ok(await verifyPassword("UnaClaveNueva!2026",f.state.users[0].password_hash));
});
test("una falla de auditoría no presenta como fallida una escritura completada",async()=>{
 const f=await fixture(),session=await f.login();f.store.auditFails=true;
 const updated=await f.api.dispatch({action:"query",command:{table:"users",operation:"update",values:{theme:"dark"},filters:[{column:"id",operator:"eq",value:ids.admin}]}},session.token);
 assert.equal(updated[0].theme,"dark");assert.ok(f.errors.includes("AUDIT_WRITE_FAILED"));
});
test("HTTP rechaza otro origen y la falta de protección sin filtrar secretos",async()=>{
 const f=await fixture();
 const denied=await f.handler(new Request("https://example.invalid",{method:"POST",headers:{Origin:"https://evil.invalid"},body:JSON.stringify({action:"health"})}));
 assert.equal(denied.status,403);assert.equal(denied.headers.get("access-control-allow-origin"),null);
 f.store.protected=false;
 const blocked=await f.handler(new Request("https://example.invalid",{method:"POST",headers:{Origin:"https://aionos-stom.github.io"},body:JSON.stringify({action:"login",identifier:"admin",password})}));
 assert.equal(blocked.status,503);assert.equal((await blocked.json()).error.code,"PROTECTION_INCOMPLETE");
});
test("el filtro de alcance viaja en un AND separado del filtro del cliente",async()=>{
 let captured;
 const store=createStore("https://example.invalid","server-only",async(url,options)=>{captured={url:new URL(url),options};return new Response("[]",{status:200,headers:{"content-range":"*/0"}});});
 await store.select("voters",[{column:"registered_by_id",operator:"eq",value:ids.other},{column:"registered_by_id",operator:"in",value:[ids.reg],acl:true}],["id"]);
 assert.equal(captured.url.searchParams.get("registered_by_id"),"eq."+ids.other);
 assert.equal(captured.url.searchParams.get("and"),"(registered_by_id.in.("+ids.reg+"))");
});
test("la paginación respeta el límite real del proyecto y no descarta filas",async()=>{
 let calls=0;
 const store=createStore("https://example.invalid","server-only",async(url,options)=>{
  calls++;return new Response(JSON.stringify(calls===1?[{id:1},{id:2}]:[{id:3}]),{status:200,headers:{"content-range":calls===1?"0-1/3":"2-2/3"}});
 });
 const rows=await store.select("voters",[],["id"]);assert.equal(rows.length,3);assert.equal(calls,2);
});

test('el administrador no elimina su propia sesión de trabajo',async()=>{
 const f=await fixture(),session=await f.login();
 await assert.rejects(f.api.dispatch({action:'query',command:{table:'users',operation:'delete',filters:[{column:'id',operator:'eq',value:ids.admin}]}},session.token),failure(409));
 assert.ok(f.state.users.some(user=>user.id===ids.admin));
});
test('el catálogo rechaza coordenadas vacías y colores no válidos',async()=>{
 const f=await fixture(),session=await f.login();
 for(const values of [{province:'Santiago',latitude:null,longitude:-70},{province:'Santiago',latitude:19,longitude:-70,color:'url(evil)'},{province:'Santiago',latitude:91,longitude:0}]) {
  await assert.rejects(f.api.dispatch({action:'query',command:{table:'territory_zones',operation:'insert',values,filters:[]}},session.token),failure(400));
 }
 assert.equal(f.state.territory_zones.length,0);
});

test('con la base vacía la primera solicitud no obtiene privilegios de administrador',async()=>{
 const f=await fixture();f.state.users.length=0;
 await f.api.dispatch({action:'register',name:'Primera solicitud',username:'first',email:'first@example.invalid',phone:'8090000000',province:'Santiago',zone:'A',role:'Administrador',password},null);
 assert.equal(f.state.users[0].status,'Pendiente');
 await assert.rejects(f.login('first'),failure(403));
 assert.equal(f.state.guido_sessions.length,0);
});
