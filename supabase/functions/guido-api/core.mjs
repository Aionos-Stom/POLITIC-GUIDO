// Reglas del API independiente del transporte. Compatible con Node 22 y Deno.
export const ROLES = [
  "Administrador","Coordinador Nacional","Coordinador Regional","Coordinador Provincial",
  "Coordinadores Municipales","Coordinadores Distritales","Coordinadores de Zona",
  "Secretario Nacional","Encargado Organizacion","Secretario de Planificacion",
  "Secretario de Disciplina","Registrador"
];
export const PROFILE_FIELDS = ["id","name","username","email","phone","role","region","province","municipio","distrito","zone","status","theme","manager_id","created_at","updated_at"];
const VOTER_FIELDS = ["id","name","cedula","phone","edad","region","province","municipio","distrito","zone","sector","mesa","recinto","observacion","registered_by_id","registered_by","registered_by_name","registered_by_role","registered_by_region","registered_by_province","registered_by_municipio","registered_by_distrito","registered_by_zone","created_at","updated_at"];
const AUDIT_FIELDS = ["id","ts","actor","actor_username","actor_role","action","target_id","target_name","details"];
const ZONE_FIELDS = ["id","province","municipio","zone","sector","latitude","longitude","color","updated_at"];
const TABLE_FIELDS = { users: PROFILE_FIELDS, voters: VOTER_FIELDS, audit_logs: AUDIT_FIELDS, territory_zones: ZONE_FIELDS };
const USER_WRITABLE = ["name","username","email","phone","role","region","province","municipio","distrito","zone","status","theme","manager_id"];
const VOTER_WRITABLE = ["name","cedula","phone","edad","region","province","municipio","distrito","zone","sector","mesa","recinto","observacion"];
const HEX = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const encoder = new TextEncoder();
export class ApiError extends Error {
  constructor(status, message, code = "REQUEST_REJECTED") { super(message); this.status = status; this.code = code; }
}
const deny = () => { throw new ApiError(403, "Tu perfil no tiene permiso para esta acción.", "FORBIDDEN"); };
const text = value => String(value ?? "").trim();
const pick = (object, fields) => Object.fromEntries(fields.filter(key => Object.hasOwn(object, key)).map(key => [key, object[key]]));
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
export async function digest(value) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
export function randomToken() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return hex(salt) + ":" + hex(bits);
}
export async function verifyPassword(password, stored) {
  if (!/^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(stored || "")) return false;
  const [saltHex, expected] = stored.toLowerCase().split(":");
  const salt = new Uint8Array(saltHex.match(/../g).map(value => parseInt(value, 16)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  const actual = hex(bits);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
export function profile(user) {
  const safe = pick(user, PROFILE_FIELDS);
  safe.capabilities = { superAccess: user.role === "Administrador", manageUsers: user.role === "Administrador", manageZones: user.role === "Administrador", teamView: /^Coordinador/i.test(user.role) };
  return safe;
}
function validPassword(value) {
  const password = text(value);
  if (password.length < 6 || password.length > 256) throw new ApiError(400, "La contraseña debe tener entre 6 y 256 caracteres.", "INVALID_PASSWORD");
  return password;
}
function stringFields(values, allowed) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new ApiError(400, "Datos de formulario no válidos.");
  const unknown = Object.keys(values).filter(key => !allowed.includes(key) && key !== "updated_at");
  if (unknown.length) throw new ApiError(400, "El formulario contiene campos no permitidos.", "INVALID_FIELDS");
  const result = pick(values, allowed);
  for (const [key, value] of Object.entries(result)) {
    if (key === "manager_id" || key === "edad" || key === "latitude" || key === "longitude") continue;
    result[key] = text(value);
    if (result[key].length > (key === "observacion" ? 20000 : 1000)) throw new ApiError(400, "Uno de los textos supera el tamaño permitido.");
  }
  return result;
}
function validateUser(values) {
  for (const key of ["name","username"]) if (Object.hasOwn(values,key) && !values[key]) throw new ApiError(400,"El nombre y el usuario no pueden estar vacíos.");
  if (Object.hasOwn(values,"phone") && values.phone.replace(/\D/g,"").length !== 10) throw new ApiError(400,"Revisa el teléfono del usuario.");
  if (Object.hasOwn(values, "role") && !ROLES.includes(values.role)) throw new ApiError(400, "Selecciona un rol válido.");
  if (Object.hasOwn(values, "status") && !["Pendiente","Aprobado","Rechazado"].includes(values.status)) throw new ApiError(400, "Estado de usuario no válido.");
  if (Object.hasOwn(values, "email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw new ApiError(400, "Revisa el correo electrónico.");
  if (Object.hasOwn(values, "manager_id") && values.manager_id !== null && !UUID.test(values.manager_id)) throw new ApiError(400, "Responsable no válido.");
  if (Object.hasOwn(values, "theme") && !["light","dark"].includes(values.theme)) throw new ApiError(400, "Tema no válido.");
}
function validateVoter(values) {
  if (Object.hasOwn(values, "name") && !values.name) throw new ApiError(400, "El nombre es obligatorio.");
  if (Object.hasOwn(values, "cedula") && values.cedula.replace(/\D/g, "").length !== 11) throw new ApiError(400, "La cédula debe tener 11 dígitos.");
  if (Object.hasOwn(values, "phone") && values.phone.replace(/\D/g, "").length !== 10) throw new ApiError(400, "El teléfono debe tener 10 dígitos.");
  if (Object.hasOwn(values, "edad") && (!Number.isInteger(Number(values.edad)) || Number(values.edad) < 16 || Number(values.edad) > 120)) throw new ApiError(400, "Revisa la edad del simpatizante.");
}
function validateZone(values, complete = false) {
  if ((complete || Object.hasOwn(values,"province")) && !values.province) throw new ApiError(400,"Selecciona una provincia.");
  for (const [field,limit] of [["latitude",90],["longitude",180]]) {
    if (!complete && !Object.hasOwn(values,field)) continue;
    if (values[field] === null || values[field] === "" || typeof values[field] === "boolean" || !Number.isFinite(Number(values[field])) || Math.abs(Number(values[field])) > limit) throw new ApiError(400,"Ubicación no válida.");
    values[field] = Number(values[field]);
  }
  if (Object.hasOwn(values,"color") && !/^#[a-f0-9]{6}$/i.test(values.color)) throw new ApiError(400,"Color de zona no válido.");
}
function commandFields(command) {
  const fields = TABLE_FIELDS[command.table];
  if (!fields || !["select","insert","update","delete"].includes(command.operation)) throw new ApiError(400, "Operación no disponible.");
  const filters = command.filters || [];
  if (!Array.isArray(filters) || filters.length > 20) throw new ApiError(400, "Filtros no válidos.");
  filters.forEach(filter => {
    if (!fields.includes(filter.column) || !["eq","neq","ilike","gt","gte","lt","lte"].includes(filter.operator) || (typeof filter.value !== "string" && typeof filter.value !== "number" && typeof filter.value !== "boolean" && filter.value !== null)) throw new ApiError(400, "Filtro no permitido.");
  });
  if (command.columns && command.columns !== "*") {
    const columns = command.columns.split(",").map(value => value.trim());
    if (!columns.length || columns.some(column => !fields.includes(column))) throw new ApiError(400, "Selección de campos no permitida.");
  }
  if (command.order && !fields.includes(command.order.column)) throw new ApiError(400, "Orden no permitido.");
  return fields;
}
export function createApi(store, settings) {
  const now = settings.now || (() => new Date());
  const dummyHash = "00000000000000000000000000000000:" + "0".repeat(64);
  async function audit(actor, action, targetId, targetName, details = {}) {
    try {
      await store.insert("audit_logs", { id: crypto.randomUUID(), ts: now().toISOString(), actor: actor?.name || "Sistema", actor_username: actor?.username || "—", actor_role: actor?.role || "—", action, target_id: targetId || null, target_name: targetName || null, details: JSON.stringify(details) });
    } catch { settings.onError?.("AUDIT_WRITE_FAILED"); }
  }
  async function actorFor(token) {
    if (!HEX.test(token || "")) throw new ApiError(401, "Tu sesión ha caducado. Inicia sesión de nuevo.", "SESSION_EXPIRED");
    const session = await store.one("guido_sessions", [{ column: "token_hash", operator: "eq", value: await digest(token) }]);
    if (!session || new Date(session.expires_at) <= now()) throw new ApiError(401, "Tu sesión ha caducado. Inicia sesión de nuevo.", "SESSION_EXPIRED");
    const actor = await store.one("users", [{ column: "id", operator: "eq", value: session.user_id }], PROFILE_FIELDS);
    if (!actor || actor.status !== "Aprobado") throw new ApiError(401, "Tu acceso ya no está habilitado.", "SESSION_EXPIRED");
    return actor;
  }
  async function attempt(identifier) {
    const key = await digest(identifier.toLowerCase());
    if (!(await store.rpc("guido_consume_attempt", { p_identifier_hash: key }))) throw new ApiError(429, "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.", "RATE_LIMITED");
    return key;
  }
  async function login(body) {
    const identifier = text(body.identifier);
    const password = text(body.password);
    if (!identifier || identifier.length > 320 || !password || password.length > 256) throw new ApiError(400, "Ingresa tu usuario o correo y contraseña.");
    const attemptKey = await attempt("login:" + identifier);
    const found = await store.rpc("guido_login_lookup", { p_identifier: identifier });
    const user = Array.isArray(found) && found.length === 1 ? found[0] : null;
    const valid = await verifyPassword(password, user?.password_hash || dummyHash);
    if (!user || !valid) throw new ApiError(401, "Usuario o contraseña incorrectos.", "INVALID_LOGIN");
    if (user.status !== "Aprobado") throw new ApiError(403,"Tu usuario está pendiente de aprobación.","PENDING_APPROVAL");
    const token = randomToken();
    const expiresAt = new Date(now().getTime() + 8 * 60 * 60 * 1000).toISOString();
    await store.insert("guido_sessions", { token_hash: await digest(token), user_id: user.id, expires_at: expiresAt });
    await store.remove("guido_login_attempts", [{ column: "identifier_hash", operator: "eq", value: attemptKey }]);
    await audit(user, "SESSION_LOGIN", user.id, user.name);
    return { profile: profile(user), token, expiresAt };
  }
  async function register(body, token) {
    await attempt("register:" + text(body.email));
    const values = stringFields(pick(body, USER_WRITABLE), USER_WRITABLE);
    if (values.email) values.email = values.email.toLowerCase();
    validateUser(values);
    for (const key of ["name","username","email","phone","role","province","zone"]) if (!values[key]) throw new ApiError(400, "Completa los datos del usuario.");
    const password = validPassword(body.password);
    let actor = null;
    if (token) actor = await actorFor(token);
    const newUser = { ...values, id: crypto.randomUUID(), status: "Pendiente", theme: "light", manager_id: null, password_hash: await hashPassword(password) };
    await store.insert("users", newUser);
    await audit(actor, "USER_CREATE", newUser.id, newUser.name, { usuario: newUser.username, rol: newUser.role, estado: "Pendiente" });
    return { pending: true };
  }
  async function query(command, actor) {
    const fields = commandFields(command);
    if (!actor) {
      if (command.table === "users" && command.operation === "select") return command.single ? null : [];
      throw new ApiError(401, "Inicia sesión para continuar.", "SESSION_EXPIRED");
    }
    const admin = actor.role === "Administrador";
    if (command.table === "audit_logs" && command.operation === "insert") {
      if (command.values?.action === "DATA_EXPORT") await audit(actor, "DATA_EXPORT", null, "Exportación de datos", { alcance: admin ? "Organización" : "Registros autorizados" });
      return [];
    }
    if ((command.table === "audit_logs" || command.table === "territory_zones") && !admin) deny();
    const scope = admin ? [] : await store.rpc("guido_scope_ids", { p_actor_id: actor.id });
    const acl = admin ? [] : [{ column: command.table === "users" ? "id" : "registered_by_id", operator: "in", value: scope, acl: true }];
    const filters = (command.filters || []).concat(acl);
    if (command.operation === "select") {
      const rows = await store.select(command.table, filters, fields, command.order);
      const safe = rows.map(row => command.table === "users" ? profile(row) : pick(row, fields));
      const selected = command.columns && command.columns !== "*" ? safe.map(row => pick(row, command.columns.split(",").map(text))) : safe;
      if (command.single && selected.length > 1) throw new ApiError(409, "La consulta no identifica un único registro.");
      return command.single ? selected[0] || null : selected;
    }
    if (command.table === "audit_logs") {
      if (command.operation === "insert") return [];
      deny();
    }
    if (command.table === "users" && command.operation === "insert") deny();
    let values;
    if (command.operation === "insert") {
      if (command.table === "voters") {
        values = stringFields(command.values, VOTER_WRITABLE.concat(["registered_by_id","registered_by","registered_by_name","registered_by_role","registered_by_region","registered_by_province","registered_by_municipio","registered_by_distrito","registered_by_zone"]));
        validateVoter(values);
        if (!values.name || !values.cedula || !values.phone || !Object.hasOwn(values,"edad") || !values.province || !values.municipio || !values.zone || !values.sector || !values.recinto || !values.mesa) throw new ApiError(400, "Completa los datos obligatorios del simpatizante.");
        Object.assign(values, { registered_by_id: actor.id, registered_by: actor.username, registered_by_name: actor.name, registered_by_role: actor.role, registered_by_region: actor.region || "", registered_by_province: actor.province || "", registered_by_municipio: actor.municipio || "", registered_by_distrito: actor.distrito || "", registered_by_zone: actor.zone || "" });
      } else {
        if (!admin || command.table !== "territory_zones") deny();
        values = stringFields(command.values, ZONE_FIELDS.filter(key => !["id","updated_at"].includes(key)));
        validateZone(values,true);
      }
      const inserted = await store.insert(command.table, values);
      if (command.table === "voters") await audit(actor, "VOTER_CREATE", inserted?.[0]?.id, values.name, pick(values, ["cedula","province","municipio","zone","sector"]));
      return inserted || [];
    }
    const idFilter = (command.filters || []).find(filter => filter.column === "id" && filter.operator === "eq");
    if (!idFilter || !UUID.test(idFilter.value)) throw new ApiError(400, "Identifica el registro que deseas modificar.");
    const original = await store.one(command.table, filters, fields);
    if (!original) throw new ApiError(404, "No se encontró el registro.");
    if (command.operation === "delete") {
      if (!admin) deny();
      if (command.table === "users" && original.id === actor.id) throw new ApiError(409,"No puedes eliminar la cuenta con la que estás trabajando.");
      await store.remove(command.table, filters);
      if (command.table === "users" || command.table === "voters") await audit(actor, command.table === "users" ? "USER_DELETE" : "VOTER_DELETE", original.id, original.name);
      return [];
    }
    if (command.table === "users") {
      values = stringFields(command.values, USER_WRITABLE);
      if (!admin && (original.id !== actor.id || Object.keys(values).some(key => key !== "theme"))) deny();
      validateUser(values);
    } else if (command.table === "voters") {
      if (!admin && original.registered_by_id !== actor.id) deny();
      values = stringFields(command.values, VOTER_WRITABLE);
      validateVoter(values);
    } else {
      if (!admin) deny();
      values = stringFields(command.values, ZONE_FIELDS.filter(key => !["id","updated_at"].includes(key)));
      validateZone(values);
    }
    values.updated_at = now().toISOString();
    const updated = await store.update(command.table, values, filters);
    if (command.table === "users" || command.table === "voters") {
      const changes = Object.entries(values).filter(([key, value]) => key !== "updated_at" && String(original[key] ?? "") !== String(value ?? "")).map(([key, value]) => ({ campo: key, antes: original[key] ?? "", despues: value ?? "" }));
      const action = command.table === "users" ? (values.status === "Aprobado" && original.status !== "Aprobado" ? "USER_APPROVE" : "USER_EDIT") : "VOTER_EDIT";
      if (changes.length) await audit(actor, action, original.id, values.name || original.name, { tipo: "edicion", cambios: changes });
    }
    return (updated || []).map(row => command.table === "users" ? profile(row) : row);
  }
  async function resetUser(token) {
    if (!/^[a-zA-Z0-9_-]{24,128}$/.test(token || "")) return null;
    return store.resetUser("sha256:" + await digest(token), token, now().toISOString());
  }
  return {
    async dispatch(body, token) {
      if (!body || typeof body.action !== "string") throw new ApiError(400, "Solicitud no válida.");
      if (body.action === "health") return store.rpc("guido_backend_status", {});
      if (body.action === "login") return login(body);
      if (body.action === "register") return register(body, token);
      if (body.action === "reset-request") {
        const email = text(body.email).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Revisa el correo electrónico.");
        await attempt("reset:" + email);
        const found = await store.rpc("guido_login_lookup", { p_identifier: email });
        const user = Array.isArray(found) && found.length === 1 && text(found[0].email).toLowerCase() === email ? found[0] : null;
        if (user) {
          const resetToken = randomToken(), stored = "sha256:" + await digest(resetToken);
          const expires = new Date(now().getTime() + 60 * 60 * 1000).toISOString();
          await store.update("users", { reset_token: stored, reset_token_expires: expires }, [{ column: "id", operator: "eq", value: user.id }]);
          const link = new URL(settings.appUrl); link.search = ""; link.hash = ""; link.searchParams.set("reset_token", resetToken);
          try { await settings.sendReset(user.email, user.name, link.href); } catch { settings.onError?.("RESET_DELIVERY_FAILED"); }
        }
        return { accepted: true };
      }
      if (body.action === "reset-check") {
        const user = await resetUser(body.token);
        return { valid: !!user, expiresAt: user?.reset_token_expires || null };
      }
      if (body.action === "reset-apply") {
        const password = validPassword(body.password), user = await resetUser(body.token);
        if (!user) throw new ApiError(400, "El enlace ha expirado o ya fue utilizado.", "INVALID_RESET");
        const updated = await store.update("users", { password_hash: await hashPassword(password), reset_token: null, reset_token_expires: null }, [{ column: "id", operator: "eq", value: user.id }, { column: "reset_token", operator: "eq", value: user.reset_token }, { column: "reset_token_expires", operator: "gt", value: now().toISOString() }]);
        if (!updated.length) throw new ApiError(400, "El enlace ha expirado o ya fue utilizado.", "INVALID_RESET");
        await store.remove("guido_sessions", [{ column: "user_id", operator: "eq", value: user.id }]);
        await audit(user, "PASSWORD_RESET", user.id, user.name);
        return { changed: true };
      }
      if (body.action === "query" && !token && body.command?.table === "users" && body.command?.operation === "select") return query(body.command, null);
      const actor = await actorFor(token);
      if (body.action === "me") return { profile: profile(actor) };
      if (body.action === "logout") {
        await store.remove("guido_sessions", [{ column: "token_hash", operator: "eq", value: await digest(token) }]);
        await audit(actor, "SESSION_LOGOUT", actor.id, actor.name); return { loggedOut: true };
      }
      if (body.action === "map") return store.rpc("guido_territory_map", { p_actor_id: actor.id });
      if (body.action === "query") return query(body.command, actor);
      throw new ApiError(400, "Acción no disponible.");
    }
  };
}
