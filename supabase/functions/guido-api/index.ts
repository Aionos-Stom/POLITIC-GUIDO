import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createApi } from "./core.mjs";
import { createStore } from "./store.mjs";
import { createHandler } from "./http.mjs";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const appUrl = Deno.env.get("GUIDO_PUBLIC_APP_URL") || "https://aionos-stom.github.io/POLITIC-GUIDO/";
const origins = (Deno.env.get("GUIDO_APP_ORIGINS") || new URL(appUrl).origin).split(",").map(value => value.trim()).filter(Boolean);
const onError = (code: string) => console.warn("guido-api:",code);
const store = url && serviceKey ? createStore(url,serviceKey) : null;
const api = store ? createApi(store,{
  appUrl,onError,
  async sendReset(email: string,name: string,link: string) {
    const response = await fetch(new URL("/functions/v1/enviar-correo",url),{
      method:"POST",
      headers:{"Content-Type":"application/json",apikey:serviceKey,Authorization:"Bearer "+serviceKey},
      body:JSON.stringify({to_email:email,to_name:name,reset_link:link,expires_in:"1 hora"})
    });
    if (!response.ok) throw new Error("RESET_DELIVERY_FAILED");
  }
}) : null;

serve(createHandler(api,store,{
  origins,
  allowLocal:Deno.env.get("GUIDO_ALLOW_LOCAL_ORIGINS")==="true",
  onError
}));
