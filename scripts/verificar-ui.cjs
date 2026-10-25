#!/usr/bin/env node
"use strict";

// Verificación aislada: ninguna petición ni escritura llega a Supabase.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { once } = require("node:events");

const root = path.resolve(__dirname, "..");
const closingReview = process.argv.includes("--cierre");
const output = path.join(root, ".local", "qa");
const screenshots = path.join(output, "capturas");
fs.mkdirSync(screenshots, { recursive: true });
const checks = [];
const failures = [];
const password = "PruebaLocal!2026";
const salt = "11223344556677889900aabbccddeeff";
const hash = salt + ":" + crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
const now = new Date().toISOString();
const fixture = {
  users: [
    { id: "qa-admin", name: "Coordinación de prueba", username: "coordinacion.qa", email: "equipo@example.invalid", role: "Administrador", status: "Aprobado", password_hash: hash, theme: "light", province: "Santo Domingo", zone: "Zona de prueba", created_at: now },
    { id: "qa-registrador", manager_id: "qa-coordinador", name: "Integrante con un nombre y varios apellidos extraordinariamente largos para comprobar la adaptación", username: "registro.qa", email: "registro@example.invalid", role: "Registrador", status: "Aprobado", password_hash: hash, theme: "light", province: "Santo Domingo", zone: "Zona de pruebas de textos extensos", created_at: now },
    { id: "qa-coordinador", name: "Coordinación de equipo de prueba", username: "coordinador.qa", email: "coordinador@example.invalid", role: "Coordinador Provincial", status: "Aprobado", password_hash: hash, theme: "light", created_at: now }
  ],
  voters: [
    { id: "qa-v1", name: "Persona de prueba con nombres compuestos y apellidos muy extensos para revisar la lectura completa", cedula: "000-0000001-0", phone: "809-000-0001", edad: 42, province: "Santo Domingo", municipio: "Municipio con una denominación territorial extensa", distrito: "Distrito de prueba", region: "Región de pruebas", zone: "Zona de organización territorial de nombre extenso", sector: "Sector de prueba", recinto: "Centro comunitario con una descripción extensa sin recortes", mesa: "Mesa 01", observacion: ("Observación de prueba que debe poder leerse completa, conservar sus saltos de línea y ajustarse a cualquier ancho. ").repeat(7) + "\n" + "TextoSinEspacios".repeat(10), registered_by_id: "qa-registrador", registered_by: "registro.qa", registered_by_name: "Integrante de prueba", registered_by_role: "Registrador", created_at: now },
    { id: "qa-v2", name: "Segunda persona de prueba", cedula: "000-0000002-0", phone: "809-000-0002", edad: 30, province: "María Trinidad Sánchez", municipio: "Nagua", zone: "Zona 2", sector: "Sector 2", recinto: "Recinto de prueba", mesa: "02", registered_by_id: "qa-admin", registered_by: "coordinacion.qa", registered_by_role: "Administrador", created_at: now },
    { id: "qa-v3", name: "Tercera persona de prueba", cedula: "000-0000003-0", phone: "809-000-0003", edad: 25, province: "Santo Domingo", municipio: "Santo Domingo Este", zone: "Zona 3", sector: "Sector 3", recinto: "Recinto de prueba", mesa: "03", registered_by_id: "qa-admin", registered_by: "coordinacion.qa", registered_by_role: "Administrador", created_at: now }
  ],
  audit_logs: [{ id: "qa-audit", ts: now, actor: "Coordinación de prueba con nombre completo extenso", actor_username: "coordinacion.qa", actor_role: "Coordinador Nacional de prueba con descripción extensa", action: "VOTER_EDIT", target_name: "Persona de prueba con nombre y apellidos extensos", details: JSON.stringify({ tipo: "edicion", cambios: [{ campo: "Observación", antes: "Texto anterior con información de prueba.", despues: "Descripción extensa ".repeat(20) }] }) }]
};

