(function () {
  "use strict";
  var generation = 0, inFlight = false, refreshTimer, selected = null, previous = "", zones = [], provinces = [], infoIds = [];
  function el(id) { return document.getElementById(id); }
  function closeInfo() {
    infoIds = [];
    el("territoryInfoModal")?.classList.add("hidden");
    el("territoryInfoList")?.replaceChildren();
    if (el("territoryInfoSummary")) el("territoryInfoSummary").textContent = "";
    if (el("territoryInfoTitle")) el("territoryInfoTitle").textContent = "Detalle del territorio";
    if (el("territoryInfoScope")) el("territoryInfoScope").textContent = "";
  }
  function zoneFields(zone) {
    return [["Provincia", zone.province || "Sin especificar"], ["Municipio", zone.municipio || "Sin especificar"],
      ["Zona", zone.zone || "Sin especificar"], ["Sector / barrio", zone.sector || "Sin especificar"]];
  }
  function appendFields(container, fields) {
    var list = document.createElement("dl");
    fields.forEach(function (pair) { var block = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = pair[0]; dd.textContent = pair[1]; block.append(dt, dd); list.appendChild(block); });
    container.appendChild(list);
  }
  function renderInfo() {
    var visible = zones.filter(zone => infoIds.includes(zone.id));
    if (!visible.length) { closeInfo(); return; }
    infoIds = visible.map(zone => zone.id);
    var names = Array.from(new Set(visible.map(zone => zone.province).filter(Boolean)));
    el("territoryInfoTitle").textContent = visible.length === 1 ? visible[0].name : names.length === 1 ? "Zonas de " + names[0] : "Zonas de este círculo";
    var count = visible.reduce((sum,zone) => sum + zone.count,0);
    el("territoryInfoSummary").textContent = new Intl.NumberFormat("es-DO").format(count) + (count === 1 ? " registro visible" : " registros visibles") + " · " + visible.length + (visible.length === 1 ? " zona o sector" : " zonas y sectores");
    el("territoryInfoScope").textContent = el("territoryScope").textContent;
    var list = el("territoryInfoList"); list.replaceChildren();
    visible.forEach(function (zone) {
      var card = document.createElement("article"); card.className = "territory-info-zone"; card.setAttribute("role","listitem"); card.dataset.zoneId = zone.id; card.style.setProperty("--zone-color",zone.color);
      var heading = document.createElement("div"); heading.className = "territory-info-zone-heading";
      var title = document.createElement("h4"); title.textContent = zone.name;
      var amount = document.createElement("strong"); amount.className = "territory-info-count"; amount.textContent = new Intl.NumberFormat("es-DO").format(zone.count) + (zone.count === 1 ? " registro" : " registros");
      heading.append(title,amount); card.appendChild(heading); appendFields(card,zoneFields(zone)); list.appendChild(card);
    });
    el("territoryInfoLocation").hidden = !visible.some(zone => zone.precision === "province");
    el("territoryInfoLocateBtn").hidden = !visible.some(zone => zone.latitude !== null && zone.longitude !== null);
  }
  function openInfo(ids) {
    infoIds = ids;
    renderInfo();
    if (!infoIds.length) return;
    var single = infoIds.length === 1 ? zones.find(zone => zone.id === infoIds[0]) : null;
    if (single) setDetail(single,false);
    el("territoryInfoModal").classList.remove("hidden");
  }
  function clearPrivateMap() {
    generation++; previous = ""; zones = []; selected = null;
    if (window.GuidoGlobe?.map) window.GuidoGlobe.map.markers = [];
    el("territoryMarkers")?.replaceChildren();
    var list = el("territoryZoneList");
    if (list) { list.replaceChildren(); var empty = document.createElement("p"); empty.className = "zone-empty"; empty.textContent = "Las zonas aparecerán con tus registros."; list.appendChild(empty); }
    if (el("territoryUpdated")) el("territoryUpdated").textContent = "Sin actualizar";
    if (el("territoryScope")) el("territoryScope").textContent = "Registros según tu nivel de acceso.";
    if (el("territoryLocationNote")) el("territoryLocationNote").hidden = true;
    closeInfo();
    setDetail(null);
    clearTimeout(refreshTimer);
  }
  function setDetail(zone, focusMap) {
    selected = zone?.id || null;
    var detail = el("territoryZoneDetail"); if (!detail) return;
    detail.replaceChildren();
    var title = document.createElement("h4"); title.textContent = zone ? zone.name : "Detalle de zona"; detail.appendChild(title);
    if (!zone) { var hint = document.createElement("p"); hint.textContent = "Selecciona una zona para ver su detalle."; detail.appendChild(hint); return; }
    var fields = [["Registros visibles", new Intl.NumberFormat("es-DO").format(zone.count)]].concat(zoneFields(zone),[["Ubicación", zone.precision === "zone" ? "Sector ubicado" : zone.precision === "province" ? "Referencia aproximada por provincia" : "Pendiente de ubicar"]]);
    appendFields(detail,fields);
    document.querySelectorAll(".zone-item").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.zoneId === selected)));
    var map = window.GuidoGlobe?.map;
    if (focusMap !== false && map && zone.latitude !== null && zone.longitude !== null) map.focus(zone.latitude, zone.longitude, zone.precision === "zone" ? 9 : 5.2);
  }
  function renderMap(data) {
    var map = window.GuidoGlobe?.map, list = el("territoryZoneList"), markers = el("territoryMarkers");
    if (!map || !list || !markers) return;
    var provinceLookup = new Map(provinces.map(province => [window.GuidoTerritory.normalize(province.name).replace(/^provincia de /, ""), province]));
    zones = (data.zones || []).map(function (zone) {
      var hasCoordinate = window.GuidoTerritory.coordinate(zone.latitude, zone.longitude);
      var fallback = provinceLookup.get(window.GuidoTerritory.normalize(zone.province));
      return { ...zone, count: Number(zone.count) || 0, color: /^#[a-f0-9]{6}$/i.test(zone.color || "") ? zone.color : window.GuidoTerritory.colorFor(zone.id),
        latitude: hasCoordinate ? Number(zone.latitude) : fallback?.latitude ?? null,
        longitude: hasCoordinate ? Number(zone.longitude) : fallback?.longitude ?? null,
        precision: hasCoordinate ? "zone" : fallback ? "province" : "unlocated" };
    }).filter(zone => zone.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
    var fingerprint = JSON.stringify(zones);
    if (el("territoryScope")) el("territoryScope").textContent = data.scope === "all" ? "Vista general de la organización." : data.scope === "team" ? "Tus registros y los de tu equipo asignado." : "Solo tus registros.";
    if (fingerprint !== previous) {
      previous = fingerprint; list.replaceChildren(); markers.replaceChildren(); map.markers = [];
      if (!zones.length) {
        var empty = document.createElement("p"); empty.className = "zone-empty"; empty.textContent = "Las zonas aparecerán con tus registros."; list.appendChild(empty);
      }
      zones.forEach(function (zone) {
        var button = document.createElement("button"); button.type = "button"; button.className = "zone-item"; button.dataset.zoneId = zone.id; button.setAttribute("aria-pressed", String(selected === zone.id)); button.style.setProperty("--zone-color", zone.color);
        var dot = document.createElement("span"); dot.className = "zone-swatch"; dot.setAttribute("aria-hidden", "true");
        var copy = document.createElement("span"); copy.className = "zone-item-copy";
        var name = document.createElement("strong"); name.textContent = zone.name; var location = document.createElement("span"); location.textContent = [zone.municipio, zone.province].filter(Boolean).join(", ");
        copy.append(name, location); var count = document.createElement("span"); count.className = "zone-item-count"; count.textContent = new Intl.NumberFormat("es-DO").format(zone.count);
        button.append(dot, copy, count); button.addEventListener("click", function () { setDetail(zone); }); list.appendChild(button);
      });
      // Sin coordenadas exactas se agrupa por provincia: no se inventan ubicaciones de sectores.
      var clusters = new Map();
      zones.forEach(function (zone) {
        if (zone.latitude === null || zone.longitude === null) return;
        var id = zone.precision === "province" ? "province:" + window.GuidoTerritory.normalize(zone.province) : zone.id;
        var marker = clusters.get(id);
        if (!marker) { marker = { ...zone, count: 0, children: [] }; clusters.set(id, marker); }
        marker.count += zone.count; marker.children.push(zone);
      });
      clusters.forEach(function (zone) {
        var button = document.createElement("button"); button.type = "button"; button.className = "globe-marker"; button.style.setProperty("--zone-color", zone.color);
        button.style.setProperty("--marker-size", Math.min(68, 38 + Math.sqrt(zone.count) * 2) + "px");
        button.textContent = new Intl.NumberFormat("es-DO", { notation: zone.count > 999 ? "compact" : "standard" }).format(zone.count);
        var label = (zone.precision === "province" ? zone.province + ", referencia provincial" : zone.name) + ": " + zone.count + " registros visibles";
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-haspopup","dialog"); button.setAttribute("aria-controls","territoryInfoModal");
        button.addEventListener("click", function () {
          var children = button.__cluster ? button.__cluster.members.flatMap(member => member.marker.zones) : zone.children;
          openInfo(Array.from(new Set(children.map(child => child.id))));
        });
        markers.appendChild(button); map.markers.push({ latitude: zone.latitude, longitude: zone.longitude, count: zone.count, zoneCount: zone.children.length, zones: zone.children, label: label, element: button });
      });
      var retained = zones.find(zone => zone.id === selected); setDetail(retained || null,false);
      map.draw();
      if (infoIds.length) renderInfo();
    }
    var approximate = zones.some(zone => zone.precision !== "zone");
    var note = el("territoryLocationNote");
    if (note) {
      note.hidden = !approximate;
      note.textContent = "Los sectores sin ubicación exacta se agrupan en el centro de su provincia. Las zonas sin referencia geográfica permanecen en la lista.";
    }
  }
  async function refresh() {
    var session = typeof window.getSession === "function" ? window.getSession() : null;
    if (!session) { clearPrivateMap(); return; }
    if (inFlight || document.hidden || !window.GuidoGlobe?.map) return;
    var version = generation, userId = session.id; inFlight = true;
    var button = el("territoryRefreshBtn"); if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
    try {
      if (typeof window.supabase?.rpc !== "function") throw new Error("MAP_UNAVAILABLE");
      // El servidor deriva el usuario del token. No se envían roles ni IDs elegidos por el navegador.
      var result = await window.supabase.rpc("territory_map_data");
      if (result.error) throw result.error;
      if (generation !== version || window.getSession()?.id !== userId) return;
      renderMap(result.data || { zones: [] });
      el("territoryUpdated").textContent = "Actualizado " + new Intl.DateTimeFormat("es-DO", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    } catch (error) {
      if (generation !== version || window.getSession()?.id !== userId) return;
      var container = el("territoryZoneList"); container.replaceChildren();
      var message = document.createElement("p"); message.className = "zone-empty";
      message.textContent = "No pudimos verificar el acceso al mapa. Solicita su habilitación a tu administrador o vuelve a intentarlo.";
      container.appendChild(message); el("territoryUpdated").textContent = "Mapa pendiente de habilitación";
      // Nunca recurrir a descargar todos los registros si falla la consulta protegida.
      el("territoryMarkers").replaceChildren(); window.GuidoGlobe.map.markers = []; zones = []; previous = ""; setDetail(null);
      closeInfo();
    } finally {
      inFlight = false;
      if (button) { button.disabled = false; button.removeAttribute("aria-busy"); }
      clearTimeout(refreshTimer);
      if (window.getSession()) refreshTimer = setTimeout(refresh, generation === version ? 30000 : 0);
    }
  }
  document.addEventListener("DOMContentLoaded", function () {
    var geography = window.GuidoGeography?.provinces || fetch("assets/data/provincias.json").then(response => response.ok ? response.json() : { provinces: [] }).then(data => data.provinces || []);
    geography.then(data => { provinces = data; previous = ""; refresh(); }).catch(function () { provinces = []; });
    el("territoryRefreshBtn")?.addEventListener("click", refresh);
    el("closeTerritoryInfoBtn")?.addEventListener("click", closeInfo);
    el("cancelTerritoryInfoBtn")?.addEventListener("click", closeInfo);
    el("territoryInfoModal")?.addEventListener("click", function (event) { if (event.target === this) closeInfo(); });
    el("territoryInfoLocateBtn")?.addEventListener("click", function () {
      var visible = zones.filter(zone => infoIds.includes(zone.id) && zone.latitude !== null && zone.longitude !== null);
      var map = window.GuidoGlobe?.map;
      closeInfo();
      if (map && visible.length) { map.focus(visible[0].latitude,visible[0].longitude,visible.length === 1 && visible[0].precision === "zone" ? 9 : Math.min(128,map.zoom * 2)); map.canvas?.focus({ preventScroll:true }); }
    });
    window.addEventListener("guido:globe-ready", refresh);
    window.addEventListener("guido:records-changed", refresh);
    window.addEventListener("guido:session-changed", function () { clearPrivateMap(); refresh(); });
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); else clearTimeout(refreshTimer); });
    if (window.GuidoGlobe) refresh();
  });
})();
