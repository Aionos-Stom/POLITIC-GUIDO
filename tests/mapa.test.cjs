"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../territory-core.js");
const user = (id, role = "Registrador", manager_id = null, status = "Aprobado") => ({ id, role, manager_id, status });
const rows = [{ id: "a", registered_by_id: "a" }, { id: "c", registered_by_id: "c" }, { id: "r", registered_by_id: "r" }, { id: "n", registered_by_id: "n" }, { id: "x", registered_by_id: "x" }];

test("sin sesión aprobada no hay agregados visibles", () => {
  assert.deepEqual(core.visibleRows(null, rows, []), []);
  assert.deepEqual(core.visibleRows(user("a", "Administrador", null, "Pendiente"), rows, []), []);
});
test("registrador ve solo sus registros aunque otros usuarios apunten a él", () => {
  const session = user("r");
  assert.deepEqual(core.visibleRows(session, rows, [session, user("x", "Registrador", "r")]).map(row => row.id), ["r"]);
});
test("administrador incluye todos los registros, también los de propietarios eliminados", () => {
  const all = rows.concat({ id: "orphan", registered_by_id: null });
  assert.equal(core.visibleRows(user("a", "Administrador"), all, []).length, 6);
});
test("coordinador ve equipo asignado y coordinadores descendientes, sin mezclar otros equipos", () => {
  const coordinator = user("c", "Coordinador Provincial");
  const users = [coordinator, user("r", "Registrador", "c"), user("nested", "Coordinadores Municipales", "c"), user("n", "Registrador", "nested"), user("x", "Registrador", "other")];
  assert.deepEqual(core.visibleRows(coordinator, rows, users).map(row => row.id), ["c", "r", "n"]);
});
test("un integrante pendiente y su rama no amplían el acceso", () => {
  const coordinator = user("c", "Coordinador Regional");
  const users = [coordinator, user("r", "Coordinadores Municipales", "c", "Pendiente"), user("n", "Registrador", "r")];
  assert.deepEqual(core.visibleRows(coordinator, rows, users).map(row => row.id), ["c"]);
});
test("una relación cíclica heredada no produce un bucle", () => {
  const coordinator = user("c", "Coordinador Provincial", "r");
  assert.deepEqual([...core.teamIds(coordinator, [coordinator, user("r", "Coordinador Regional", "c")])].sort(), ["c", "r"]);
});
test("zonas, nombres y colores son estables y no dependen del orden", () => {
  const a = { province: "Santo Domingo", municipio: "Este", zone: "A", sector: "Sector extenso" };
  const b = { ...a, sector: "Otro sector" };
  const first = core.groupZones([a, b, a], [], []);
  const second = core.groupZones([b, a, a], [], []);
  assert.deepEqual(first, second);
  assert.equal(first[0].count, 2);
  assert.equal(first[0].name, "Sector extenso");
  assert.match(first[0].color, /^#[0-9a-f]{6}$/i);
});
test("una provincia es una aproximación explícita; no se inventa una posición de sector", () => {
  const row = { province: "Santo Domingo", municipio: "Este", zone: "A", sector: "Sector de prueba" };
  const [approximate] = core.groupZones([row], [], [{ name: "Santo Domingo", latitude: 18.5, longitude: -70 }]);
  assert.equal(approximate.precision, "province");
  assert.equal(approximate.latitude, 18.5);
  const [unlocated] = core.groupZones([row], [], []);
  assert.equal(unlocated.precision, "unlocated");
  assert.equal(unlocated.latitude, null);
  const [exact] = core.groupZones([row], [{ ...row, latitude: 18.6, longitude: -70.1, color: "#ff526a" }], []);
  assert.equal(exact.precision, "zone");
  assert.equal(exact.latitude, 18.6);
});
test("coordenadas inválidas y valores nulos no se convierten en el punto cero", () => {
  assert.equal(core.coordinate(null, null), false);
  assert.equal(core.coordinate(undefined, undefined), false);
  assert.equal(core.coordinate(91, -70), false);
  assert.equal(core.coordinate(18, 181), false);
  assert.equal(core.coordinate(0, 0), true);
});
test("los puntos cercanos forman un círculo con la suma real, sin ocultar cantidades", () => {
  const groups = core.clusterProjected([
    { x: 100, y: 100, count: 7, zoneCount: 2 },
    { x: 110, y: 105, count: 4, zoneCount: 1 },
    { x: 300, y: 250, count: 2, zoneCount: 1 }
  ], 60);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].count, 11);
  assert.equal(groups[0].zoneCount, 3);
  assert.equal(groups[1].count, 2);
});

