"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

// Ejecuta las funciones reales de la aplicación, sin eventos, red ni backend.
const source = fs.readFileSync(path.join(__dirname, "../script.js"), "utf8");
const end = source.indexOf("// ── Eventos: Tabs");
assert.ok(end > 0, "Debe existir el límite entre funciones y eventos");

class Element {
  constructor(tag = "div") {
    this.tagName = tag; this.children = []; this.value = ""; this.className = ""; this._html = "";
    this.attributes = {}; this.style = { setProperty: (name, value) => { this.style[name] = value; } };
    this.handlers = new Map();
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(" "), ...names])].join(" ").trim(); },
      remove: (...names) => { this.className = this.className.split(" ").filter(name => !names.includes(name)).join(" "); },
      contains: name => this.className.split(" ").includes(name),
      toggle: (name, force) => { const on = force === undefined ? !this.classList.contains(name) : force; this.classList[on ? "add" : "remove"](name); return on; }
    };
  }
  set innerHTML(value) { this._html = value; this.children = []; }
  get innerHTML() { return this._html; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; this._html = ""; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name,handler) { this.handlers.set(name,handler); }
}

function app() {
  const nodes = new Map();
  const state = { fail: false, delays: [], voters: [], users: [] };
  const document = {
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
    createElement: tag => new Element(tag),
    createDocumentFragment: () => new Element("fragment")
  };
  const client = { from(table) {
    return { async insert(values) { state[table].push(structuredClone(values)); return {data:null,error:null}; }, select() {
      const data = structuredClone(state[table] || []);
      const response = state.fail ? { data: null, error: { message: "Fallo de prueba" } } : { data, error: null };
      const delay = table === "voters" ? state.delays.shift() || 0 : 0;
      return new Promise(resolve => setTimeout(() => resolve(response), delay));
    } };
  } };
  const sandbox = { document, console: { ...console, warn() {} }, Intl, Date, Set, Map, WeakMap, setTimeout, clearTimeout,crypto:globalThis.crypto,TextEncoder,
    CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data.detail; } },
    dispatchEvent() {}, supabase: { createClient: () => client } };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(source.slice(0, end), context);
  return { state, nodes, run: code => vm.runInContext(code, context), element: id => document.getElementById(id) };
}
const voter = (id, owner, province = "Santo Domingo") => ({
  id, registered_by_id: owner, registered_by: owner, name: "Persona " + id, province,
  phone: "809-000-0000", cedula: "000-0000000-0", municipio: "Municipio", created_at: new Date().toISOString()
});

test("un registrador conserva acceso solo a sus propios registros", async () => {
  const { state, run } = app();
  state.voters = [voter("propio", "r1"), voter("ajeno", "r2")];
  run("currentUser = { id: 'r1', role: 'Registrador' }");
  const visible = await run("getVisibleVoters()");
  assert.deepEqual(Array.from(visible, item => item.id), ["propio"]);
  assert.equal((await run("getVisibleUsers()")).length, 0);
  run("currentUser = { id: 'admin', role: 'Administrador' }");
  assert.equal((await run("getVisibleVoters()")).length, 2);
});

test("búsqueda y provincia se aplican juntas y el contador coincide", async () => {
  const { state, run, element } = app();
  state.voters = [voter("uno", "r1"), voter("dos", "r1", "Santiago"), voter("tres", "r1")];
  run("currentUser = { id: 'r1', role: 'Registrador' }");
  element("filterProvince").value = "Santo Domingo";
  element("searchInput").value = "Persona uno";
  const filtered = await run("getFilteredVoters()");
  assert.deepEqual(Array.from(filtered, item => item.id), ["uno"]);
  await run("renderSearchResults()");
  assert.equal(element("filteredCountBadge").textContent, "1 resultado");
});

