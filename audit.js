(function () {
  "use strict";

  var PAGE_SIZE = 50;
  var _page     = 1;
  var _allLogs  = [];

  var ACTION_META = {
    SESSION_LOGIN:   { label: "Inicio de sesión",                  badge: "success", objetivo: "Acceso al sistema"          },
    SESSION_LOGOUT:  { label: "Cierre de sesión",                  badge: "info",    objetivo: "Salida del sistema"         },
    USER_CREATE:     { label: "Usuario registrado",                badge: "success", objetivo: "Gestión de usuarios"        },
    USER_EDIT:       { label: "Usuario modificado",                badge: "warning", objetivo: "Gestión de usuarios"        },
    USER_APPROVE:    { label: "Usuario aprobado",                  badge: "success", objetivo: "Aprobación de acceso"       },
    USER_DELETE:     { label: "Usuario eliminado",                 badge: "danger",  objetivo: "Gestión de usuarios"        },
    VOTER_CREATE:    { label: "Simpatizante registrado",           badge: "success", objetivo: "Registro territorial"       },
    VOTER_EDIT:      { label: "Simpatizante modificado",           badge: "warning", objetivo: "Registro territorial"       },
    VOTER_DELETE:    { label: "Simpatizante eliminado",            badge: "danger",  objetivo: "Registro territorial"       },
    DATA_EXPORT:     { label: "Exportación de datos",              badge: "info",    objetivo: "Generación de reporte"      },
    PASSWORD_RESET:  { label: "Contraseña restablecida",           badge: "warning", objetivo: "Seguridad de cuenta"        },
    VOTER_DUPLICATE: { label: "Intento de cédula duplicada",       badge: "danger",  objetivo: "Control de integridad"      },
  };

  function el(id) { return document.getElementById(id); }

  window.logAudit = function (action, targetId, targetName, details) {
    try {
      var session = window.getSession ? window.getSession() : null;
      var entry = {
        id:             crypto.randomUUID(),
        ts:             new Date().toISOString(),
        actor:          session ? (session.name || session.username) : "Sistema",
        actor_username: session ? session.username : "—",
        actor_role:     session ? session.role     : "—",
        action:         action,
        target_id:      targetId   || null,
        target_name:    targetName || null,
        details:        typeof details === "string" ? details : JSON.stringify(details || {})
      };
      if (window.supabase) {
        window.supabase.from("audit_logs").insert(entry).then(function (res) {
          if (res.error) console.warn("logAudit insert:", res.error.message);
          var panel = el("panelAudit");
          if (panel && !panel.classList.contains("section-hidden")) {
            fetchAndRenderAudit();
          }
        });
      }
    } catch (e) { console.warn("logAudit:", e); }
  };

  window.getAuditLog = async function () {
    try {
      var res = await supabase
        .from("audit_logs")
        .select("*")
        .order("ts", { ascending: false });
      return res.data || [];
    } catch (e) { return []; }
  };

  window.updateAuditAccess = function () {
    var canAccess = typeof window.hasSuperAccess === "function" && window.hasSuperAccess();
    var navBtn  = el("navAuditBtn");
    var panel   = el("panelAudit");

    if (canAccess) {
      navBtn  && navBtn.classList.remove("section-hidden");
      panel   && panel.classList.remove("section-hidden");
      if (_allLogs.length === 0) fetchAndRenderAudit();
    } else {
      navBtn  && navBtn.classList.add("section-hidden");
      panel   && panel.classList.add("section-hidden");
    }
  };

  async function fetchAndRenderAudit() {
    _allLogs = await window.getAuditLog();
    _page    = 1;
    renderAuditStats();
    populateActorFilter();
    renderAuditTable();
  }

  function renderAuditStats() {
    var container = el("auditStats");
    if (!container) return;

    var todayKey = new Date().toISOString().slice(0, 10);
    var total    = _allLogs.length;
    var logins   = _allLogs.filter(function (e) {
      return e.action === "SESSION_LOGIN" && (e.ts || "").slice(0, 10) === todayKey;
    }).length;
    var edits = _allLogs.filter(function (e) {
      return ["USER_EDIT","VOTER_EDIT"].includes(e.action);
    }).length;
    var deletes = _allLogs.filter(function (e) {
      return ["USER_DELETE","VOTER_DELETE"].includes(e.action);
    }).length;

    container.innerHTML = [
      stat("info",    iconActivity(), total,   "Total de eventos"),
      stat("success", iconLogin(),    logins,  "Inicios de sesión hoy"),
      stat("warning", iconEdit(),     edits,   "Ediciones totales"),
      stat("danger",  iconTrash(),    deletes, "Eliminaciones totales"),
    ].join("");
  }

  function stat(type, icon, value, label) {
    return '<div class="audit-stat-card audit-stat-' + type + '">' +
      '<div class="audit-stat-icon">' + icon + '</div>' +
      '<div class="audit-stat-body"><strong>' + value + '</strong><span>' + label + '</span></div>' +
    '</div>';
  }

  function populateActorFilter() {
    var sel = el("auditFilterActor");
    if (!sel) return;
    var cur = sel.value;
    var actors = [...new Set(_allLogs.map(function (e) {
      return (e.actor_username || "—").toLowerCase();
    }))].filter(function (a) { return a && a !== "—"; })
      .sort(function (a, b) { return a.localeCompare(b, "es"); });
    sel.innerHTML = '<option value="">Todos los actores</option>';
    actors.forEach(function (a) {
      sel.innerHTML += '<option value="' + esc(a) + '">' + esc(a) + '</option>';
    });
    if (actors.includes(cur)) sel.value = cur;
  }

  function filteredLogs() {
    var q      = (el("auditSearch")       ?.value.trim().toLowerCase()) || "";
    var action = (el("auditFilterAction") ?.value) || "";
    var actor  = (el("auditFilterActor")  ?.value) || "";
    var from   = (el("auditFilterFrom")   ?.value) || "";
    var to     = (el("auditFilterTo")     ?.value) || "";

    return _allLogs.filter(function (e) {
      var matchQ = !q || [
        e.actor, e.actor_username, e.actor_role,
        e.action, e.target_name, e.details
      ].some(function (f) { return String(f || "").toLowerCase().includes(q); });

      var matchAction = !action || e.action === action;
      var matchActor  = !actor  || (e.actor_username || "").toLowerCase() === actor.toLowerCase();
      var eDate = (e.ts || "").slice(0, 10);
      var matchFrom = !from || eDate >= from;
      var matchTo   = !to   || eDate <= to;

      return matchQ && matchAction && matchActor && matchFrom && matchTo;
    });
  }

  function renderAuditTable() {
    var tbody = el("auditTableBody");
    if (!tbody) return;

    var logs   = filteredLogs();
    var total  = logs.length;
    var pages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
    _page      = Math.min(_page, pages);
    var start  = (_page - 1) * PAGE_SIZE;
    var slice  = logs.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = "";

    if (!slice.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="audit-empty-row">No hay eventos que coincidan con los filtros.</td></tr>';
    } else {
      slice.forEach(function (e) {
        var meta    = ACTION_META[e.action] || { label: e.action, badge: "info", objetivo: "—" };
        var details = safeDetails(e);
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td class="audit-ts-cell">'     + esc(formatTs(e.ts)) + "</td>" +
          '<td><div class="audit-actor-cell"><strong>' + esc(e.actor || "—") +
            '</strong><span>@' + esc(e.actor_username || "—") + "</span></div></td>" +
          '<td><span class="audit-role-pill">' + esc(e.actor_role || "—") + "</span></td>" +
          '<td><div class="audit-action-cell">' +
            '<span class="audit-badge audit-badge-' + meta.badge + '">' + esc(meta.label) + '</span>' +
            '<span class="audit-objetivo">' + esc(meta.objetivo || "—") + '</span>' +
          '</div></td>' +
          '<td>' + (e.target_name
            ? '<span class="audit-target-pill">' + esc(e.target_name) + '</span>'
            : '<span class="audit-null">—</span>') + "</td>" +
          '<td class="audit-details-cell">' + details + "</td>";
        tbody.appendChild(tr);
      });
    }

    renderPagination(total, pages);
  }

  function renderPagination(total, pages) {
    var pag = el("auditPagination");
    if (!pag) return;

    var start = (_page - 1) * PAGE_SIZE + 1;
    var end   = Math.min(_page * PAGE_SIZE, total);

    var info = total === 0
      ? "Sin resultados"
      : "Mostrando " + start + "–" + end + " de " + total + " eventos";

    var btns = "";
    btns += '<button class="audit-pag-btn" data-page="prev" ' + (_page <= 1 ? "disabled" : "") + ' aria-label="Anterior">‹</button>';

    var range = pagRange(_page, pages);
    range.forEach(function (p) {
      if (p === "…") {
        btns += '<span class="audit-pag-btn" style="pointer-events:none">…</span>';
      } else {
        btns += '<button class="audit-pag-btn' + (p === _page ? " active" : "") +
          '" data-page="' + p + '" aria-label="Página ' + p + '" aria-current="' + (p === _page ? "page" : "false") + '">' + p + "</button>";
      }
    });

    btns += '<button class="audit-pag-btn" data-page="next" ' + (_page >= pages ? "disabled" : "") + ' aria-label="Siguiente">›</button>';

    pag.innerHTML = '<span class="audit-pag-info">' + info + '</span><div class="audit-pag-btns">' + btns + "</div>";

    pag.querySelectorAll("button[data-page]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = btn.dataset.page;
        if (p === "prev") _page--;
        else if (p === "next") _page++;
        else _page = parseInt(p, 10);
        renderAuditTable();
      });
    });
  }

  function pagRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, function (_, i) { return i + 1; });
    var pages = [];
    pages.push(1);
    if (cur > 3) pages.push("…");
    for (var i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push("…");
    pages.push(total);
    return pages;
  }

  window.exportAuditLog = async function () {
    var log = await window.getAuditLog();
    if (!log.length) { if (typeof window.showAlert === "function") { await window.showAlert("Sin datos", "No hay datos para exportar.", "info"); } return; }

    var rows = log.map(function (e) {
      var meta = ACTION_META[e.action] || { label: e.action, objetivo: "—" };
      return [
        formatTs(e.ts),
        e.actor          || "—",
        e.actor_username || "—",
        e.actor_role     || "—",
        meta.label,
        meta.objetivo    || "—",
        e.target_name    || "—",
        safeDetailsPlain(e.details),
      ];
    });

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([
      ["HISTORIAL DE AUDITORÍA — GUIDO · Siempre cerca de ti"],
      ["Generado: " + new Date().toLocaleString("es-DO")],
      [],
      ["Fecha/Hora", "Actor", "Usuario", "Rol", "Acción", "Objetivo", "Sobre quién", "Detalles"],
    ].concat(rows));
    XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
    XLSX.writeFile(wb, "auditoria_" + new Date().toISOString().slice(0,10) + ".xlsx");

    try {
      var doc = new window.jspdf.jsPDF();
      doc.setFillColor(7, 26, 68);
      doc.rect(0, 0, 210, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text("GUIDO — Historial de Auditoría", 14, 12);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.text("Generado: " + new Date().toLocaleString("es-DO"), 14, 24);
      doc.autoTable({
        startY: 28,
        head: [["Fecha/Hora", "Actor", "Rol", "Acción", "Objetivo", "Sobre quién", "Detalles"]],
        body: rows.map(function (r) { return [r[0], r[1], r[3], r[4], r[5], r[6], r[7]]; }),
        styles: { fontSize: 6.5 },
        headStyles: { fillColor: [7, 26, 68] },
        columnStyles: { 6: { cellWidth: 60 } }
      });
      doc.save("auditoria_" + new Date().toISOString().slice(0,10) + ".pdf");
    } catch (pdfErr) { console.warn("PDF export:", pdfErr); }

    window.logAudit("DATA_EXPORT", null, "Auditoría", "Exportación del historial");
  };

  document.addEventListener("DOMContentLoaded", function () {
    ["auditSearch","auditFilterAction","auditFilterActor","auditFilterFrom","auditFilterTo"]
      .forEach(function (id) {
        var node = el(id);
        if (!node) return;
        node.addEventListener("input",  function () { _page = 1; renderAuditTable(); });
        node.addEventListener("change", function () { _page = 1; renderAuditTable(); });
      });

    var exportBtn = el("auditExportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () { window.exportAuditLog(); });
    }

    var navBtn = el("navAuditBtn");
    if (navBtn) {
      navBtn.addEventListener("click", function () {
        fetchAndRenderAudit();
      });
    }
  });

  function formatTs(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-DO", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  }

  function safeDetails(e) {
    var raw    = e.details;
    var action = e.action || "";
    if (!raw) return '<span class="audit-null">—</span>';

    var obj = {};
    try { obj = JSON.parse(raw); } catch (x) {
      var s = String(raw); s = s.length > 50 ? s.slice(0, 48) + "…" : s;
      return '<span class="audit-detail-text">' + esc(s) + '</span>';
    }
    if (typeof obj !== "object" || obj === null) obj = {};

    if (obj.tipo === "edicion" && Array.isArray(obj.cambios)) {
      var cambios = obj.cambios.filter(function(c) { return c && c.campo; });
      if (!cambios.length) return '<span class="audit-null">Sin cambios</span>';
      var rows = cambios.map(function(c) {
        return '<div class="audit-diff-row">' +
          '<span class="audit-diff-campo">' + esc(c.campo) + '</span>' +
          '<span class="audit-diff-antes">' + esc(String(c.antes)) + '</span>' +
          '<span class="audit-diff-arrow">→</span>' +
          '<span class="audit-diff-despues">' + esc(String(c.despues)) + '</span>' +
        '</div>';
      }).join('');
      var n = cambios.length;
      return '<details class="audit-expand">' +
        '<summary class="audit-expand-summary">' + n + ' campo' + (n !== 1 ? 's' : '') + ' modificado' + (n !== 1 ? 's' : '') + '</summary>' +
        '<div class="audit-diff-list">' + rows + '</div>' +
      '</details>';
    }

    if (obj.tipo === "eliminacion" || obj.tipo === "registro") {
      var entries = Object.entries(obj).filter(function(kv) {
        return kv[0] !== "tipo" && kv[1] && kv[1] !== "—";
      });
      if (!entries.length) return '<span class="audit-null">—</span>';
      var peek = entries.slice(0, 2).map(function(kv) { return esc(String(kv[1])); }).join(' · ');
      var body = entries.map(function(kv) {
        return '<div class="audit-diff-row">' +
          '<span class="audit-diff-campo">' + esc(kv[0]) + '</span>' +
          '<span class="audit-diff-despues">' + esc(String(kv[1])) + '</span>' +
        '</div>';
      }).join('');
      return '<details class="audit-expand">' +
        '<summary class="audit-expand-summary">' + peek + '</summary>' +
        '<div class="audit-diff-list">' + body + '</div>' +
      '</details>';
    }

    var parts = [];
    switch (action) {
      case "SESSION_LOGIN": case "SESSION_LOGOUT":
        if (obj.provincia && obj.provincia !== "—") parts.push(obj.provincia);
        break;
      case "USER_CREATE": case "USER_EDIT": case "USER_APPROVE":
        if (obj.usuario) parts.push(obj.usuario.startsWith('@') ? obj.usuario : "@" + obj.usuario);
        if (obj.rol) parts.push(obj.rol);
        break;
      case "USER_DELETE":
        if (obj.usuario) parts.push(obj.usuario.startsWith('@') ? obj.usuario : "@" + obj.usuario);
        if (obj.rol) parts.push(obj.rol);
        break;
      case "VOTER_CREATE": case "VOTER_EDIT": case "VOTER_DELETE":
        if (obj["cédula"]) parts.push(obj["cédula"]);
        if (obj.provincia && obj.provincia !== "—") parts.push(obj.provincia);
        break;
      case "DATA_EXPORT":
        if (obj.tipo)            parts.push(obj.tipo);
        if (obj.total_registros) parts.push(obj.total_registros + " registros");
        if (obj.formato)         parts.push(obj.formato);
        break;
      case "PASSWORD_RESET":
        if (obj.usuario) parts.push("@" + obj.usuario);
        break;
      default: {
        var first = Object.values(obj).find(function(v) { return v && v !== "—"; });
        if (first) parts.push(String(first).slice(0, 35));
      }
    }
    if (!parts.length) return '<span class="audit-null">—</span>';
    return '<span class="audit-detail-text">' + parts.map(esc).join(" · ") + '</span>';
  }

  function safeDetailsPlain(raw) {
    if (!raw) return "—";
    try {
      var obj = JSON.parse(raw);
      if (typeof obj === "string") return obj;
      return Object.entries(obj)
        .filter(function (kv) { return kv[1] !== null && kv[1] !== undefined && String(kv[1]).trim() !== "" && kv[1] !== "—"; })
        .map(function (kv) { return kv[0] + ": " + kv[1]; })
        .join(" | ") || "—";
    } catch (e) { return raw; }
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function iconActivity() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
  }
  function iconLogin() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
  }
  function iconEdit() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  }
  function iconTrash() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
  }

})();
