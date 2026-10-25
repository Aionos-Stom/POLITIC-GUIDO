import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {fixture,ids,password} from './helpers/api-fixture.mjs';
import {resetMessage,maySend} from '../supabase/functions/enviar-correo/policy.mjs';
const source=fs.readFileSync(new URL('../data-api-client.js',import.meta.url),'utf8');
async function client(options={}) {
  const f=await fixture(),events=[],requests=[],storage=new Map();
  let legacyCalls=0;
  const window={dispatchEvent:event=>events.push(event.type)}, discoveryCalls=[];
  const context=vm.createContext({window,URL,AbortController,setTimeout,clearTimeout,Event,sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},fetch:async(url,init)=>{
    const body=JSON.parse(init.body);requests.push(body);
    if(body.action==='health'&&options.health) return options.health();
    return f.handler(new Request(url,init));
  }});
  vm.runInContext(source,context);
  const wrapped=window.GuidoBackend.wrap({from(){legacyCalls++;return {select:async()=>({data:[{legacy:true}],error:null})};},rpc:async(...args)=>{discoveryCalls.push(args);return options.discovery ? options.discovery() : {data:null,error:{code:'UNAVAILABLE'}};}},{url:'https://example.invalid',key:'public-test-key'});
  await window.GuidoBackend.ready;
  return {...f,backend:window.GuidoBackend,wrapped,events,requests,storage,discoveryCalls,get legacyCalls(){return legacyCalls;}};
}
test('el cliente usa el API real, conserva un token opaco y deriva el mapa de la sesión',async()=>{
 const f=await client();assert.equal(f.backend.mode(),'api');
 const logged=await f.backend.login('register',password);assert.equal(logged.data.profile.id,ids.reg);
 assert.match([...f.storage.values()][0],/^[a-f0-9]{64}$/);
 const query=f.wrapped.from('voters').select('*');const first=await query;await query;
 assert.equal(first.data.length,1);assert.equal(f.requests.filter(value=>value.action==='query').length,1);
 const map=await f.wrapped.rpc('territory_map_data',{actor_id:ids.admin,role:'Administrador'});
 assert.equal(map.data.scope,'own');assert.deepEqual(f.requests.at(-1),{action:'map'});assert.equal(f.legacyCalls,0);
 await f.backend.logout();assert.equal(f.storage.size,0);assert.equal(f.state.guido_sessions.length,0);
});
test('una sesión revocada borra el token y comunica la caducidad',async()=>{
 const f=await client();await f.backend.login('register',password);f.state.guido_sessions.length=0;
 const result=await f.wrapped.from('voters').select('*');assert.equal(result.error.code,'SESSION_EXPIRED');
 assert.equal(f.storage.size,0);assert.deepEqual(f.events,['guido:session-expired']);assert.equal(f.legacyCalls,0);
});
test('404 explícito conserva el acceso heredado antes del despliegue',async()=>{
 const f=await client({health:()=>new Response('{}',{status:404}),discovery:()=>({data:null,error:{code:'PGRST202'},status:404})});
 assert.equal(f.backend.mode(),'legacy');const result=await f.wrapped.from('users').select('*');assert.equal(result.data[0].legacy,true);
});
test('un backend preparado e inactivo conserva el modo heredado',async()=>{
 const f=await client({health:()=>Response.json({data:{version:1,enabled:false}})});
 assert.equal(f.backend.mode(),'legacy');
});
test('errores de red o respuestas inválidas no abren el acceso heredado',async()=>{
 for(const health of [()=>{throw Error('offline');},()=>Response.json({unknown:true}),()=>new Response('{}',{status:503})]) {
  const f=await client({health});assert.equal(f.backend.mode(),'unavailable');
  assert.ok((await f.wrapped.from('users').select('*')).error);assert.equal(f.legacyCalls,0);
 }
});
test('un preflight 404 oculto por CORS conserva el acceso si PostgREST confirma que falta el esquema nuevo',async()=>{
 const f=await client({health:()=>{throw new TypeError('Failed to fetch');},discovery:()=>({data:null,error:{code:'PGRST202'},status:404})});
 assert.equal(f.backend.mode(),'legacy');assert.equal(f.legacyCalls,0);
 assert.deepEqual(f.discoveryCalls,[['guido_backend_status']]);
 assert.equal((await f.wrapped.from('users').select('*')).data[0].legacy,true);
});
test('el estado inactivo confirmado por la base permite continuar antes de activar el API',async()=>{
 const f=await client({health:()=>{throw Error('CORS');},discovery:()=>({data:{version:1,enabled:false,protected:false},error:null})});
 assert.equal(f.backend.mode(),'legacy');assert.equal(f.legacyCalls,0);
});
test('un API activado que falla por CORS nunca vuelve al acceso directo',async()=>{
 const f=await client({health:()=>{throw Error('CORS');},discovery:()=>({data:{version:1,enabled:true,protected:true},error:null})});
 assert.equal(f.backend.mode(),'unavailable');assert.ok((await f.wrapped.from('users').select('*')).error);assert.equal(f.legacyCalls,0);
});
test('la detección no interpreta errores de permisos o de red como un esquema heredado',async()=>{
 for(const discovery of [()=>({data:null,error:{code:'42501'},status:403}),()=>({data:null,error:{message:'Failed to fetch'}}),()=>{throw Error('offline');}]) {
  const f=await client({health:()=>{throw Error('CORS');},discovery});
  assert.equal(f.backend.mode(),'unavailable');assert.equal(f.legacyCalls,0);
 }
});
test('el correo restringe destinatario, enlace y marcado HTML',()=>{
 const app='https://aionos-stom.github.io/POLITIC-GUIDO/';
 const body={to_email:'user@example.invalid',to_name:'<img onerror="x">',reset_link:app+'?reset_token='+'a'.repeat(64)};
 assert.equal(resetMessage(body,app).name,'&lt;img onerror=&quot;x&quot;&gt;');
 for(const link of ['https://evil.invalid/?reset_token='+'a'.repeat(64),app+'?reset_token=short',app+'?reset_token='+'a'.repeat(64)+'&next=evil']) assert.throws(()=>resetMessage({...body,reset_link:link},app));
});
test('después del corte solo el backend puede enviar recuperación',async()=>{
 const request=new Request('https://example.invalid',{headers:{authorization:'Bearer public'}});
 assert.equal(await maySend(request,{rpc:async()=>({enabled:true})},'private-test'),false);
 assert.equal(await maySend(request,{rpc:async()=>({enabled:false})},'private-test'),true);
 assert.equal(await maySend(new Request(request,{headers:{authorization:'Bearer private-test'}}),{rpc:async()=>{throw Error();}},'private-test'),true);
});