test("nombres y observaciones completos se escapan sin recortes", async () => {
  const { state, run, element } = app();
  const name = "NombreMuyExtenso".repeat(15) + '<img src=x onerror="alert(1)">';
  const note = "Descripción extensa\n".repeat(80);
  state.voters = [{ ...voter("uno", "r1"), name, observacion: note }];
  run("currentUser = { id: 'r1', role: 'Registrador' }");
  await run("renderSearchResults()");
  const html = element("searchResults").children[0].innerHTML;
  assert.ok(html.includes("NombreMuyExtenso".repeat(15)));
  assert.ok(html.includes("&lt;img src=x"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes(note));
});

test("una consulta anterior lenta no reemplaza la búsqueda actual", async () => {
  const { state, run, element } = app();
  run("currentUser = { id: 'r1', role: 'Registrador' }");
  state.voters = [voter("antiguo", "r1")]; state.delays = [35, 0];
  const previous = run("renderSearchResults()");
  state.voters = [voter("actual", "r1")];
  await run("renderSearchResults()");
  await previous;
  const html = element("searchResults").children[0].innerHTML;
  assert.ok(html.includes("Persona actual"));
  assert.ok(!html.includes("Persona antiguo"));
});

test("las barras conservan el nombre completo de las provincias", async () => {
  const { state, run, element } = app();
  const province = "Provincia con una denominación extensa sin abreviaciones ni puntos suspensivos";
  state.voters = [voter("uno", "r1", province)];
  run("currentUser = { id: 'r1', role: 'Registrador' }");
  await run("drawProvinceChart()");
  const row = element("provinceChart").children[0].children[0];
  assert.equal(row.children[0].children[0].textContent, province);
  assert.equal(row.children[1].children[0].style["--bar-ratio"], "100%");
});

test("una caída del servicio muestra datos no disponibles en lugar de ceros", async () => {
  const { state, run, element } = app();
  run("currentUser = { id: 'r1', role: 'Registrador' }");
  state.fail = true;
  await run("updateStats()");
  assert.equal(element("totalVoters").textContent, "—");
  await run("drawProvinceChart()");
  assert.ok(element("provinceChart").innerHTML.includes("aún no ha cargado"));
  state.fail = false; state.voters = [voter("uno", "r1")];
  await run("updateStats()");
  assert.equal(element("totalVoters").textContent, 1);
});

test("las pestañas mantienen sus estados y asociación accesible", () => {
  const { run, element } = app();
  run("switchTab('register')");
  assert.equal(element("showRegister").getAttribute("aria-selected"), "true");
  assert.equal(element("showLogin").getAttribute("tabindex"), "-1");
  assert.ok(element("registerForm").classList.contains("active"));
  run("switchTab('login')");
  assert.equal(element("showLogin").getAttribute("aria-selected"), "true");
  assert.equal(element("showRegister").getAttribute("tabindex"), "-1");
});

test('cerrar sesión durante una consulta descarta sus datos y sus estadísticas',async()=>{
 const {state,run,element}=app();
 state.voters=[voter('propio','r1')];state.delays=[25,25];
 run("currentUser={id:'r1',role:'Registrador'}");
 element('totalVoters').textContent='—';
 const rows=run('getVisibleVoters()'), stats=run('updateStats()');
 run('currentUser=null');
 assert.equal((await rows).length,0);await stats;
 assert.equal(element('totalVoters').textContent,'—');
});

test('la primera alta de administrador y las altas solicitadas por un administrador quedan pendientes',async()=>{
 for(const existing of [false,true]) {
  const {state,run,element}=app();
  if(existing){state.users.push({id:'admin',username:'existente',email:'existente@example.invalid',role:'Administrador',status:'Aprobado'});run("currentUser={id:'admin',role:'Administrador'}");}
  const values={registerName:'Persona de prueba',registerUsername:'nuevo',registerRole:'Administrador',registerEmail:'nuevo@example.invalid',registerPhone:'8090000000',registerProvince:'Santiago',registerZone:'Zona A',registerPassword:'ClaveDePrueba!2026',registerPasswordConfirm:'ClaveDePrueba!2026'};
  for(const [id,value] of Object.entries(values))element(id).value=value;
  run('resetUserForm=()=>{}; updateAdminAccess=()=>{}; fillFilterOptions=async()=>{}; renderUsers=async()=>{}; updateStats=async()=>{};');
  const start=source.indexOf("DOM.registerForm?.addEventListener('submit'");
  const stop=source.indexOf('// ── Eventos: Editar usuario',start);
  assert.ok(start>0&&stop>start);run(source.slice(start,stop));
  await element('registerForm').handlers.get('submit')({preventDefault(){}});
  assert.equal(state.users.at(-1).status,'Pendiente');
  assert.equal(state.users.at(-1).role,'Administrador');
 }
});