function mockSupabase(seed) {
  const db = structuredClone(seed);
  window.__qa = { db, fail: false, writes: [] };
  function query(table) {
    const conditions = [];
    let mutation = null, payload = null;
    const builder = {
      select() { return this; },
      eq(key, value) { conditions.push(row => row[key] === value); return this; },
      neq(key, value) { conditions.push(row => row[key] !== value); return this; },
      filter(key, operator, value) { conditions.push(row => String(row[key] || "").toLowerCase() === String(value).toLowerCase()); return this; },
      order() { return this; },
      limit() { return this; },
      insert(value) { mutation = "insert"; payload = value; return this; },
      update(value) { mutation = "update"; payload = value; return this; },
      delete() { mutation = "delete"; return this; },
      single() { return execute(true); },
      maybeSingle() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); }
    };
    async function execute(single) {
      if (window.__qa.fail) return { data: null, error: { message: "Fallo simulado" } };
      const all = db[table] || (db[table] = []);
      const rows = all.filter(row => conditions.every(test => test(row)));
      if (mutation) window.__qa.writes.push({ table, mutation });
      if (mutation === "insert") {
        for (const row of Array.isArray(payload) ? payload : [payload]) all.push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row });
      } else if (mutation === "update") rows.forEach(row => Object.assign(row, payload));
      else if (mutation === "delete") db[table] = all.filter(row => !rows.includes(row));
      return { data: single ? rows[0] || null : rows, error: null };
    }
    return builder;
  }
  window.supabase = { createClient: () => ({ from: query,
    rpc: async function (name) {
      const session = window.getSession?.();
      if (name !== "territory_map_data" || !session || window.__qa.fail || window.__qa.mapDenied) return { data: null, error: { message: "Acceso no disponible" } };
      const rows = window.GuidoTerritory.visibleRows(session, db.voters, db.users);
      const zones = window.GuidoTerritory.groupZones(rows, [], []).map((zone, index) => ({ ...zone, latitude: 18.5 + index * .05, longitude: -69.95 - index * .05 }));
      return { data: { scope: session.role === "Administrador" ? "all" : window.GuidoTerritory.isCoordinator(session.role) ? "team" : "own", zones }, error: null };
    }, functions: { invoke: async () => ({ data: { success: true }, error: null }) } }) };
}
const mockSource = "(" + mockSupabase.toString() + ")(" + JSON.stringify(fixture) + ");";
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpeg": "image/jpeg", ".ttf": "font/ttf" };

function serve(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const filename = path.resolve(root, "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname));
  if (!filename.startsWith(root + path.sep) || pathname.split("/").some(part => part.startsWith("."))) { response.writeHead(403).end(); return; }
  fs.readFile(filename, (error, content) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-store" }).end(content);
  });
}

function getPlaywright() {
  for (const modulePath of [process.env.GUIDO_PLAYWRIGHT_PATH, "playwright", "/home/caos/DevOps/infraestructura/herramientas-locales/browser/node_modules/playwright"].filter(Boolean)) {
    try { return require(modulePath); } catch (error) { if (error.code !== "MODULE_NOT_FOUND") throw error; }
  }
  throw new Error("Playwright no está disponible. Consulta README.md o define GUIDO_PLAYWRIGHT_PATH.");
}
async function check(label, action) {
  await action();
  checks.push(label);
  console.log("✓ " + label);
}
async function overflow(page, stage) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const clipped = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,dt,dd,label,button,summary,.result-field-value,.user-item-info,.chart-row-heading")).filter(element => {
      if (element.closest("[inert],.hidden,.section-hidden,[hidden],.sr-only")) return false;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      return rect.right > width + 2 || rect.left < -2 || element.scrollWidth > element.clientWidth + 2;
    }).map(element => ({ element: element.tagName, class: element.className, text: element.textContent.slice(0, 100) })).slice(0, 12);
    return { viewport: width, document: document.documentElement.scrollWidth, clipped };
  });
  if (result.document > result.viewport + 2 || result.clipped.length) failures.push({ stage, ...result });
  checks.push(stage + ": desbordamientos revisados");
}
async function login(page, username = "coordinacion.qa") {
  await page.locator("#loginUser").fill(username);
  await page.locator("#loginPassword").fill(password);
  await page.locator("#loginForm button[type=submit]").click();
  await page.locator("body.is-authenticated").waitFor();
  await page.waitForFunction(() => document.querySelector("#totalVoters").textContent !== "—");
}