function mapHarness(options = {}) {
  class Element {
    constructor() {
      this.children = []; this.style = { setProperty() {} }; this.attributes = {}; this.dataset = {}; this.className = ""; this.handlers = new Map();
      this.classList = {
        contains: name => this.className.split(" ").includes(name),
        add: name => { this.className = [...new Set(this.className.split(" ").concat(name))].join(" ").trim(); },
        remove: name => { this.className = this.className.split(" ").filter(value => value !== name).join(" "); }
      };
    }
    replaceChildren(...children) { this.children = children; }
    appendChild(child) { this.children.push(child); }
    append(...children) { this.children.push(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name,handler) { if (!this.handlers.has(name)) this.handlers.set(name,[]); this.handlers.get(name).push(handler); }
    click() { (this.handlers.get("click") || []).forEach(handler => handler.call(this,{target:this})); }
  }
  const elements = new Map(), events = new Map(), documentEvents = new Map();
  const state = { session: user("c", "Coordinador Provincial"), calls: [], fallbackCalls: 0, resolve: null };
  const document = { hidden: false, getElementById(id) { if (!elements.has(id)) { const element = new Element(); if (id === "territoryInfoModal") element.classList.add("hidden"); elements.set(id,element); } return elements.get(id); }, createElement: () => new Element(), querySelectorAll: () => [], addEventListener: (name, action) => documentEvents.set(name, action) };
  const context = { document, Intl, Date, Map, setTimeout: () => 1, clearTimeout() {}, getSession: () => state.session,
    GuidoTerritory: core, GuidoGlobe: { map: { markers: [], zoom:3.3, request() {}, draw() {}, focus() {} } },
    GuidoGeography: { provinces: Promise.resolve(options.provinces || []) },
    supabase: { rpc(...args) { state.calls.push(args); return new Promise(resolve => { state.resolve = resolve; }); } },
    getVisibleVoters() { state.fallbackCalls++; throw new Error("Descarga masiva prohibida"); },
    fetch: async () => ({ ok: true, json: async () => ({ provinces: [] }) }),
    addEventListener: (name, action) => events.set(name, action) };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../territory-map.js"), "utf8"), context);
  documentEvents.get("DOMContentLoaded")();
  return { context, state, elements, events };
}
test("la petición del mapa no envía un rol ni un usuario elegidos en el cliente", () => {
  const { state } = mapHarness();
  assert.deepEqual(state.calls[0], ["territory_map_data"]);
});
test("una respuesta en tránsito tras cerrar sesión no vuelve a mostrar datos privados", async () => {
  const { state, context, elements, events } = mapHarness();
  state.session = null; events.get("guido:session-changed")();
  state.resolve({ data: { zones: [{ id: "secret", name: "Zona privada", count: 20, latitude: 18, longitude: -70 }] }, error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.GuidoGlobe.map.markers.length, 0);
  assert.equal(JSON.stringify(elements.get("territoryZoneList")).includes("Zona privada"), false);
});
test("si falla la RPC el mapa se cierra, sin recurrir a todos los votantes", async () => {
  const { state, elements } = mapHarness();
  state.resolve({ error: { message: "No autorizado" } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.fallbackCalls, 0);
  assert.equal(elements.get("territoryUpdated").textContent, "Mapa pendiente de habilitación");
});

const textOf=node=>[node?.textContent||'',...(node?.children||[]).map(textOf)].join(' ');
const sampleZone=(id,count=1)=>({id,name:'Sector '+id,province:'Santo Domingo',municipio:'Este',zone:'Zona '+id,sector:'Barrio '+id,count,latitude:18.5,longitude:-70});
async function showMap(harness,zones) {
 harness.state.resolve({data:{scope:'own',zones},error:null});
 await new Promise(resolve=>setImmediate(resolve));
}
test('el círculo provincial abre una ventana con todos sus sectores y cantidades',async()=>{
 const h=mapHarness({provinces:[{name:'Santo Domingo',latitude:18.5,longitude:-70}]});
 await showMap(h,[{...sampleZone('A',3),latitude:null,longitude:null},{...sampleZone('B'),latitude:null,longitude:null}]);
 assert.equal(h.context.GuidoGlobe.map.markers.length,1);
 h.context.GuidoGlobe.map.markers[0].element.click();
 assert.equal(h.elements.get('territoryInfoModal').classList.contains('hidden'),false);
 assert.equal(h.elements.get('territoryInfoSummary').textContent,'4 registros visibles · 2 zonas y sectores');
 assert.equal(h.elements.get('territoryInfoList').children.length,2);
 const text=textOf(h.elements.get('territoryInfoList'));
 for(const expected of ['Barrio A','Barrio B','Zona A','Zona B','Santo Domingo','Este','3 registros'])assert.ok(text.includes(expected));
 assert.equal(h.elements.get('territoryInfoLocation').hidden,false);
});
test('un grupo visual conserva la información de todos los círculos que agrupa',async()=>{
 const h=mapHarness();await showMap(h,[sampleZone('A',2),sampleZone('B',5)]);
 const markers=h.context.GuidoGlobe.map.markers;
 markers[0].element.__cluster={members:markers.map(marker=>({marker}))};markers[0].element.click();
 assert.equal(h.elements.get('territoryInfoSummary').textContent,'7 registros visibles · 2 zonas y sectores');
 assert.equal(h.elements.get('territoryInfoList').children.length,2);
 assert.equal(h.elements.get('territoryInfoLocation').hidden,true);
});
test('la ventana usa texto literal y conserva nombres extensos sin insertar HTML',async()=>{
 const h=mapHarness(),name='<img onerror="alert(1)"> '+ 'BarrioExtenso'.repeat(30);
 await showMap(h,[{...sampleZone('A'),name,sector:name}]);h.context.GuidoGlobe.map.markers[0].element.click();
 assert.equal(h.elements.get('territoryInfoTitle').textContent,name);
 assert.ok(textOf(h.elements.get('territoryInfoList')).includes(name));
 assert.equal(h.elements.get('territoryInfoList').children[0].children[0].children[0].children.length,0);
});
test('el cierre de sesión elimina los detalles de la ventana y las respuestas tardías',async()=>{
 const h=mapHarness();await showMap(h,[sampleZone('privado')]);h.context.GuidoGlobe.map.markers[0].element.click();
 h.state.session=null;h.events.get('guido:session-changed')();
 assert.equal(h.elements.get('territoryInfoModal').classList.contains('hidden'),true);
 assert.equal(h.elements.get('territoryInfoList').children.length,0);
 assert.equal(textOf(h.elements.get('territoryInfoModal')).includes('privado'),false);
});
test('una actualización renueva las cantidades abiertas y un error elimina su contenido',async()=>{
 const h=mapHarness();await showMap(h,[sampleZone('A')]);h.context.GuidoGlobe.map.markers[0].element.click();
 h.events.get('guido:records-changed')();await showMap(h,[sampleZone('A',9)]);
 assert.equal(h.elements.get('territoryInfoSummary').textContent,'9 registros visibles · 1 zona o sector');
 h.events.get('guido:records-changed')();h.state.resolve({error:{message:'No autorizado'}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.elements.get('territoryInfoModal').classList.contains('hidden'),true);
 assert.equal(h.elements.get('territoryInfoList').children.length,0);
});
