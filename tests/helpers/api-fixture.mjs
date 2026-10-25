import { createApi, hashPassword } from "../../supabase/functions/guido-api/core.mjs";
import { createHandler } from "../../supabase/functions/guido-api/http.mjs";
import { StoreError } from "../../supabase/functions/guido-api/store.mjs";
export const ids = { admin:"00000000-0000-4000-8000-000000000001",coord:"00000000-0000-4000-8000-000000000002",reg:"00000000-0000-4000-8000-000000000003",other:"00000000-0000-4000-8000-000000000004",pending:"00000000-0000-4000-8000-000000000005" };
export const password="PruebaLocal!2026";
let sharedHash;
function matches(row,filters) {
  return filters.every(filter => {
    const value=row[filter.column], wanted=filter.value;
    if (filter.operator==="eq") return value===wanted;
    if (filter.operator==="neq") return value!==wanted;
    if (filter.operator==="in") return wanted.includes(value);
    if (filter.operator==="gt") return value>wanted;
    if (filter.operator==="gte") return value>=wanted;
    if (filter.operator==="lt") return value<wanted;
    if (filter.operator==="lte") return value<=wanted;
    if (filter.operator==="ilike") return String(value).toLowerCase()===String(wanted).toLowerCase();
    return false;
  });
}
export async function fixture() {
  sharedHash ||= await hashPassword(password);
  const current=new Date("2026-10-25T12:00:00Z");
  const base={phone:"809-000-0000",province:"Santo Domingo",municipio:"Este",region:"Ozama",distrito:"Distrito",zone:"Zona A",theme:"light",status:"Aprobado",password_hash:sharedHash,manager_id:null};
  const users=[
    {...base,id:ids.admin,name:"Admin de prueba",username:"admin",email:"admin@example.invalid",role:"Administrador"},
    {...base,id:ids.coord,name:"Coordinación de prueba",username:"coordinator",email:"coordinator@example.invalid",role:"Coordinador Provincial"},
    {...base,id:ids.reg,name:"Registro de prueba",username:"register",email:"register@example.invalid",role:"Registrador",manager_id:ids.coord},
    {...base,id:ids.other,name:"Otra persona de prueba",username:"outsider",email:"other@example.invalid",role:"Registrador"},
    {...base,id:ids.pending,name:"Solicitud pendiente",username:"pending",email:"pending@example.invalid",role:"Registrador",status:"Pendiente"}
  ];
  const voter=(suffix,owner)=>({id:"10000000-0000-4000-8000-00000000000"+suffix,name:"Persona "+suffix,cedula:"000-000000"+suffix+"-0",phone:"809-000-0000",edad:30,province:"Santo Domingo",municipio:"Este",zone:"Zona A",sector:"Sector "+suffix,recinto:"Recinto",mesa:"1",registered_by_id:owner,created_at:current.toISOString()});
  const state={users,voters:[voter("1",ids.admin),voter("2",ids.coord),voter("3",ids.reg),voter("4",ids.other)],guido_sessions:[],guido_login_attempts:[],audit_logs:[],territory_zones:[]};
  const attempts=new Map(), calls=[], emails=[], errors=[];
  const store={
    state,calls,enabled:true,protected:true,auditFails:false,
    async rpc(name,args) {
      calls.push({name,args});
      if (name==="guido_backend_status") return {version:1,enabled:this.enabled,protected:this.protected};
      if (name==="guido_login_lookup") return structuredClone(state.users.filter(user=>user.username.toLowerCase()===args.p_identifier.toLowerCase()||user.email.toLowerCase()===args.p_identifier.toLowerCase()));
      if (name==="guido_consume_attempt") { const count=(attempts.get(args.p_identifier_hash)||0)+1;attempts.set(args.p_identifier_hash,count);return count<=10; }
      if (name==="guido_scope_ids") {
        const actor=state.users.find(user=>user.id===args.p_actor_id);
        if (actor?.role==="Administrador") return state.users.map(user=>user.id);
        if (actor?.role.startsWith("Coordinador")) return state.users.filter(user=>user.id===actor.id||user.manager_id===actor.id).map(user=>user.id);
        return actor?[actor.id]:[];
      }
      if (name==="guido_territory_map") {
        const actor=state.users.find(user=>user.id===args.p_actor_id), scope=await this.rpc("guido_scope_ids",args);
        const rows=state.voters.filter(row=>actor.role==="Administrador"||scope.includes(row.registered_by_id));
        return {scope:actor.role==="Administrador"?"all":actor.role.startsWith("Coordinador")?"team":"own",zones:rows.map(row=>({id:row.id,name:row.sector,province:row.province,municipio:row.municipio,zone:row.zone,sector:row.sector,count:1,latitude:null,longitude:null,color:null}))};
      }
      throw new StoreError("UNKNOWN_RPC");
    },
    async select(table,filters=[],fields) {
      const rows=structuredClone((state[table]||[]).filter(row=>matches(row,filters)));
      return Array.isArray(fields)?rows.map(row=>Object.fromEntries(fields.filter(field=>Object.hasOwn(row,field)).map(field=>[field,row[field]]))):rows;
    },
    async one(table,filters,fields) {return (await this.select(table,filters,fields))[0]||null;},
    async insert(table,values) {
      if(table==="audit_logs"&&this.auditFails)throw new StoreError("AUDIT_UNAVAILABLE");
      const row={id:crypto.randomUUID(),...structuredClone(values)};state[table].push(row);return [structuredClone(row)];
    },
    async update(table,values,filters) {const rows=state[table].filter(row=>matches(row,filters));rows.forEach(row=>Object.assign(row,structuredClone(values)));return structuredClone(rows);},
    async remove(table,filters) {
      if(table==="guido_login_attempts")for(const filter of filters)if(filter.column==="identifier_hash")attempts.delete(filter.value);
      state[table]=state[table].filter(row=>!matches(row,filters));return [];
    },
    async resetUser(hashed,legacy,now) {return structuredClone(state.users.find(user=>(user.reset_token===hashed||user.reset_token===legacy)&&user.reset_token_expires>now)||null);}
  };
  const api=createApi(store,{now:()=>current,appUrl:"https://aionos-stom.github.io/POLITIC-GUIDO/",sendReset:async(email,name,link)=>{emails.push({email,name,link});},onError:code=>errors.push(code)});
  const handler=createHandler(api,store,{origins:["https://aionos-stom.github.io"],allowLocal:false,onError:code=>errors.push(code)});
  async function login(identifier="admin") {return api.dispatch({action:"login",identifier,password},null);}
  return {api,store,state,current,emails,errors,handler,login,attempts};
}
