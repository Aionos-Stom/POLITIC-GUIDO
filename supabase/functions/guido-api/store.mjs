// Transporte PostgREST privado. El service role permanece únicamente en el runtime Edge.
export class StoreError extends Error {
  constructor(code, status = 500) { super("Operación de almacenamiento no disponible"); this.code = code; this.status = status; }
}
export function createStore(baseUrl, serviceKey, fetcher = fetch) {
  const base = new URL("/rest/v1/", baseUrl);
  const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "return=representation", "Cache-Control": "no-store" };
  async function request(resource, options = {}, params) {
    const url = new URL(resource, base);
    if (params) for (const [key, value] of params) url.searchParams.append(key, value);
    const { metadata, ...fetchOptions } = options;
    const response = await fetcher(url, { ...fetchOptions, headers: { ...headers, ...options.headers } });
    const content = await response.text();
    let result;
    try { result = content ? JSON.parse(content) : null; } catch { throw new StoreError("INVALID_RESPONSE", response.status); }
    if (!response.ok) throw new StoreError(result?.code || "DATABASE_ERROR", response.status);
    return metadata ? { data: result, range: response.headers.get("content-range") } : result;
  }
  function parameters(filters, fields, order) {
    const params = [], access = [];
    if (fields) params.push(["select", Array.isArray(fields) ? fields.join(",") : fields]);
    for (const filter of filters || []) {
      if (filter.operator === "in") {
        if (!Array.isArray(filter.value) || filter.value.some(value => !/^[a-f0-9-]{36}$/i.test(value))) throw new StoreError("INVALID_SCOPE");
        if (filter.acl) access.push(filter.column + ".in.(" + filter.value.join(",") + ")");
        else params.push([filter.column, "in.(" + filter.value.join(",") + ")"]);
      } else if (filter.value === null) {
        params.push([filter.column, filter.operator === "neq" ? "not.is.null" : "is.null"]);
      } else {
        params.push([filter.column, filter.operator + "." + String(filter.value)]);
      }
    }
    if (access.length) params.push(["and", "(" + access.join(",") + ")"]);
    if (order) params.push(["order", order.column + (order.ascending === false ? ".desc" : ".asc")]);
    return params;
  }
  return {
    async rpc(name, body) { return request("rpc/" + name, { method: "POST", body: JSON.stringify(body || {}) }); },
    async one(table, filters, fields) {
      const params = parameters(filters, fields || "*"); params.push(["limit", "2"]);
      const rows = await request(table, {}, params);
      if (!Array.isArray(rows) || rows.length > 1) throw new StoreError("NON_UNIQUE_RESULT");
      return rows[0] || null;
    },
    async select(table, filters, fields, order) {
      const result = [], params = parameters(filters, fields || "*", order);
      if (!order) params.push(["order", "id.asc"]);
      let start = 0;
      for (let page = 0; page < 1000 && start < 100000; page++) {
        const response = await request(table, { metadata: true, headers: { Range: start + "-" + (start + 999), "Range-Unit": "items", Prefer: "count=exact" } }, params);
        const rows = response.data;
        if (!Array.isArray(rows)) throw new StoreError("INVALID_ROWS");
        result.push(...rows);
        start += rows.length;
        const match = response.range?.match(/\/(\d+)$/);
        if (!rows.length || (match && start >= Number(match[1]))) return result;
      }
      throw new StoreError("QUERY_LIMIT");
    },
    async insert(table, values) { return request(table, { method: "POST", body: JSON.stringify(values) }); },
    async update(table, values, filters) { return request(table, { method: "PATCH", body: JSON.stringify(values) }, parameters(filters)); },
    async remove(table, filters) { return request(table, { method: "DELETE" }, parameters(filters)); },
    async resetUser(hashed, legacy, now) {
      if (!/^[a-zA-Z0-9_-]{24,128}$/.test(legacy) || !/^sha256:[a-f0-9]{64}$/.test(hashed)) return null;
      const params = [["or", "(reset_token.eq." + hashed + ",reset_token.eq." + legacy + ")"], ["reset_token_expires", "gt." + now], ["limit", "2"]];
      const rows = await request("users", {}, params);
      return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    }
  };
}
