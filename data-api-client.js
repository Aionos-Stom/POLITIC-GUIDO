/* Adaptador compatible: activa el API protegido solo cuando el backend confirma el corte. */
(function () {
  "use strict";
  var rawClient, endpoint, publicKey, token = "", mode = "pending", storageKey, readyResolve;
  var api = {};
  api.ready = new Promise(function (resolve) { readyResolve = resolve; });
  function error(message, code, status) { return { message: message, code: code || "API_UNAVAILABLE", status: status || 503 }; }
  function clearToken(notify) {
    token = "";
    try { sessionStorage.removeItem(storageKey); } catch {}
    if (notify) window.dispatchEvent(new Event("guido:session-expired"));
  }
  async function call(body, options) {
    options = options || {};
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, options.health ? 5000 : 25000);
    try {
      var headers = { "Content-Type": "application/json", apikey: publicKey, Authorization: "Bearer " + publicKey };
      if (token) headers["X-Guido-Session"] = token;
      var response = await fetch(endpoint, { method: "POST", headers: headers, body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
      var payload; try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload?.error) {
        var failure = payload?.error || error("No pudimos completar la operación.");
        failure.status = response.status;
        if (failure.code === "SESSION_EXPIRED" && token) clearToken(true);
        return { data: null, error: failure };
      }
      if (!payload || !Object.hasOwn(payload,"data")) return { data: null, error: error("Respuesta del servicio no válida.","INVALID_RESPONSE") };
      return { data: payload.data, error: null };
    } catch {
      return { data: null, error: error("No pudimos conectar con el servicio. Comprueba tu conexión y vuelve a intentarlo.") };
    } finally { clearTimeout(timer); }
  }
  async function activeCall(body) {
    await api.ready;
    if (mode === "legacy") return null;
    if (mode !== "api") return { data: null, error: error("El acceso protegido no está disponible. Vuelve a intentarlo.") };
    return call(body);
  }
  async function confirmedDatabaseMode() {
    if (typeof rawClient.rpc !== "function") return "unavailable";
    var controller = new AbortController(), timer;
    try {
      // Los 404 de Functions pueden quedar ocultos por CORS. PostgREST devuelve
      // un error legible y permite confirmar el esquema sin descargar usuarios.
      var request = rawClient.rpc("guido_backend_status");
      if (typeof request?.abortSignal === "function") request = request.abortSignal(controller.signal);
      var result = await Promise.race([request,new Promise(function (resolve) {
        timer = setTimeout(function () { controller.abort(); resolve(null); },5000);
      })]);
      if (result?.error?.code === "PGRST202" && (!result.status || result.status === 404)) return "legacy";
      if (!result?.error && result?.data?.version === 1 && result.data.enabled === false) return "legacy";
      // Si está activado, hay errores de permisos o no se puede verificar, no
      // se permite sustituir el API protegido por consultas directas.
      return "unavailable";
    } catch { return "unavailable"; }
    finally { clearTimeout(timer); controller.abort(); }
  }
  function builder(table) {
    var command = { table: table, operation: "select", columns: "*", filters: [] }, pending;
    var chain = {
      select: function (columns) { command.columns = columns || "*"; return chain; },
      eq: function (column,value) { command.filters.push({column:column,operator:"eq",value:value}); return chain; },
      neq: function (column,value) { command.filters.push({column:column,operator:"neq",value:value}); return chain; },
      filter: function (column,operator,value) { command.filters.push({column:column,operator:operator,value:value}); return chain; },
      order: function (column,options) { command.order={column:column,ascending:options?.ascending !== false}; return chain; },
      insert: function (values) { command.operation="insert"; command.values=values; return chain; },
      update: function (values) { command.operation="update"; command.values=values; return chain; },
      delete: function () { command.operation="delete"; return chain; },
      maybeSingle: function () { command.single=true; return chain; },
      single: function () { command.single=true; return chain; },
      then: function (resolve,reject) { if (!pending) pending=execute(); return pending.then(resolve,reject); },
      catch: function (reject) { if (!pending) pending=execute(); return pending.catch(reject); }
    };
    async function execute() {
      await api.ready;
      if (mode === "legacy") {
        var original=rawClient.from(table);
        if (command.operation==="select") original=original.select(command.columns);
        else original=original[command.operation](command.values);
        command.filters.forEach(function (filter) {
          original=filter.operator==="eq"||filter.operator==="neq" ? original[filter.operator](filter.column,filter.value) : original.filter(filter.column,filter.operator,filter.value);
        });
        if (command.order) original=original.order(command.order.column,{ascending:command.order.ascending});
        if (command.single) original=original.maybeSingle();
        return original;
      }
      if (mode!=="api") return {data:null,error:error("El servicio de datos no está disponible.")};
      return call({action:"query",command:command});
    }
    return chain;
  }
  api.wrap = function (client, config) {
    rawClient=client; publicKey=config.key;
    endpoint=new URL("/functions/v1/guido-api",config.url).href;
    storageKey="guido_session_v1:"+new URL(config.url).hostname;
    try { token=sessionStorage.getItem(storageKey)||""; } catch {}
    call({action:"health"},{health:true}).then(async function (result) {
      if (!result.error && result.data?.version===1 && typeof result.data.enabled==="boolean") mode=result.data.enabled ? "api" : "legacy";
      else if (result.error) mode=await confirmedDatabaseMode();
      else mode="unavailable";
      readyResolve({mode:mode});
    });
    return new Proxy(client,{
      get: function (target,property) {
        if (property==="from") return builder;
        if (property==="rpc") return async function (name,args) {
          await api.ready;
          if (mode==="legacy") return typeof rawClient.rpc==="function" ? rawClient.rpc(name,args) : {data:null,error:error("Consulta no disponible.")};
          if (mode!=="api") return {data:null,error:error("El servicio no está disponible.")};
          if (name!=="territory_map_data") return {data:null,error:error("Consulta no permitida.","FORBIDDEN",403)};
          return call({action:"map"});
        };
        var value=Reflect.get(target,property,target);
        return typeof value==="function" ? value.bind(target) : value;
      }
    });
  };
  api.isSecure=function () { return mode==="api"; };
  api.dropSession=function () { clearToken(false); };
  api.mode=function () { return mode; };
  api.login=async function (identifier,password) {
    var result=await activeCall({action:"login",identifier:identifier,password:password});
    if (result && !result.error) {
      if (!/^[a-f0-9]{64}$/.test(result.data?.token || "") || !result.data?.profile?.id) return {data:null,error:error("No se pudo verificar la sesión.","INVALID_SESSION")};
      token=result.data.token;
      try { sessionStorage.setItem(storageKey,token); } catch {}
    }
    return result;
  };
  api.restore=async function () {
    await api.ready;
    if (mode==="legacy") return null;
    if (mode!=="api") return {data:null,error:error("El servicio no está disponible.")};
    if (!token) return {data:{profile:null},error:null};
    var result=await call({action:"me"});
    if (result.error?.status===401) clearToken(false);
    return result;
  };
  api.logout=async function () {
    await api.ready;
    if (mode==="legacy") return null;
    var result=mode==="api" && token ? await call({action:"logout"}) : {data:null,error:null};
    clearToken(false);
    return result;
  };
  api.register=function (values) { return activeCall(Object.assign({action:"register"},values)); };
  api.requestReset=function (email) { return activeCall({action:"reset-request",email:email}); };
  api.checkReset=function (value) { return activeCall({action:"reset-check",token:value}); };
  api.applyReset=function (value,password) { return activeCall({action:"reset-apply",token:value,password:password}); };
  window.GuidoBackend=api;
})();
