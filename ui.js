/* GUIDO — navegación, accesibilidad y estados de la interfaz. */
(function () {
  "use strict";

  var panelMap;
  var navItems;
  var drawerOpener = null;
  var modalOpener = null;
  var activeModal = null;
  var dataFailed = false;
  var panelTitles = {
    overview: "Resumen", registro: "Nuevo registro", consulta: "Consulta",
    usuarios: "Usuarios", auditoria: "Auditoría"
  };

  function byId(id) { return document.getElementById(id); }
  function visible(node) { return !!node && !node.closest(".hidden, .section-hidden, [hidden]") && node.getClientRects().length > 0; }
  function focusable(root) {
    return Array.from(root.querySelectorAll('button:not([disabled]),a[href],input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')).filter(visible);
  }
  function trapFocus(event, root) {
    var nodes = focusable(root);
    if (!nodes.length) { root.setAttribute("tabindex", "-1"); root.focus(); event.preventDefault(); return; }
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
      last.focus(); event.preventDefault();
    } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
      first.focus(); event.preventDefault();
    }
  }
  function setBackgroundInert(locked) {
    [byId("authSection"), byId("dashboardSection"), document.querySelector(".site-footer")].forEach(function (node) {
      if (node) node.inert = locked;
    });
  }
  function syncModalState() {
    var open = Array.from(document.querySelectorAll(".modal-overlay")).filter(function (node) {
      return !node.classList.contains("hidden");
    });
    var next = open[open.length - 1] || null;
    if (next && next !== activeModal) {
      next.inert = false;
      if (!activeModal) modalOpener = document.activeElement;
      activeModal = next;
      var first = next.querySelector('input:not([type="hidden"]),textarea,select') || focusable(next)[0];
      if (first) first.focus({ preventScroll: true });
    }
    document.body.classList.toggle("modal-open", !!next);
    setBackgroundInert(!!next);
    open.forEach(function (node) { node.inert = node !== next; });
    if (!next && activeModal) {
      activeModal = null;
      if (visible(modalOpener)) modalOpener.focus({ preventScroll: true });
      modalOpener = null;
    }
  }

  window.updateThemeIcons = function (theme) {
    var sun = byId("themeIconSun"), moon = byId("themeIconMoon"), button = byId("themeToggleBtn");
    if (sun) sun.style.display = theme === "dark" ? "none" : "";
    if (moon) moon.style.display = theme === "dark" ? "" : "none";
    if (button) {
      button.setAttribute("aria-label", theme === "dark" ? "Activar tema claro" : "Activar tema oscuro");
      button.setAttribute("aria-pressed", String(theme === "dark"));
    }
    var color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === "dark" ? "#101b2c" : "#0b2040";
  };

  window.updateSidebarUser = function (session) {
    if (!session) return;
    var avatar = byId("sidebarAvatar");
    if (avatar) avatar.textContent = (session.name || session.username || "U").trim().split(/\s+/).slice(0, 2).map(function (part) { return part[0] || ""; }).join("").toUpperCase();
    if (byId("sidebarUserName")) byId("sidebarUserName").textContent = session.name || session.username || "Usuario";
    if (byId("sidebarUserRole")) byId("sidebarUserRole").textContent = session.role || "Sin rol asignado";
  };

  function closeSidebar(restoreFocus) {
    var sidebar = byId("appSidebar"), overlay = byId("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
    document.body.classList.remove("drawer-open");
    [byId("sidebarToggleBtn"), byId("mobileMenuToggle")].forEach(function (node) {
      if (node) node.setAttribute("aria-expanded", "false");
    });
    if (sidebar) sidebar.inert = window.matchMedia("(max-width: 52rem)").matches;
    var main = document.querySelector(".app-main");
    if (main) main.inert = false;
    if (restoreFocus && visible(drawerOpener)) drawerOpener.focus({ preventScroll: true });
    drawerOpener = null;
  }
  window._closeSidebar = closeSidebar;

  function openSidebar(opener) {
    var sidebar = byId("appSidebar"), overlay = byId("sidebarOverlay");
    if (!sidebar) return;
    drawerOpener = opener || document.activeElement;
    sidebar.inert = false;
    sidebar.classList.add("open");
    if (overlay) overlay.classList.add("visible");
    document.body.classList.add("drawer-open");
    [byId("sidebarToggleBtn"), byId("mobileMenuToggle")].forEach(function (node) {
      if (node) node.setAttribute("aria-expanded", "true");
    });
    var main = document.querySelector(".app-main");
    if (main) main.inert = true;
    var first = focusable(sidebar)[0];
    if (first) first.focus({ preventScroll: true });
  }

  function showPanel(panelId, moveFocus) {
    if (!panelMap || !panelMap[panelId]) return false;
    var target = panelMap[panelId];
    if ((panelId === "usuarios" || panelId === "auditoria") &&
        (target.classList.contains("section-hidden") || typeof window.hasSuperAccess !== "function" || !window.hasSuperAccess())) {
      window.showNotif("Acceso restringido", "Tu perfil no tiene acceso a esta sección.", "error");
      return false;
    }
    Object.values(panelMap).forEach(function (node) { if (node) node.classList.toggle("panel-active", node === target); });
    navItems.forEach(function (item) {
      var selected = item.dataset.panel === panelId;
      item.classList.toggle("active", selected);
      if (selected) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
    });
    if (byId("activePanelTitle")) byId("activePanelTitle").textContent = panelTitles[panelId];
    document.title = panelTitles[panelId] + " · GUIDO";
    closeSidebar(false);
    if (moveFocus) {
      window.scrollTo({ top: 0, behavior: "instant" });
      var heading = target.querySelector("h1,h2,h3") || target;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    return true;
  }
  window._showPanel = showPanel;

  function updateConnectionNotice() {
    var notice = byId("appConnectionNotice");
    if (!notice) return;
    notice.hidden = navigator.onLine !== false && !dataFailed;
    notice.textContent = navigator.onLine === false
      ? "Estás sin conexión. Para consultar o guardar datos necesitas volver a conectarte."
      : "No pudimos actualizar los datos. Comprueba tu conexión y vuelve a intentarlo.";
  }
  window.addEventListener("guido:data-state", function (event) { dataFailed = !!event.detail.failed; updateConnectionNotice(); });

  document.addEventListener("DOMContentLoaded", function () {
    panelMap = {
      overview: byId("panelOverview"), registro: byId("panelRegistro"), consulta: byId("panelConsulta"),
      usuarios: byId("usersSection"), auditoria: byId("panelAudit")
    };
    navItems = document.querySelectorAll(".nav-item[data-panel]");
    var sidebar = byId("appSidebar");
    if (sidebar) sidebar.inert = window.matchMedia("(max-width: 52rem)").matches;
    var bottomNav = document.querySelector(".mobile-nav");
    if (bottomNav) new ResizeObserver(function () {
      document.documentElement.style.setProperty("--mobile-nav-height", bottomNav.getBoundingClientRect().height + "px");
    }).observe(bottomNav);
    showPanel("overview", false);
    window.updateThemeIcons(document.documentElement.dataset.theme || "light");

    var notice = document.createElement("div");
    notice.id = "appConnectionNotice";
    notice.className = "connection-notice";
    notice.setAttribute("role", "status");
    notice.hidden = true;
    byId("appContent").prepend(notice);
    updateConnectionNotice();
    window.addEventListener("online", updateConnectionNotice);
    window.addEventListener("offline", updateConnectionNotice);

    navItems.forEach(function (button) {
      button.addEventListener("click", function () {
        if (!showPanel(button.dataset.panel, true)) return;
        if (button.dataset.panel === "consulta" && typeof window.renderSearchResults === "function") window.renderSearchResults();
        if (button.dataset.panel === "overview" && typeof window.renderAnalytics === "function") window.renderAnalytics();
      });
    });
    document.addEventListener("click", function (event) {
      var navigate = event.target.closest("[data-navigate]");
      if (navigate) { showPanel(navigate.dataset.navigate, true); return; }
      if (event.target.closest("[data-clear-search]") && typeof window.clearFilters === "function") window.clearFilters();
      var retry = event.target.closest("[data-retry]");
      if (retry && typeof window.renderAll === "function") {
        retry.disabled = true;
        window.renderAll().finally(function () { retry.disabled = false; });
      }
    });

    [byId("sidebarToggleBtn"), byId("mobileMenuToggle")].forEach(function (button) {
      if (!button) return;
      button.setAttribute("aria-controls", "appSidebar");
      button.addEventListener("click", function () {
        if (sidebar.classList.contains("open")) closeSidebar(true); else openSidebar(button);
      });
    });
    if (byId("sidebarCloseBtn")) byId("sidebarCloseBtn").addEventListener("click", function () { closeSidebar(true); });
    if (byId("sidebarLogoutBtn")) byId("sidebarLogoutBtn").addEventListener("click", function () { byId("logoutBtn").click(); });
    if (byId("sidebarOverlay")) byId("sidebarOverlay").addEventListener("click", function () { closeSidebar(true); });
    window.matchMedia("(max-width: 52rem)").addEventListener("change", function () { closeSidebar(false); });

    document.querySelectorAll(".nav-group-header").forEach(function (header) {
      function toggle() {
        var group = byId(header.dataset.target);
        var expanded = header.getAttribute("aria-expanded") === "true";
        header.classList.toggle("open", !expanded);
        header.setAttribute("aria-expanded", String(!expanded));
        if (group) group.classList.toggle("collapsed", expanded);
      }
      header.addEventListener("click", toggle);
      header.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
      });
    });

    var themeButton = byId("themeToggleBtn");
    if (themeButton) themeButton.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      window.updateThemeIcons(next);
      var session = typeof window.getSession === "function" ? window.getSession() : null;
      if (session && window.supabase) {
        window.supabase.from("users").update({ theme: next }).eq("id", session.id).then(function (result) {
          if (!result.error) session.theme = next;
        }).catch(function () { window.showNotif("Preferencia sin guardar", "El tema cambió en este dispositivo. Vuelve a intentarlo cuando tengas conexión.", "warning"); });
      }
    });

    document.querySelectorAll("[data-password-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var input = byId(button.dataset.passwordToggle);
        if (!input) return;
        var showing = input.type === "password";
        input.type = showing ? "text" : "password";
        button.setAttribute("aria-pressed", String(showing));
        button.setAttribute("aria-label", showing ? "Ocultar contraseña" : "Mostrar contraseña");
      });
    });
    document.querySelectorAll("[data-focus-login]").forEach(function (link) {
      link.addEventListener("click", function () {
        if (typeof window.switchTab === "function") window.switchTab("login");
        requestAnimationFrame(function () { if (byId("loginUser")) byId("loginUser").focus({ preventScroll: true }); });
      });
    });
    document.querySelectorAll('.tabs [role="tab"]').forEach(function (tab) {
      tab.addEventListener("keydown", function (event) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        var target = event.key === "Home" ? byId("showLogin") : event.key === "End" ? byId("showRegister")
          : tab.id === "showLogin" ? byId("showRegister") : byId("showLogin");
        target.click(); target.focus();
      });
    });

    document.querySelectorAll("input[required],select[required],textarea[required]").forEach(function (input) {
      var label = document.querySelector('label[for="' + input.id + '"]');
      if (label && !label.querySelector(".required-mark") && !label.textContent.includes("*") && input.closest("#voterForm")) {
        var mark = document.createElement("span"); mark.className = "required-mark"; mark.textContent = " *"; mark.setAttribute("aria-hidden", "true"); label.appendChild(mark);
      }
      input.addEventListener("input", function () { input.removeAttribute("aria-invalid"); });
    });
    document.querySelectorAll("form[novalidate]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        if (!window.supabase) {
          event.preventDefault(); event.stopImmediatePropagation();
          var unavailable = form.querySelector(".status-message") || byId("authMessage");
          if (unavailable && typeof window.showMessage === "function") window.showMessage(unavailable, "No se pudo cargar el acceso. Comprueba tu conexión y recarga esta página.", "error");
          return;
        }
        var fields = Array.from(form.querySelectorAll("input,select,textarea")).filter(function (field) {
          return !field.disabled && field.type !== "hidden" && !field.checkValidity();
        });
        if (!fields.length) return;
        event.preventDefault(); event.stopImmediatePropagation();
        fields.forEach(function (field) { field.setAttribute("aria-invalid", "true"); });
        fields[0].focus();
        var message = form.querySelector(".status-message") || (form.id === "voterForm" ? byId("voterMessage") : byId("authMessage"));
        if (message && typeof window.showMessage === "function") window.showMessage(message, "Revisa los campos indicados para continuar.", "error");
      }, true);
    });

    var mainSearch = byId("searchInput"), topbarSearch = byId("topbarSearchInput"), searchTimer;
    if (topbarSearch && mainSearch) {
      topbarSearch.addEventListener("input", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          mainSearch.value = topbarSearch.value;
          showPanel("consulta", false);
          mainSearch.dispatchEvent(new Event("input", { bubbles: true }));
        }, 180);
      });
      mainSearch.addEventListener("input", function () { topbarSearch.value = mainSearch.value; });
    }
    var filterButton = byId("filterToggleBtn"), filterCard = document.querySelector(".consulta-filters-card");
    if (filterButton && filterCard) filterButton.addEventListener("click", function () {
      var open = filterCard.classList.toggle("filters-open"); filterButton.setAttribute("aria-expanded", String(open));
    });
    function updateFilterBadge() {
      var count = Array.from(document.querySelectorAll("#consultaFilterFields select")).filter(function (field) { return field.value; }).length;
      var badge = byId("activeFiltersCount");
      if (badge) { badge.textContent = count; badge.hidden = count === 0; }
    }
    document.querySelectorAll("#consultaFilterFields select").forEach(function (field) { field.addEventListener("change", updateFilterBadge); });
    if (byId("clearFiltersBtn")) byId("clearFiltersBtn").addEventListener("click", function () {
      updateFilterBadge(); if (topbarSearch) topbarSearch.value = "";
    });
    window.addEventListener("guido:filters-cleared", function () {
      clearTimeout(searchTimer); updateFilterBadge();
      if (topbarSearch) topbarSearch.value = "";
    });

    var modalObserver = new MutationObserver(syncModalState);
    document.querySelectorAll(".modal-overlay").forEach(function (modal) {
      modalObserver.observe(modal, { attributes: true, attributeFilter: ["class", "hidden"] });
    });
    document.addEventListener("keydown", function (event) {
      if (activeModal) {
        if (event.key === "Tab") trapFocus(event, activeModal);
        if (event.key === "Escape") {
          var cancel = activeModal.querySelector('[id*="Cancel"],[id*="cancel"],[id*="close"],[id*="Close"],[id="closeDupVoterBtn"]');
          if (cancel) { event.preventDefault(); cancel.click(); }
        }
        return;
      }
      if (sidebar && sidebar.classList.contains("open")) {
        if (event.key === "Tab") trapFocus(event, sidebar);
        if (event.key === "Escape") { event.preventDefault(); closeSidebar(true); }
      }
    }, true);
    if (window.visualViewport) {
      function updateKeyboardState() {
        var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        document.body.classList.toggle("keyboard-open", typing && window.innerHeight - window.visualViewport.height > 140);
      }
      window.visualViewport.addEventListener("resize", updateKeyboardState);
      document.addEventListener("focusout", function () { setTimeout(updateKeyboardState, 100); });
    }
    var session = typeof window.getSession === "function" ? window.getSession() : null;
    if (session) window.updateSidebarUser(session);
  });

  window.showNotif = function (title, message, type) {
    type = type || "info";
    var container = byId("notifContainer");
    if (!container) return;
    var notification = document.createElement("div");
    notification.className = "notif " + (["error", "success", "warning"].includes(type) ? type : "info");
    notification.setAttribute("role", "status");
    var body = document.createElement("div");
    body.className = "notif-body";
    var heading = document.createElement("div"); heading.className = "notif-title"; heading.textContent = title;
    var copy = document.createElement("div"); copy.className = "notif-msg"; copy.textContent = message;
    body.append(heading, copy);
    var close = document.createElement("button"); close.className = "notif-dismiss"; close.type = "button"; close.setAttribute("aria-label", "Cerrar notificación");
    close.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
    notification.append(body, close); container.appendChild(notification);
    function dismiss() {
      if (!notification.isConnected) return;
      notification.classList.add("notif-leaving"); setTimeout(function () { notification.remove(); }, 200);
    }
    close.addEventListener("click", dismiss);
    setTimeout(dismiss, 8000);
  };
})();
