(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GuidoTerritory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var COLORS = ["#4585ff", "#ff526a", "#f4f8ff", "#8db3ff", "#ff9daa"];
  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  }
  function key(row) { return [row.province, row.municipio, row.zone, row.sector].map(normalize).join("|"); }
  function isCoordinator(role) { return /^coordinador/i.test(normalize(role)); }
  function teamIds(session, users) {
    if (!session || session.status !== "Aprobado") return new Set();
    if (session.role === "Administrador") return new Set(users.filter(user => user.status === "Aprobado").map(user => user.id).concat(session.id));
    var ids = new Set([session.id]);
    if (!isCoordinator(session.role)) return ids;
    var remaining = users.filter(user => user.status === "Aprobado" && user.role !== "Administrador");
    var changed = true;
    while (changed) {
      changed = false;
      remaining.forEach(function (user) {
        if (user.manager_id && ids.has(user.manager_id) && !ids.has(user.id)) { ids.add(user.id); changed = true; }
      });
    }
    return ids;
  }
  function visibleRows(session, rows, users) {
    if (!session || session.status !== "Aprobado") return [];
    if (session.role === "Administrador") return rows.slice();
    var ids = teamIds(session, users || []);
    return rows.filter(row => ids.has(row.registered_by_id));
  }
  function colorFor(value) {
    var hash = 2166136261;
    for (var character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return COLORS[(hash >>> 0) % COLORS.length];
  }
  function coordinate(latitude, longitude) {
    return latitude !== null && longitude !== null && latitude !== "" && longitude !== "" &&
      Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) &&
      Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
  }
  function groupZones(rows, catalog, provinces) {
    var locations = new Map((catalog || []).map(zone => [key(zone), zone]));
    var provincial = new Map((provinces || []).map(province => [normalize(province.name).replace(/^provincia de /, ""), province]));
    var groups = new Map();
    rows.forEach(function (row) {
      var id = key(row), group = groups.get(id);
      if (!group) {
        var known = locations.get(id);
        var fallback = provincial.get(normalize(row.province));
        var exact = known && coordinate(known.latitude, known.longitude);
        var location = exact ? known : fallback;
        group = {
          id: id, name: row.sector || row.zone || row.municipio || row.province || "Sin zona asignada",
          province: row.province || "", municipio: row.municipio || "", zone: row.zone || "", sector: row.sector || "",
          count: 0, latitude: location ? Number(location.latitude) : null, longitude: location ? Number(location.longitude) : null,
          precision: exact ? "zone" : fallback ? "province" : "unlocated",
          color: known && /^#[a-f0-9]{6}$/i.test(known.color || "") ? known.color : colorFor(id)
        };
        groups.set(id, group);
      }
      group.count++;
    });
    return Array.from(groups.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  }
  function clusterProjected(points, distance) {
    var cells = new Map(), clusters = [], size = distance || 60;
    points.forEach(function (point) {
      var col = Math.floor(point.x / size), row = Math.floor(point.y / size), match = null;
      for (var dx = -1; dx <= 1 && !match; dx++) for (var dy = -1; dy <= 1 && !match; dy++) {
        var nearby = cells.get((col + dx) + ":" + (row + dy)) || [];
        match = nearby.find(cluster => Math.hypot(cluster.x - point.x, cluster.y - point.y) < size);
      }
      if (!match) {
        match = { x: point.x, y: point.y, members: [], count: 0, zoneCount: 0 };
        clusters.push(match);
        var key = col + ":" + row;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(match);
      }
      match.members.push(point); match.count += point.count; match.zoneCount += point.zoneCount || 1;
    });
    return clusters;
  }
  return { normalize, key, teamIds, visibleRows, colorFor, coordinate, groupZones, isCoordinator, clusterProjected };
});
