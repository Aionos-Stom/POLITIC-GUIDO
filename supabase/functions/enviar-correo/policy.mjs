// Validación compartida con pruebas locales; nunca incluye credenciales en errores.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
}
export function resetMessage(body, appUrl) {
  if (!body || typeof body.to_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to_email) || body.to_email.length > 320) throw new Error("INVALID_MESSAGE");
  const expected = new URL(appUrl), link = new URL(body.reset_link);
  if (link.protocol !== "https:" || link.origin !== expected.origin || link.pathname !== expected.pathname || link.username || link.password || link.hash || !/^[a-zA-Z0-9_-]{24,128}$/.test(link.searchParams.get("reset_token") || "") || [...link.searchParams.keys()].some(key => key !== "reset_token")) throw new Error("INVALID_MESSAGE");
  return { email:body.to_email, name:escapeHtml(String(body.to_name || "usuario").slice(0,1000)), link:escapeHtml(link.href), expires:"1 hora" };
}
export async function maySend(request, store, serviceKey) {
  // El envío del API siempre usa la credencial privada del runtime.
  if (serviceKey && request.headers.get("authorization") === "Bearer " + serviceKey) return true;
  // Compatibilidad temporal con el frontend anterior, hasta el corte aprobado.
  const state = await store.rpc("guido_backend_status",{});
  return state.enabled === false;
}
