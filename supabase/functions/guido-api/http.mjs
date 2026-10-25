import { ApiError } from "./core.mjs";
import { StoreError } from "./store.mjs";

export function createHandler(api, store, config) {
  function approved(origin) {
    if (!origin) return true;
    if (config.origins.includes(origin)) return true;
    if (!config.allowLocal) return false;
    try {
      const parsed = new URL(origin);
      return parsed.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(parsed.hostname);
    } catch { return false; }
  }
  return async function handle(request) {
    const origin = request.headers.get("origin"), allowed = approved(origin);
    const headers = new Headers({
      "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff","Vary":"Origin",
      "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-guido-session",
      "Access-Control-Allow-Methods":"POST, OPTIONS"
    });
    if (allowed && origin) headers.set("Access-Control-Allow-Origin",origin);
    const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers});
    if (!allowed) return json({error:{code:"ORIGIN_REJECTED",message:"Origen no autorizado."}},403);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
    if (request.method !== "POST") return json({error:{message:"Método no permitido."}},405);
    let body;
    try {
      if (!api || !store) throw new ApiError(503,"El servicio todavía no está preparado.");
      const raw = await request.text();
      if (raw.length > 131072) throw new ApiError(413,"El formulario supera el tamaño permitido.");
      try { body=JSON.parse(raw); } catch { throw new ApiError(400,"Solicitud no válida."); }
      if (!body || typeof body.action !== "string") throw new ApiError(400,"Solicitud no válida.");
      if (body.action !== "health") {
        const state=await store.rpc("guido_backend_status",{});
        if (state.enabled && !state.protected) throw new ApiError(503,"El acceso protegido necesita revisión del administrador.","PROTECTION_INCOMPLETE");
      }
      return json({data:await api.dispatch(body,request.headers.get("x-guido-session"))});
    } catch(error) {
      if (error instanceof ApiError) return json({error:{code:error.code,message:error.message}},error.status);
      if (error instanceof StoreError) {
        if (body?.action === "health" && ["42P01","PGRST202"].includes(error.code)) return json({data:{version:1,enabled:false,configured:false}});
        if (error.code === "23505") return json({error:{code:"DUPLICATE",message:"Ya existe un registro con esos datos."}},409);
        if (error.code === "P0001") return json({error:{code:"ASSIGNMENT_REJECTED",message:"Revisa la asignación del equipo y conserva un administrador aprobado."}},409);
        if (error.code === "QUERY_LIMIT") return json({error:{code:"QUERY_LIMIT",message:"La consulta supera el límite de esta vista. Contacta al administrador."}},413);
        if (["42P01","PGRST202"].includes(error.code)) return json({error:{code:"SETUP_PENDING",message:"El acceso protegido todavía no está preparado."}},503);
      }
      config.onError?.("REQUEST_FAILED");
      return json({error:{code:"SERVICE_UNAVAILABLE",message:"No pudimos completar la operación. Vuelve a intentarlo."}},503);
    }
  };
}