(async () => {
  const server = http.createServer(serve);
  let browser, lastPage;
  const result = { status: "running", started: now, checks, failures, scope: closingReview ? "cierre: móvil 390, texto 200%, API móvil 390 y escritorio 1440" : "matriz completa 320–3840 y API", backend: "simulado; sin tráfico a servicios externos" };
  try {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const origin = "http://127.0.0.1:" + server.address().port;
    const localBrowser = "/home/caos/DevOps/infraestructura/herramientas-locales/browser/browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell";
    const executablePath = process.env.GUIDO_CHROMIUM_PATH || (fs.existsSync(localBrowser) ? localBrowser : undefined);
    browser = await getPlaywright().chromium.launch({ executablePath, headless: true });
    const matrix = [
      ["movil-320", 320, 760], ["android-360", 360, 800], ["movil-390", 390, 844],
      ["android-412", 412, 915], ["movil-horizontal", 844, 390], ["tablet-768", 768, 1024],
      ["tablet-horizontal", 1024, 768], ["escritorio-1440", 1440, 1000],
      ["escritorio-1920", 1920, 1080], ["tv-3840", 3840, 2160]
    ];
    for (const [name, width, height] of matrix.filter(item => !closingReview || item[0] === "movil-390")) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", serviceWorkers: "block", locale: "es-DO", isMobile: width < 600, hasTouch: width < 1100 });
      const page = await context.newPage();
      lastPage = page;
      page.setDefaultTimeout(7000);
      page.on("pageerror", error => failures.push({ stage: name, javascript: error.message }));
      await page.route("**/*", route => {
        const url = route.request().url();
        if (url.startsWith(origin + "/")) return route.continue();
        if (url.includes("/functions/v1/guido-api")) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "FUNCTION_NOT_FOUND", message: "API no desplegado en esta prueba heredada." } }) });
        if (url.includes("@supabase/supabase-js")) return route.fulfill({ contentType: "text/javascript", body: mockSource });
        if (url.startsWith("https://cdn.jsdelivr.net/")) return route.fulfill({ contentType: "text/javascript", body: "/* Dependencia externa sin uso en esta prueba visual. */" });
        failures.push({ stage: name, externalRequestBlocked: url.split("?")[0] });
        return route.abort();
      });
      await page.goto(origin, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const capture = ["movil-320", "movil-390", "tablet-768", "escritorio-1440", "tv-3840"].includes(name);
      async function screenshot(stage) {
        if (capture) await page.screenshot({ path: path.join(screenshots, name + "-" + stage + ".png"), fullPage: true });
      }
      await overflow(page, name + ": entrada");
      await screenshot("entrada");
      await check(name + ": contraseña visible y oculta", async () => {
        await page.locator("[data-password-toggle]").click();
        assert.equal(await page.locator("#loginPassword").getAttribute("type"), "text");
        await page.locator("[data-password-toggle]").click();
        assert.equal(await page.locator("#loginPassword").getAttribute("type"), "password");
      });
      await check(name + ": acceso por pestañas y teclado", async () => {
        await page.locator("#showLogin").focus(); await page.keyboard.press("ArrowRight");
        assert.equal(await page.locator("#showRegister").getAttribute("aria-selected"), "true");
        await overflow(page, name + ": solicitud de acceso");
        await page.keyboard.press("ArrowLeft");
        assert.equal(await page.locator("#showLogin").getAttribute("aria-selected"), "true");
      });
      await check(name + ": recuperación y restauración del foco", async () => {
        await page.locator("#forgotPasswordBtn").click();
        await page.locator("#forgotEmail").waitFor({ state: "visible" });
        await page.waitForFunction(() => document.activeElement.id === "forgotEmail");
        await page.keyboard.press("Escape");
        await page.locator("#forgotPasswordModal").waitFor({ state: "hidden" });
      });
      await check(name + ": validación de campos vacíos", async () => {
        await page.locator("#loginForm button[type=submit]").click();
        assert.equal(await page.locator("#loginUser").getAttribute("aria-invalid"), "true");
      });
      await check(name + ": iniciar sesión sin usar el backend real", () => login(page));
      await check(name + ": globo, zoom y agregados protegidos simulados", async () => {
        await page.waitForFunction(() => document.querySelector('[data-globe="territory"]')?.dataset.ready === "true");
        await page.waitForFunction(() => document.querySelectorAll(".zone-item").length === 3);
        await page.locator('[data-globe-action="in"]').click();
        const zoom = await page.locator('[data-globe="territory"]').getAttribute("data-zoom");
        await page.locator('[data-globe-action="out"]').click();
        assert.notEqual(await page.locator('[data-globe="territory"]').getAttribute("data-zoom"), zoom);
        await page.locator('[data-globe-action="center"]').click();
        await page.locator(".zone-item").first().click();
        assert.ok((await page.locator("#territoryZoneDetail").textContent()).includes("Registros visibles"));
        await page.locator('[data-globe-action="center"]').click();
        await page.waitForFunction(() => {
          const map = window.GuidoGlobe?.map;
          if (!map || !map.canvas.width || !map.canvas.height) return false;
          if (map.gl) {
            const pixel = new Uint8Array(4);
            map.gl.readPixels(Math.floor(map.canvas.width / 2), Math.floor(map.canvas.height / 2), 1, 1, map.gl.RGBA, map.gl.UNSIGNED_BYTE, pixel);
            return pixel[3] > 0;
          }
          return !!map.context && map.context.getImageData(Math.floor(map.canvas.width / 2), Math.floor(map.canvas.height / 2), 1, 1).data[3] > 0;
        });
        assert.ok(await page.locator(".globe-marker:not([hidden])").count() > 0);
      });
      await check(name + ": círculo con ventana de zonas, sectores y cierre accesible", async () => {
        const marker=page.locator('.globe-marker:not([hidden])').first();
        const count=await marker.textContent();
        await marker.click();
        await page.locator('#territoryInfoModal').waitFor({state:'visible'});
        assert.ok((await page.locator('#territoryInfoSummary').textContent()).startsWith(count+' '));
        assert.ok(await page.locator('.territory-info-zone').count()>0);
        assert.ok((await page.locator('#territoryInfoList').textContent()).includes('Sector / barrio'));
        assert.ok((await page.locator('#territoryInfoList').textContent()).includes('Zona'));
        await page.locator('#cancelTerritoryInfoBtn').focus();await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'closeTerritoryInfoBtn');
        await overflow(page,name+': ventana de zonas y sectores');
        await screenshot('detalle-territorial');
        await page.keyboard.press('Escape');
        await page.locator('#territoryInfoModal').waitFor({state:'hidden'});
        assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('globe-marker')),true);
      });
      if (name === "escritorio-1440") await check(name + ": mapa por rol, cierre de sesión y rechazo de acceso", async () => {
        await page.locator("#logoutBtn").click();
        await page.waitForFunction(() => !document.body.classList.contains("is-authenticated"));
        assert.equal(await page.locator(".globe-marker").count(), 0);
        await login(page, "coordinador.qa");
        await page.waitForFunction(() => document.querySelectorAll(".zone-item").length === 1);
        assert.ok((await page.locator("#territoryScope").textContent()).includes("equipo"));
        assert.equal(await page.locator(".zone-item-count").first().textContent(), "1");
        await page.locator("#logoutBtn").click();
        await page.waitForFunction(() => !document.body.classList.contains("is-authenticated"));
        await login(page, "registro.qa");
        await page.waitForFunction(() => document.querySelectorAll(".zone-item").length === 1);
        assert.equal(await page.locator("#territoryScope").textContent(), "Solo tus registros.");
        await page.locator("#logoutBtn").click();
        await page.waitForFunction(() => !document.body.classList.contains("is-authenticated"));
        await login(page);
        await page.waitForFunction(() => document.querySelectorAll(".zone-item").length === 3);
        await page.evaluate(() => { window.__qa.mapDenied = true; });
        await page.locator("#territoryRefreshBtn").click();
        await page.waitForFunction(() => document.querySelector("#territoryUpdated").textContent === "Mapa pendiente de habilitación");
        assert.equal(await page.locator(".globe-marker").count(), 0);
        await page.evaluate(() => { window.__qa.mapDenied = false; });
        await page.locator("#territoryRefreshBtn").click();
        await page.waitForFunction(() => document.querySelectorAll(".zone-item").length === 3);
      });
      await overflow(page, name + ": resumen");
      await screenshot("resumen");
      await check(name + ": consulta, filtros y texto completo", async () => {
        await page.locator('.quick-action[data-navigate="consulta"]').click();
        await page.locator(".result-item").first().waitFor();
        if (width <= 832) await page.locator("#filterToggleBtn").click();
        await page.locator("#filterProvince").selectOption("Santo Domingo");
        await page.waitForFunction(() => document.querySelectorAll(".result-header").length === 2);
        await page.locator("#clearFiltersBtn").click();
        await page.waitForFunction(() => document.querySelectorAll(".result-header").length === 3);
        await page.locator(".result-details summary").first().click();
        assert.ok((await page.locator(".result-note").first().textContent()).includes("TextoSinEspacios".repeat(10)));
        await overflow(page, name + ": consulta con textos extensos");
        await screenshot("consulta");
        await page.locator("#searchInput").fill("Sin coincidencias de prueba");
        await page.locator("[data-clear-search]").waitFor();
        await page.locator("[data-clear-search]").click();
        await page.waitForFunction(() => document.querySelectorAll(".result-header").length === 3);
      });
      await page.evaluate(() => window._showPanel("registro", true));
      await overflow(page, name + ": formulario de registro");
      await screenshot("registro");
      await page.evaluate(() => window._showPanel("usuarios", true));
      await page.locator(".user-item-header").first().click();
      await overflow(page, name + ": usuarios");
      await page.evaluate(() => window._showPanel("auditoria", true));
      await page.waitForFunction(() => document.querySelectorAll("#auditTableBody td[data-label]").length > 0);
      await page.locator(".audit-expand-summary").first().click();
      await overflow(page, name + ": auditoría con descripciones extensas");
      await screenshot("auditoria");
      await page.evaluate(() => window._showPanel("overview", true));
      if (width <= 832) await check(name + ": menú móvil y cierre por teclado", async () => {
        await page.locator("#mobileMenuToggle").click();
        await page.waitForFunction(() => document.querySelector("#appSidebar").classList.contains("open"));
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#mobileMenuToggle").getAttribute("aria-expanded"), "false");
      });
      if (width > 352) await check(name + ": tema oscuro", async () => {
        await page.locator("#themeToggleBtn").click();
        assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
        await overflow(page, name + ": modo oscuro");
        await screenshot("oscuro");
        await page.locator("#themeToggleBtn").click();
      });
      await check(name + ": estado vacío y error de datos", async () => {
        await page.evaluate(async () => { window.__qa.db.voters.length = 0; await window.renderAll(); });
        assert.ok((await page.locator("#provinceChart").textContent()).includes("El próximo registro"));
        await overflow(page, name + ": estado vacío");
        await screenshot("vacio");
        await page.evaluate(async () => { window.__qa.fail = true; await window.renderAll(); });
        assert.equal(await page.locator("#totalVoters").textContent(), "—");
        assert.equal(await page.locator("#appConnectionNotice").isVisible(), true);
        await page.evaluate(async () => { window.__qa.fail = false; await window.renderAll(); });
      });
      if (name === "movil-390") {
        await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
        await check(name + ": texto al 200% reorganiza métricas y navegación", async () => {
          // Verificar el reflujo visible tras el cambio de fuente, no la serialización
          // transitoria de las pistas CSS antes de completar el siguiente layout.
          await page.waitForFunction(() => {
            const cards=Array.from(document.querySelectorAll('.stats-grid > .stat-card')).map(element=>element.getBoundingClientRect());
            const navigation=Array.from(document.querySelector('.mobile-nav').children).map(element=>element.getBoundingClientRect());
            return parseFloat(getComputedStyle(document.documentElement).fontSize)>=32 &&
              cards.length===4 && cards.every(rect=>Math.abs(rect.left-cards[0].left)<1) && cards[1].top>=cards[0].bottom &&
              navigation.length===4 && Math.abs(navigation[0].top-navigation[1].top)<1 && navigation[2].top>navigation[0].top && Math.abs(navigation[0].left-navigation[2].left)<1;
          });
        });
        await overflow(page, name + ": texto al 200%");
        await page.screenshot({ path: path.join(screenshots, "movil-390-texto-200.png"), fullPage: true });
      }
      await context.close();
    }
    await require("./verificar-api-ui.cjs").run({ browser, origin, check, overflow, screenshots, failures });
    result.status = failures.length ? "failed" : "passed";
  } catch (error) {
    result.status = "blocked";
    result.error = error.stack;
    if (lastPage && !lastPage.isClosed()) {
      await lastPage.screenshot({ path: path.join(screenshots, "ultima-incidencia.png"), fullPage: true }).catch(() => {});
      result.lastState = await lastPage.evaluate(() => ({
        query: document.querySelector("#searchInput")?.value,
        count: document.querySelectorAll(".result-header").length,
        message: document.querySelector("#authMessage")?.textContent,
        panel: document.querySelector(".content-panel.panel-active")?.id
      })).catch(() => null);
    }
    console.error(error.message);
  } finally {
    if (browser) await browser.close();
    server.close();
    result.finished = new Date().toISOString();
    const reportPath=path.join(output,closingReview ? "resultado-cierre.json" : "resultado.json");
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log("\nResultado: " + result.status + " · " + checks.length + " comprobaciones · " + failures.length + " incidencias");
    console.log("Informe: " + reportPath);
    if (result.status !== "passed") process.exitCode = 1;
  }
})();
