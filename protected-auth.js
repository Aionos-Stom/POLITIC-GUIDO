/* Flujos compatibles con la sesión del API; conserva el modo heredado antes del corte. */
(function () {
  "use strict";
  function el(id) { return document.getElementById(id); }
  function value(id) { return String(el(id)?.value || "").trim(); }
  function message(id,text,type) { if (typeof window.showMessage==="function") window.showMessage(el(id),text,type || "error"); }
  async function busy(form,work) {
    var button=form.querySelector('button[type="submit"]');
    if (button?.disabled) return;
    var content=button?.innerHTML;
    if (button) { button.disabled=true; button.textContent="Procesando…"; }
    form.setAttribute("aria-busy","true");
    try { await work(); } catch { message(form.id==="forgotForm" ? "forgotMessage" : form.id==="resetForm" ? "resetMessage" : "authMessage","No pudimos completar la operación. Vuelve a intentarlo."); }
    finally { form.removeAttribute("aria-busy"); if (button) { button.disabled=false; button.innerHTML=content; } }
  }
  async function submit(form) {
    var backend=window.GuidoBackend, result;
    if (form.id==="loginForm") {
      result=await backend.login(value("loginUser"),value("loginPassword"));
      if (result?.error) { message("authMessage",result.error.message); return; }
      if (result?.data?.profile) await window.finishProtectedLogin(result.data.profile);
      return;
    }
    if (form.id==="registerForm") {
      if (value("registerPassword")!==value("registerPasswordConfirm")) { message("authMessage","Las contraseñas no coinciden."); return; }
      var fields={name:value("registerName"),username:value("registerUsername"),email:value("registerEmail"),phone:value("registerPhone"),role:value("registerRole"),province:value("registerProvince"),region:value("registerRegion"),municipio:value("registerMunicipio"),distrito:value("registerDistrito"),zone:value("registerZone"),password:value("registerPassword")};
      result=await backend.register(fields);
      if (result?.error) { message("authMessage",result.error.message); return; }
      window.resetUserForm(); window.switchTab("login");
      message("authMessage","Solicitud recibida. Un administrador debe aprobar tu acceso.","success"); return;
    }
    if (form.id==="forgotForm") {
      result=await backend.requestReset(value("forgotEmail"));
      if (result?.error) { message("forgotMessage",result.error.message); return; }
      message("forgotMessage","Si el correo está registrado, recibirás un enlace para recuperar el acceso.","success"); return;
    }
    if (form.id==="resetForm") {
      if (value("resetPassword")!==value("resetPasswordConfirm")) { message("resetMessage","Las contraseñas no coinciden."); return; }
      result=await backend.applyReset(window._pendingResetToken,value("resetPassword"));
      if (result?.error) { message("resetMessage",result.error.message); return; }
      window._pendingResetToken=null; backend.dropSession();
      window.closeResetModal(); window.finishProtectedLogout();
      message("authMessage","Contraseña actualizada. Inicia sesión de nuevo.","success");
    }
  }
  window.GuidoProtectedAuth={
    async initialize() {
      var backend=window.GuidoBackend;
      var params=new URLSearchParams(window.location.search), reset=params.get("reset_token");
      if (reset) {
        window.history.replaceState({},"",window.location.pathname);
        window.showAuth();
        var checked=await backend.checkReset(reset);
        if (!checked?.error && checked?.data?.valid) { window._pendingResetToken=reset; window.openResetModal(); }
        else message("authMessage",checked?.error?.message || "El enlace de recuperación ha expirado o no es válido.");
        return;
      }
      var restored=await backend.restore();
      if (restored?.data?.profile) { await window.finishProtectedLogin(restored.data.profile); return; }
      window.finishProtectedLogout();
      if (restored?.error) message("authMessage",restored.error.message);
    }
  };
  document.addEventListener("DOMContentLoaded",function () {
    ["loginForm","registerForm","forgotForm","resetForm"].forEach(function (id) {
      var form=el(id); if (!form) return;
      form.addEventListener("submit",async function (event) {
        if (event.__guidoForwarded) return;
        event.preventDefault(); event.stopImmediatePropagation();
        await window.GuidoBackend.ready;
        if (window.GuidoBackend.mode()==="legacy") {
          var forwarded=new Event("submit",{bubbles:true,cancelable:true});
          forwarded.__guidoForwarded=true; form.dispatchEvent(forwarded); return;
        }
        if (!window.GuidoBackend.isSecure()) { message(id==="forgotForm" ? "forgotMessage" : id==="resetForm" ? "resetMessage" : "authMessage","No pudimos conectar con el acceso protegido. Vuelve a intentarlo."); return; }
        await busy(form,function () { return submit(form); });
      },true);
    });
    el("logoutBtn")?.addEventListener("click",async function (event) {
      if (!window.GuidoBackend.isSecure()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      await window.GuidoBackend.logout(); window.finishProtectedLogout();
    },true);
    window.addEventListener("guido:session-expired",function () {
      window.finishProtectedLogout();
      message("authMessage","Tu sesión ha caducado. Inicia sesión de nuevo.");
    });
  });
})();
