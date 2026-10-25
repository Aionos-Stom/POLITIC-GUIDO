"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../globe.js"), "utf8");
const sandbox = { Math, Promise, Float32Array, document: { addEventListener() {} },
  fetch: async () => ({ ok: true, json: async () => ({ provinces: [] }) }),
  matchMedia: () => ({ matches: true, addEventListener() {} }), devicePixelRatio: 2 };
sandbox.window = sandbox;
vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, "window.__globeTest = { Globe: Globe, point: point, rotation: rotation, rotate: rotate };})();"), sandbox);
const Globe = sandbox.__globeTest.Globe;

test("el punto centrado en el globo se proyecta al centro del lienzo", () => {
  const globe = { yaw: 70 * Math.PI / 180, pitch: 19 * Math.PI / 180, width: 700, height: 400, centerY: 200, radius: 180 };
  const p = Globe.prototype.project.call(globe, -70, 19);
  assert.ok(Math.abs(p.x - 350) < .001);
  assert.ok(Math.abs(p.y - 200) < .001);
  assert.equal(p.front, true);
});
test("el planeta de entrada cabe completo en su lienzo, también en móvil", () => {
  for (const [width, height] of [[700, 448], [354, 320], [288, 320]]) {
    const globe = { scene: { clientWidth: width, clientHeight: height }, canvas: {}, welcome: true, zoom: 1, draw() {}, request() {} };
    Globe.prototype.resize.call(globe);
    assert.ok(globe.centerY - globe.radius >= 0);
    assert.ok(globe.centerY + globe.radius <= height);
    assert.ok(width / 2 - globe.radius >= 0);
    assert.ok(width / 2 + globe.radius <= width);
  }
});
test("un resize sin cambio de tamaño no borra el buffer y dibuja el mapa inmediatamente", () => {
  let assignments = 0, draws = 0, width, height;
  const canvas = {
    get width() { return width; }, set width(value) { width = value; assignments++; },
    get height() { return height; }, set height(value) { height = value; assignments++; }
  };
  const globe = { scene: { clientWidth: 600, clientHeight: 400 }, canvas, welcome: false, zoom: 3.3, draw() { draws++; }, request() { throw new Error("El resize debe dibujar inmediatamente"); } };
  Globe.prototype.resize.call(globe);
  assert.equal(assignments, 2);
  assert.equal(draws, 1);
  Globe.prototype.resize.call(globe);
  assert.equal(assignments, 2);
  assert.equal(draws, 2);
});

test('las 32 provincias del formulario tienen una referencia geográfica válida',()=>{
 const geography=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/data/provincias.json'),'utf8'));
 const script=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
 const expected=vm.runInNewContext(script.match(/const RD_PROVINCES = (\[[\s\S]*?\]);/)[1]);
 assert.equal(geography.provinces.length,32);
 for(const name of expected) {
  const province=geography.provinces.find(value=>value.name===name);
  assert.ok(province,'Referencia de '+name);assert.ok(Number.isFinite(province.latitude)&&Number.isFinite(province.longitude));
 }
});
