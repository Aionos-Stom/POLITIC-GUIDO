// ═══════════════════════════════════════════════════════════════
//  
//   Supabase como base de datos pura (sin Supabase Auth).
//   Hashing PBKDF2 vía Web Crypto API. Email con EmailJS.
// ═══════════════════════════════════════════════════════════════

/* global emailjs */

// ── Supabase client ────────────────────────────────────────────
const SUPABASE_URL = 'https://smssamxuiksitmmfaosk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtc3NhbXh1aWtzaXRtbWZhb3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NzQ0MjcsImV4cCI6MjA5ODE1MDQyN30.5Ox_xo0FklquP4KNR--3rz2wVntDut7Rt0Wmp_7UzUE';
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var supabase = window.supabase;

// ── EmailJS — configurar con tus credenciales ────────────────────
// 1. Crea cuenta en https://www.emailjs.com (gratis)
// 2. Crea un Email Service y un Email Template
// 3. En el template usa las variables: {{to_name}}, {{to_email}}, {{reset_link}}
const EMAILJS_SERVICE_ID  = 'service_ume7f0j';   // ← reemplazar
const EMAILJS_TEMPLATE_ID = 'template_z5i2ula';  // ← reemplazar
const EMAILJS_PUBLIC_KEY  = 'pYU3bNDgoNi5aknEv';    // ← 



// Usuario autenticado en memoria
let currentUser = null;

// Exponer sesión para audit.js y ui.js
window.getSession = function () { return currentUser; };



// ── DOM ─────────────────────────────────────────────────────────
const DOM = {
  showLogin:              document.getElementById('showLogin'),
  showRegister:           document.getElementById('showRegister'),
  loginForm:              document.getElementById('loginForm'),
  registerForm:           document.getElementById('registerForm'),
  authMessage:            document.getElementById('authMessage'),
  authSection:            document.getElementById('authSection'),
  dashboardSection:       document.getElementById('dashboardSection'),
  currentUserInfo:        document.getElementById('currentUserInfo'),
  logoutBtn:              document.getElementById('logoutBtn'),
  exportBtn:              document.getElementById('exportBtn'),
  manageUsersBtn:         document.getElementById('manageUsersBtn'),
  voterForm:              document.getElementById('voterForm'),
  voterMessage:           document.getElementById('voterMessage'),
  votersTableBody:        document.getElementById('votersTableBody'),
  usersTableBody:         document.getElementById('usersTableBody'),
  usersListContainer:     document.getElementById('usersListContainer'),
  searchResults:          document.getElementById('searchResults'),
  filteredCountBadge:     document.getElementById('filteredCountBadge'),
  userPermissionsNote:    document.getElementById('userPermissionsNote'),
  searchInput:            document.getElementById('searchInput'),
  filterProvince:         document.getElementById('filterProvince'),
  filterMunicipio:        document.getElementById('filterMunicipio'),
  filterSector:           document.getElementById('filterSector'),
  filterMesa:             document.getElementById('filterMesa'),
  filterRole:             document.getElementById('filterRole'),
  filterRegistrar:        document.getElementById('filterRegistrar'),
  clearFiltersBtn:        document.getElementById('clearFiltersBtn'),
  totalVoters:            document.getElementById('totalVoters'),
  totalUsers:             document.getElementById('totalUsers'),
  todayVoters:            document.getElementById('todayVoters'),
  activeProvinces:        document.getElementById('activeProvinces'),
  editingUserId:          document.getElementById('editingUserId'),
  registerFormTitle:      document.getElementById('registerFormTitle'),
  saveUserBtn:            document.getElementById('saveUserBtn'),
  cancelEditUserBtn:      document.getElementById('cancelEditUserBtn'),
  firstUserHint:          document.getElementById('firstUserHint'),
  registerName:           document.getElementById('registerName'),
  registerUsername:       document.getElementById('registerUsername'),
  registerRole:           document.getElementById('registerRole'),
  registerEmail:          document.getElementById('registerEmail'),
  registerPhone:          document.getElementById('registerPhone'),
  registerProvince:       document.getElementById('registerProvince'),
  registerRegion:         document.getElementById('registerRegion'),
  registerMunicipio:      document.getElementById('registerMunicipio'),
  registerDistrito:       document.getElementById('registerDistrito'),
  registerZone:           document.getElementById('registerZone'),
  registerPassword:       document.getElementById('registerPassword'),
  registerPasswordConfirm:document.getElementById('registerPasswordConfirm'),
  voterName:              document.getElementById('voterName'),
  voterCedula:            document.getElementById('voterCedula'),
  voterPhone:             document.getElementById('voterPhone'),
  voterAge:               document.getElementById('voterAge'),
  voterProvince:          document.getElementById('voterProvince'),
  voterRegion:            document.getElementById('voterRegion'),
  voterMunicipio:         document.getElementById('voterMunicipio'),
  voterDistrito:          document.getElementById('voterDistrito'),
  voterZone:              document.getElementById('voterZone'),
  voterSector:            document.getElementById('voterSector'),
  voterMesa:              document.getElementById('voterMesa'),
  voterRecinto:           document.getElementById('voterRecinto'),
  voterObservation:       document.getElementById('voterObservation'),
  provinceChart:          document.getElementById('provinceChart'),
  provinceRanking:        document.getElementById('provinceRanking'),
  chartSummaryBadge:      document.getElementById('chartSummaryBadge'),
  usersSection:           document.getElementById('usersSection'),
  voterActionsHead:       document.getElementById('voterActionsHead'),
  editingVoterId:         document.getElementById('editingVoterId'),
  voterFormTitle:         document.getElementById('voterFormTitle'),
  voterFormDescription:   document.getElementById('voterFormDescription'),
  saveVoterBtn:           document.getElementById('saveVoterBtn'),
  cancelEditVoterBtn:     document.getElementById('cancelEditVoterBtn'),
  userEditModal:          document.getElementById('userEditModal'),
  closeUserEditModalBtn:  document.getElementById('closeUserEditModalBtn'),
  cancelUserEditBtn:      document.getElementById('cancelUserEditBtn'),
  userEditForm:           document.getElementById('userEditForm'),
  userEditMessage:        document.getElementById('userEditMessage'),
  editUserId:             document.getElementById('editUserId'),
  editUserName:           document.getElementById('editUserName'),
  editUserUsername:       document.getElementById('editUserUsername'),
  editUserEmail:          document.getElementById('editUserEmail'),
  editUserPhone:          document.getElementById('editUserPhone'),
  editUserRole:           document.getElementById('editUserRole'),
  editUserProvince:       document.getElementById('editUserProvince'),
  editUserRegion:         document.getElementById('editUserRegion'),
  editUserMunicipio:      document.getElementById('editUserMunicipio'),
  editUserDistrito:       document.getElementById('editUserDistrito'),
  editUserZone:           document.getElementById('editUserZone'),
  // Recuperación de contraseña
  forgotPasswordBtn:      document.getElementById('forgotPasswordBtn'),
  forgotPasswordModal:    document.getElementById('forgotPasswordModal'),
  closeForgotModalBtn:    document.getElementById('closeForgotModalBtn'),
  cancelForgotBtn:        document.getElementById('cancelForgotBtn'),
  forgotForm:             document.getElementById('forgotForm'),
  forgotEmail:            document.getElementById('forgotEmail'),
  forgotMessage:          document.getElementById('forgotMessage'),
  // Reset de contraseña
  resetPasswordModal:     document.getElementById('resetPasswordModal'),
  resetForm:              document.getElementById('resetForm'),
  resetPassword:          document.getElementById('resetPassword'),
  resetPasswordConfirm:   document.getElementById('resetPasswordConfirm'),
  resetMessage:           document.getElementById('resetMessage'),
};

// ── Constantes ──────────────────────────────────────────────────
const RD_PROVINCES = [
  'Azua','Bahoruco','Barahona','Dajabón','Distrito Nacional','Duarte',
  'Elías Piña','El Seibo','Espaillat','Hato Mayor','Hermanas Mirabal',
  'Independencia','La Altagracia','La Romana','La Vega','María Trinidad Sánchez',
  'Monseñor Nouel','Monte Cristi','Monte Plata','Pedernales','Peravia',
  'Puerto Plata','Samaná','San Cristóbal','San José de Ocoa','San Juan',
  'San Pedro de Macorís','Sánchez Ramírez','Santiago','Santiago Rodríguez',
  'Santo Domingo','Valverde'
];

const ROLES = [
  'Administrador','Coordinador Nacional','Coordinador Regional',
  'Coordinador Provincial','Coordinadores Municipales','Coordinadores Distritales',
  'Coordinadores de Zona','Secretario Nacional','Encargado Organizacion',
  'Secretario de Planificacion','Secretario de Disciplina','Registrador'
];

// ── Hashing de contraseñas (Web Crypto API / PBKDF2) ───────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const toHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  return `${toHex(salt)}:${toHex(bits)}`;
}

async function verifyPassword(password, stored) {
  try {
    const [saltHex, hashHex] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b,16)));
    const enc  = new TextEncoder();
    const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key, 256
    );
    const test = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join('');
    return test === hashHex;
  } catch { return false; }
}

// ── Capa de datos (Supabase) ────────────────────────────────────

async function getUsers() {
  const { data, error } = await supabase.from('users').select('*');
  if (error) { console.error('getUsers:', error); return []; }
  return data || [];
}

async function getVoters() {
  const { data, error } = await supabase.from('voters').select('*');
  if (error) { console.error('getVoters:', error); return []; }
  return data || [];
}

// ── Utilidades ──────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function normalizeText(v) { return String(v || '').trim(); }
function normalizeCedula(v) { return String(v || '').replace(/[^\d]/g, ''); }

function formatPhone(v) {
  const d = String(v || '').replace(/[^\d]/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
}
function isValidPhone(v) { return String(v || '').replace(/[^\d]/g, '').length === 10; }

function formatCedula(v) {
  const d = String(v || '').replace(/[^\d]/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 10) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,10)}-${d.slice(10)}`;
}
function isValidCedula(v) { return String(v || '').replace(/[^\d]/g, '').length === 11; }
function isValidEmail(v)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }

function formatDateDisplay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}
function getTodayDateKey() {
  const t = new Date();
  return `${t.getFullYear()}-${t.getMonth()+1}-${t.getDate()}`;
}
function getDateKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
function uniqueSortedValues(arr) {
  return [...new Set(arr.filter(Boolean).map(v => v.trim()))].sort((a,b) => a.localeCompare(b,'es'));
}

function populateSelect(el, values, defaultLabel) {
  if (!el) return;
  const cur = el.value;
  el.innerHTML = `<option value="">${defaultLabel}</option>`;
  values.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    el.appendChild(o);
  });
  if (values.includes(cur)) el.value = cur;
}

function populateProvinceSelects() {
  populateSelect(DOM.registerProvince, RD_PROVINCES, 'Seleccione una provincia');
  populateSelect(DOM.voterProvince,    RD_PROVINCES, 'Seleccione una provincia');
  populateSelect(DOM.editUserProvince, RD_PROVINCES, 'Seleccione una provincia');
}

function populateRoleSelects() {
  const opts = ROLES.map(r => `<option value="${r}">${r}</option>`).join('');
  if (DOM.registerRole) {
    const cur = DOM.registerRole.value;
    DOM.registerRole.innerHTML = `<option value="">Seleccione</option>${opts}`;
    if (ROLES.includes(cur)) DOM.registerRole.value = cur;
  }
  if (DOM.editUserRole) {
    const cur = DOM.editUserRole.value;
    DOM.editUserRole.innerHTML = `<option value="">Seleccione</option>${opts}`;
    if (ROLES.includes(cur)) DOM.editUserRole.value = cur;
  }
  populateSelect(DOM.filterRole, ROLES, 'Todos');
}

function showMessage(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = `status-message show ${type}`;
  setTimeout(() => { el.className = 'status-message'; el.textContent = ''; }, 3500);
}

function switchTab(mode) {
  if (mode === 'login') {
    DOM.showLogin?.classList.add('active');    DOM.showRegister?.classList.remove('active');
    DOM.loginForm?.classList.add('active');    DOM.registerForm?.classList.remove('active');
  } else {
    DOM.showRegister?.classList.add('active'); DOM.showLogin?.classList.remove('active');
    DOM.registerForm?.classList.add('active'); DOM.loginForm?.classList.remove('active');
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'light');
  if (typeof window.updateThemeIcons === 'function') window.updateThemeIcons(theme || 'light');
}

function showAuth() {
  DOM.authSection.classList.remove('hidden');
  DOM.dashboardSection.classList.add('hidden');
  switchTab('login');
}

// ── Control de acceso ───────────────────────────────────────────

function isAdmin() { return !!currentUser && currentUser.role === 'Administrador'; }

function hasSuperAccess() {
  return !!currentUser && [
    'Administrador','Coordinador Nacional','Secretario Nacional',
    'Encargado Organizacion','Secretario de Planificacion','Secretario de Disciplina'
  ].includes(currentUser.role);
}
window.hasSuperAccess = hasSuperAccess;

function updateAdminAccess() {
  DOM.manageUsersBtn?.classList.toggle('hidden', !hasSuperAccess());
}

// ── Visibilidad por rol ─────────────────────────────────────────

async function getVisibleVoters() {
  if (!currentUser) return [];
  const voters = await getVoters();
  if (hasSuperAccess()) return voters;
  return voters.filter(v => v.registered_by_id === currentUser.id);
}

async function getVisibleUsers() {
  if (!currentUser) return [];
  const users = await getUsers();
  if (hasSuperAccess()) return users;
  return [];
}

// ── Filtros / Renderizado ───────────────────────────────────────

async function getFilteredVoters() {
  const voters    = await getVisibleVoters();
  const q         = DOM.searchInput?.value.trim().toLowerCase() || '';
  const province  = DOM.filterProvince?.value  || '';
  const municipio = DOM.filterMunicipio?.value || '';
  const sector    = DOM.filterSector?.value    || '';
  const mesa      = DOM.filterMesa?.value      || '';
  const role      = DOM.filterRole?.value      || '';
  const registrar = DOM.filterRegistrar?.value || '';

  return voters.filter(v => {
    const matchQ = !q || [
      v.name, v.cedula, v.phone, v.region, v.province, v.municipio,
      v.distrito, v.sector, v.mesa, v.recinto, v.observacion,
      v.registered_by, v.registered_by_name, v.registered_by_role, v.registered_by_zone
    ].some(f => String(f || '').toLowerCase().includes(q));

    return matchQ &&
      (!province  || v.province  === province)             &&
      (!municipio || v.municipio === municipio)            &&
      (!sector    || v.sector    === sector)               &&
      (!mesa      || v.mesa      === mesa)                 &&
      (!role      || v.registered_by_role === role)        &&
      (!registrar || v.registered_by      === registrar);
  });
}

async function fillFilterOptions() {
  const voters = await getVisibleVoters();
  populateSelect(DOM.filterProvince,  uniqueSortedValues(voters.map(v => v.province)),           'Todas');
  populateSelect(DOM.filterMunicipio, uniqueSortedValues(voters.map(v => v.municipio)),          'Todos');
  populateSelect(DOM.filterSector,    uniqueSortedValues(voters.map(v => v.sector)),             'Todos');
  populateSelect(DOM.filterMesa,      uniqueSortedValues(voters.map(v => v.mesa)),               'Todas');
  populateSelect(DOM.filterRole,      uniqueSortedValues(voters.map(v => v.registered_by_role)), 'Todos');
  if (hasSuperAccess()) {
    const allUsers = await getUsers();
    populateSelect(DOM.filterRegistrar, uniqueSortedValues(allUsers.filter(u => u.status === 'Aprobado').map(u => u.username)), 'Todos');
  } else {
    populateSelect(DOM.filterRegistrar, [currentUser.username], 'Todos');
  }
}

async function renderVotersTable() {
  const filtered = await getFilteredVoters();
  const ordered  = [...filtered].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  if (!DOM.votersTableBody) return;
  DOM.votersTableBody.innerHTML = '';
  if (DOM.voterActionsHead) DOM.voterActionsHead.textContent = 'Acciones';

  if (!ordered.length) {
    DOM.votersTableBody.innerHTML = `<tr><td colspan="16">No hay registros para mostrar con los filtros seleccionados.</td></tr>`;
    if (DOM.filteredCountBadge) DOM.filteredCountBadge.textContent = '0 resultados';
    return;
  }

  ordered.forEach(voter => {
    const row = document.createElement('tr');
    const isOwner = currentUser && voter.registered_by_id === currentUser.id;
    const actionsHtml = hasSuperAccess()
      ? `<div class="actions-wrap">
           <button class="action-btn edit"   type="button" data-action="edit-voter"   data-id="${escapeHtml(voter.id)}">Editar</button>
           <button class="action-btn delete" type="button" data-action="delete-voter" data-id="${escapeHtml(voter.id)}">Eliminar</button>
         </div>`
      : isOwner
        ? `<div class="actions-wrap">
             <button class="action-btn edit" type="button" data-action="edit-voter" data-id="${escapeHtml(voter.id)}">Editar</button>
           </div>`
        : `<span class="status-pill aprobado">Registrado</span>`;

    row.innerHTML = `
      <td>${escapeHtml(voter.name)}</td>
      <td>${escapeHtml(voter.cedula)}</td>
      <td>${escapeHtml(voter.phone)}</td>
      <td>${escapeHtml(voter.region   || '')}</td>
      <td>${escapeHtml(voter.province)}</td>
      <td>${escapeHtml(voter.municipio)}</td>
      <td>${escapeHtml(voter.distrito || '')}</td>
      <td>${escapeHtml(voter.zone     || '')}</td>
      <td>${escapeHtml(voter.sector)}</td>
      <td>${escapeHtml(voter.mesa)}</td>
      <td>${escapeHtml(voter.recinto)}</td>
      <td>${escapeHtml(voter.observacion || '')}</td>
      <td>${escapeHtml(voter.registered_by_name)} (${escapeHtml(voter.registered_by)})</td>
      <td>${escapeHtml(voter.registered_by_role)}</td>
      <td>${escapeHtml(formatDateDisplay(voter.updated_at || voter.created_at))}</td>
      <td class="actions-cell">${actionsHtml}</td>
    `;
    DOM.votersTableBody.appendChild(row);
  });

  if (DOM.filteredCountBadge) DOM.filteredCountBadge.textContent = `${ordered.length} resultado${ordered.length !== 1 ? 's' : ''}`;
}

async function renderUsers() {
  const container = DOM.usersListContainer;
  if (!container) return;
  container.innerHTML = '';
  if (DOM.userPermissionsNote) DOM.userPermissionsNote.textContent = hasSuperAccess() ? 'Gestión total de usuarios' : 'Visualización según permisos';

  if (!hasSuperAccess()) { DOM.usersSection?.classList.add('section-hidden'); return; }
  DOM.usersSection?.classList.remove('section-hidden');

  const users   = await getVisibleUsers();
  const ordered = [...users].sort((a,b) => {
    const sa = a.status || 'Pendiente', sb = b.status || 'Pendiente';
    if (sa !== sb) return sa.localeCompare(sb,'es');
    if (a.role !== b.role) return a.role.localeCompare(b.role,'es');
    return a.name.localeCompare(b.name,'es');
  });

  if (!ordered.length) {
    container.innerHTML = '<div class="users-empty">No hay usuarios para mostrar.</div>';
    return;
  }

  const chevronSVG = `<svg class="user-item-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

  ordered.forEach(user => {
    const sc       = String(user.status || 'Pendiente').toLowerCase();
    const isPending = sc === 'pendiente';
    const initials  = (user.name || 'U').trim().split(' ').map(w => w[0] || '').slice(0,2).join('').toUpperCase();

    const approveBtn = (isPending && isAdmin())
      ? `<button class="action-btn approve" type="button" data-action="approve-user" data-id="${escapeHtml(user.id)}">Aprobar</button>` : '';

    const item = document.createElement('div');
    item.className = 'user-item';
    item.dataset.id = user.id;
    item.innerHTML = `
      <div class="user-item-header" role="button" tabindex="0" aria-expanded="false">
        <div class="user-item-avatar">${escapeHtml(initials)}</div>
        <div class="user-item-info">
          <strong>${escapeHtml(user.name)}</strong>
          <span>@${escapeHtml(user.username)}</span>
        </div>
        <span class="user-item-role">${escapeHtml(user.role)}</span>
        <span class="status-pill ${escapeHtml(sc)}">${escapeHtml(user.status || 'Pendiente')}</span>
        ${chevronSVG}
      </div>
      <div class="user-item-body" hidden>
        <div class="user-item-fields">
          <div class="user-item-field"><span>Correo</span><strong>${escapeHtml(user.email    || '—')}</strong></div>
          <div class="user-item-field"><span>Teléfono</span><strong>${escapeHtml(user.phone   || '—')}</strong></div>
          <div class="user-item-field"><span>Región</span><strong>${escapeHtml(user.region    || '—')}</strong></div>
          <div class="user-item-field"><span>Provincia</span><strong>${escapeHtml(user.province|| '—')}</strong></div>
          <div class="user-item-field"><span>Municipio</span><strong>${escapeHtml(user.municipio||'—')}</strong></div>
          <div class="user-item-field"><span>Distrito</span><strong>${escapeHtml(user.distrito  ||'—')}</strong></div>
          <div class="user-item-field"><span>Zona</span><strong>${escapeHtml(user.zone       || '—')}</strong></div>
        </div>
        <div class="user-item-actions">
          ${approveBtn}
          <button class="action-btn edit"   type="button" data-action="edit-user"   data-id="${escapeHtml(user.id)}">Editar</button>
          <button class="action-btn delete" type="button" data-action="delete-user" data-id="${escapeHtml(user.id)}">Eliminar</button>
        </div>
      </div>`;

    const hdr  = item.querySelector('.user-item-header');
    const body = item.querySelector('.user-item-body');
    hdr.addEventListener('click', () => {
      const opening = body.hidden;
      container.querySelectorAll('.user-item').forEach(el => {
        el.classList.remove('open');
        el.querySelector('.user-item-body').hidden = true;
        el.querySelector('.user-item-header').setAttribute('aria-expanded','false');
      });
      if (opening) { body.hidden = false; item.classList.add('open'); hdr.setAttribute('aria-expanded','true'); }
    });
    hdr.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); hdr.click(); } });

    container.appendChild(item);
  });
}

async function renderSearchResults() {
  const [filtered, allUsers] = await Promise.all([
    getFilteredVoters(),
    hasSuperAccess() ? getUsers() : Promise.resolve([])
  ]);
  const ordered = filtered.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  if (!DOM.searchResults) return;
  DOM.searchResults.innerHTML = '';
  if (!ordered.length) {
    DOM.searchResults.innerHTML = `<div class="result-item result-empty"><p>No se encontraron resultados con los criterios seleccionados.</p></div>`;
    return;
  }

  const usersById = {};
  allUsers.forEach(u => { usersById[u.id] = u; });

  const field = (label, value) => {
    if (!value) return '';
    return `<div class="result-field"><span class="result-field-label">${label}</span><span class="result-field-value">${escapeHtml(value)}</span></div>`;
  };

  ordered.forEach(v => {
    const registrar = usersById[v.registered_by_id];
    const regName   = registrar?.name     || v.registered_by_name || '—';
    const regRole   = registrar?.role     || v.registered_by_role || '—';
    const regUser   = registrar?.username || v.registered_by      || '—';

    const isOwner  = currentUser && v.registered_by_id === currentUser.id;
    const canEdit  = hasSuperAccess() || isOwner;
    const canDelete= hasSuperAccess();

    const actionsHtml = (canEdit || canDelete) ? `
      <div class="result-action-btns">
        ${canEdit   ? `<button class="result-btn-edit"   type="button" data-action="edit-voter"   data-id="${escapeHtml(v.id)}">Editar</button>`   : ''}
        ${canDelete ? `<button class="result-btn-delete" type="button" data-action="delete-voter" data-id="${escapeHtml(v.id)}">Eliminar</button>` : ''}
      </div>` : '';

    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-card-name">
        <span class="result-category-badge">SIMPATIZANTE</span>
        <span class="result-card-name-text">${escapeHtml(v.name)}</span>
      </div>
      <div class="result-fields-wrap">
        ${field('CÉDULA', v.cedula)}
        ${field('EDAD', v.edad ? v.edad + ' años' : '')}
        ${field('TELÉFONO', v.phone)}
        ${field('REGIÓN', v.region)}
        ${field('PROVINCIA', v.province)}
        ${field('MUNICIPIO', v.municipio)}
        ${field('DISTRITO', v.distrito)}
        ${field('ZONA', v.zone)}
        ${field('SECTOR', v.sector)}
        ${field('RECINTO', v.recinto)}
        ${field('MESA', v.mesa)}
        ${field('OBSERVACIÓN', v.observacion)}
        <div class="result-field">
          <span class="result-field-label">REGISTRADO POR</span>
          <span class="result-field-value">${escapeHtml(regName)} · ${escapeHtml(regRole)}</span>
        </div>
      </div>
      <div class="result-card-footer">
        <span class="result-date">${escapeHtml(formatDateDisplay(v.updated_at || v.created_at))}</span>
        ${actionsHtml}
      </div>
    `;
    DOM.searchResults.appendChild(item);
  });
}

async function updateStats() {
  const labelEl = document.getElementById('statUsersLabel');
  const deltaEl = document.getElementById('statUsersDelta');

  if (hasSuperAccess()) {
    const [voters, users] = await Promise.all([getVisibleVoters(), getVisibleUsers()]);
    if (DOM.totalVoters)     DOM.totalVoters.textContent     = voters.length;
    if (DOM.totalUsers)      DOM.totalUsers.textContent      = users.length;
    if (labelEl) labelEl.textContent = 'Usuarios en el sistema';
    if (deltaEl) deltaEl.textContent = 'Total de cuentas creadas';
    const todayKey = getTodayDateKey();
    if (DOM.todayVoters)     DOM.todayVoters.textContent     = voters.filter(v => getDateKey(v.created_at) === todayKey).length;
    if (DOM.activeProvinces) DOM.activeProvinces.textContent = new Set(voters.map(v => v.province).filter(Boolean).map(p => p.trim())).size;
  } else {
    // Usuarios no-admin: solo cuentan sus propios registros
    const voters = await getVisibleVoters(); // ya filtra por registered_by_id
    if (DOM.totalVoters)     DOM.totalVoters.textContent     = voters.length;
    if (DOM.totalUsers)      DOM.totalUsers.textContent      = voters.length;
    if (labelEl) labelEl.textContent = 'Mis registros';
    if (deltaEl) deltaEl.textContent = 'Simpatizantes registrados por mí';
    const todayKey = getTodayDateKey();
    const todayCount = voters.filter(v => getDateKey(v.created_at) === todayKey).length;
    if (DOM.todayVoters)     DOM.todayVoters.textContent     = todayCount;
    if (DOM.activeProvinces) DOM.activeProvinces.textContent = new Set(voters.map(v => v.province).filter(Boolean).map(p => p.trim())).size;

    // Panel de trabajo del Registrador
    const regTotal = document.getElementById('registradorTotalCount');
    const regHoy   = document.getElementById('registradorTodayCount');
    if (regTotal) regTotal.textContent = voters.length;
    if (regHoy)   regHoy.textContent   = todayCount;
  }
}

async function getProvinceCounts() {
  const counts = {};
  (await getVisibleVoters()).forEach(v => {
    const p = String(v.province || '').trim();
    if (p) counts[p] = (counts[p] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([province, count]) => ({ province, count }))
    .sort((a,b) => b.count - a.count || a.province.localeCompare(b.province,'es'));
}

async function renderProvinceRanking() {
  const data = await getProvinceCounts();
  if (!DOM.provinceRanking) return;
  DOM.provinceRanking.innerHTML = '';
  if (!data.length) {
    DOM.provinceRanking.innerHTML = `<div class="result-item"><p>Aún no hay provincias registradas para mostrar.</p></div>`;
    if (DOM.chartSummaryBadge) DOM.chartSummaryBadge.textContent = '0 provincias activas';
    return;
  }
  if (DOM.chartSummaryBadge) DOM.chartSummaryBadge.textContent = `${data.length} provincia${data.length !== 1 ? 's' : ''} activas`;
  data.slice(0, 8).forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'ranking-item';
    div.innerHTML = `
      <div class="ranking-item-left">
        <div class="ranking-number">${i+1}</div>
        <div><h4>${escapeHtml(item.province)}</h4><p>Registros visibles en esta provincia</p></div>
      </div>
      <div class="ranking-count">${item.count}</div>
    `;
    DOM.provinceRanking.appendChild(div);
  });
}

// ── Gráfica de barras ───────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r, fill) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);   ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if (fill) ctx.fill();
}

async function drawProvinceChart() {
  const canvas = DOM.provinceChart;
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const data   = (await getProvinceCounts()).slice(0, 10);
  const pw     = canvas.parentElement.clientWidth;
  const width  = Math.max(pw - 10, 300);
  const height = 320;
  const ratio  = window.devicePixelRatio || 1;
  canvas.width  = width * ratio;  canvas.height = height * ratio;
  canvas.style.width  = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,width,height);

  const isDark     = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor  = isDark ? '#2a3045' : '#e6edf6';
  const labelColor = isDark ? '#8da0bc' : '#7f91a8';
  const countColor = isDark ? '#e4ecf5' : '#102b4c';
  const axisColor  = isDark ? '#4e607a' : '#5f728b';

  if (!data.length) {
    ctx.fillStyle = isDark ? '#4e607a' : '#61758f';
    ctx.font = '15px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aún no hay datos para mostrar en el gráfico.', width/2, height/2);
    return;
  }

  const pad = { top:20, right:20, bottom:70, left:50 };
  const cw   = width  - pad.left - pad.right;
  const ch   = height - pad.top  - pad.bottom;
  const maxV = Math.max(...data.map(d => d.count), 1);
  const stepX = cw / data.length;
  const barW  = Math.min(42, stepX * 0.56);

  ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ch/4)*i;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(width-pad.right,y); ctx.stroke();
    ctx.fillStyle = labelColor; ctx.font = '12px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(maxV - (maxV/4)*i)), pad.left-8, y+4);
  }

  data.forEach((item, i) => {
    const x  = pad.left + stepX*i + (stepX-barW)/2;
    const bh = (item.count / maxV) * ch;
    const y  = pad.top + ch - bh;
    const gr = ctx.createLinearGradient(0,y,0,y+bh);
    gr.addColorStop(0,'#0a4a8a'); gr.addColorStop(1,'#ef2d26');
    ctx.fillStyle = gr;
    roundRect(ctx,x,y,barW,bh,12,true);
    ctx.fillStyle = countColor; ctx.font = '700 12px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(item.count), x+barW/2, y-8);
    const lbl = item.province.length > 12 ? `${item.province.slice(0,12)}…` : item.province;
    ctx.save(); ctx.translate(x+barW/2, pad.top+ch+16); ctx.rotate(-Math.PI/6);
    ctx.fillStyle = axisColor; ctx.font = '12px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(lbl, 0, 0); ctx.restore();
  });
}

window.drawProvinceChart = drawProvinceChart;

async function renderAnalytics() {
  await renderProvinceRanking();
  await drawProvinceChart();
}

async function renderAll() {
  await Promise.all([renderVotersTable(), renderSearchResults(), renderUsers(), updateStats()]);
  await renderAnalytics();
}

// ── Dashboard ───────────────────────────────────────────────────

async function loadDashboard() {
  if (!currentUser) return;
  DOM.authSection.classList.add('hidden');
  DOM.dashboardSection.classList.remove('hidden');
  if (DOM.currentUserInfo) {
    DOM.currentUserInfo.textContent =
      `${currentUser.name} | ${currentUser.role} | ${currentUser.province || ''} | ${currentUser.zone || ''}`;
  }

  // Rellenar sidebar: nombre completo, rol e inicial del avatar
  const sidebarName   = document.getElementById('sidebarUserName');
  const sidebarRole   = document.getElementById('sidebarUserRole');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarName)   sidebarName.textContent   = currentUser.name  || 'Usuario';
  if (sidebarRole)   sidebarRole.textContent   = currentUser.role  || 'Sin rol';
  if (sidebarAvatar) sidebarAvatar.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();

  if (hasSuperAccess()) DOM.usersSection?.classList.remove('section-hidden');
  else                  DOM.usersSection?.classList.add('section-hidden');

  // Banner del registrador
  const registradorWelcome = document.getElementById('registradorWelcome');
  if (registradorWelcome) {
    registradorWelcome.classList.toggle('section-hidden', currentUser.role !== 'Registrador');
  }

  updateAdminAccess();
  await fillFilterOptions();
  await renderAll();
}

// Exponer para que ui.js pueda parchear
window.loadDashboard = loadDashboard;

async function updateInitialHint() {
  const users = await getUsers();
  if (!DOM.firstUserHint) return;
  const approvedAdmins = users.filter(u => u.role === 'Administrador' && u.status === 'Aprobado').length;
  DOM.firstUserHint.textContent = approvedAdmins === 0
    ? 'Si aún no existe un Administrador aprobado, el primer Administrador se activará para iniciar la plataforma.'
    : 'Los nuevos usuarios quedan pendientes hasta ser aprobados por un Administrador.';
}

// ── Reset de formularios ────────────────────────────────────────

function resetUserForm() {
  DOM.registerForm?.reset();
  if (DOM.editingUserId)    DOM.editingUserId.value    = '';
  if (DOM.registerFormTitle)DOM.registerFormTitle.textContent = 'Crear nuevo usuario';
  if (DOM.saveUserBtn)      DOM.saveUserBtn.textContent = 'Crear usuario';
  DOM.cancelEditUserBtn?.classList.add('hidden');
  if (DOM.registerProvince) DOM.registerProvince.value = '';
  populateRoleSelects();
}

function resetVoterForm() {
  DOM.voterForm?.reset();
  if (DOM.editingVoterId)       DOM.editingVoterId.value       = '';
  if (DOM.voterProvince)        DOM.voterProvince.value        = '';
  if (DOM.voterFormTitle)       DOM.voterFormTitle.textContent = 'Registrar votante / simpatizante';
  if (DOM.voterFormDescription) DOM.voterFormDescription.textContent = 'Complete los datos requeridos de forma organizada y precisa.';
  if (DOM.saveVoterBtn)         DOM.saveVoterBtn.textContent   = 'Guardar registro';
  DOM.cancelEditVoterBtn?.classList.add('hidden');
}

function resetUserEditModal() {
  DOM.userEditForm?.reset();
  if (DOM.editUserId)       DOM.editUserId.value       = '';
  if (DOM.editUserRole)     DOM.editUserRole.value     = '';
  if (DOM.editUserProvince) DOM.editUserProvince.value = '';
}

function closeUserEditModal() {
  DOM.userEditModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
  resetUserEditModal();
}

function openUserEditModal() {
  DOM.userEditModal?.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function fillUserForm(user) {
  populateRoleSelects(); populateProvinceSelects();
  DOM.editUserName.value      = user.name      || '';
  DOM.editUserUsername.value  = user.username  || '';
  DOM.editUserRole.value      = user.role      || '';
  DOM.editUserEmail.value     = user.email     || '';
  DOM.editUserPhone.value     = formatPhone(user.phone || '');
  DOM.editUserProvince.value  = user.province  || '';
  DOM.editUserRegion.value    = user.region    || '';
  DOM.editUserMunicipio.value = user.municipio || '';
  DOM.editUserDistrito.value  = user.distrito  || '';
  DOM.editUserZone.value      = user.zone      || '';
  DOM.editUserId.value        = user.id        || '';
  openUserEditModal();
}

function fillVoterForm(voter) {
  DOM.voterName.value        = voter.name        || '';
  DOM.voterCedula.value      = formatCedula(voter.cedula || '');
  DOM.voterPhone.value       = formatPhone(voter.phone   || '');
  if (DOM.voterAge) DOM.voterAge.value = voter.edad != null ? voter.edad : '';
  DOM.voterRegion.value      = voter.region      || '';
  DOM.voterProvince.value    = voter.province    || '';
  DOM.voterMunicipio.value   = voter.municipio   || '';
  DOM.voterDistrito.value    = voter.distrito    || '';
  DOM.voterZone.value        = voter.zone        || '';
  DOM.voterSector.value      = voter.sector      || '';
  DOM.voterMesa.value        = voter.mesa        || '';
  DOM.voterRecinto.value     = voter.recinto     || '';
  DOM.voterObservation.value = voter.observacion || '';
  DOM.editingVoterId.value   = voter.id          || '';
  if (DOM.voterFormTitle)       DOM.voterFormTitle.textContent       = 'Editar registro';
  if (DOM.voterFormDescription) DOM.voterFormDescription.textContent = 'Modifique los datos del simpatizante registrado.';
  if (DOM.saveVoterBtn)         DOM.saveVoterBtn.textContent         = 'Guardar cambios';
  DOM.cancelEditVoterBtn?.classList.remove('hidden');
}

// ── Exportar Excel ──────────────────────────────────────────────

async function exportToExcel() {
  if (!currentUser) { await showAlert('Sesión requerida', 'Debes iniciar sesión para exportar los registros.', 'warning'); return; }
  const allFiltered = await getFilteredVoters();
  const voters = hasSuperAccess()
    ? allFiltered
    : allFiltered.filter(v => v.registered_by_id === currentUser.id);
  if (!voters.length) { await showAlert('Sin registros', 'No hay datos para exportar con los filtros seleccionados.', 'info'); return; }

  const ordered = [...voters].sort((a,b) => {
    if (a.registered_by_role  !== b.registered_by_role)  return a.registered_by_role.localeCompare(b.registered_by_role,'es');
    if (a.registered_by_name  !== b.registered_by_name)  return a.registered_by_name.localeCompare(b.registered_by_name,'es');
    if (a.province !== b.province) return a.province.localeCompare(b.province,'es');
    if (a.municipio !== b.municipio) return a.municipio.localeCompare(b.municipio,'es');
    return a.name.localeCompare(b.name,'es');
  });

  const fechaReporte = new Intl.DateTimeFormat('es-DO', { dateStyle: 'full', timeStyle: 'short' }).format(new Date());
  const total = ordered.length;

  // ── 16 columnas fijas ──────────────────────────────────
  // N° | Nombre | Cédula | Teléfono | Región | Provincia | Municipio |
  // Distrito | Zona | Sector | Mesa | Recinto | Observación |
  // Registrado Por | Usuario | Rol | Fecha

  const C = 17; // total de columnas

  const widths = [38, 175, 115, 95, 85, 105, 110, 90, 82, 100, 62, 125, 145, 150, 95, 140, 110];

  const css = `
    body  { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #0d1b2e; margin: 0; }
    table { border-collapse: collapse; }

    /* Filas del encabezado del reporte */
    .H1 { font-size: 20px; font-weight: bold; color: #071a44; text-align: center; padding: 16px 10px 2px; border: none; }
    .H2 { font-size: 11px; font-weight: bold; color: #1457c4; text-align: center; padding: 2px 10px 4px; border: none;
          text-transform: uppercase; letter-spacing: 1px; }
    .H3 { font-size: 9.5px; color: #6a80a0; text-align: center; padding: 1px 10px 2px; border: none; }
    .BAND { height: 4px; padding: 0; border: none;
            background-color: #071a44; }
    .BAND2{ height: 3px; padding: 0; border: none;
            background-color: #e0262b; }
    .META { font-size: 9.5px; color: #4a6080; padding: 5px 14px; border: none; text-align: left; }
    .METAR{ font-size: 9.5px; color: #4a6080; padding: 5px 14px; border: none; text-align: right; }
    .GAP  { border: none; padding: 4px; }

    /* Encabezados de columna */
    .CH {
      background-color: #071a44; color: #ffffff;
      font-size: 9.5px; font-weight: bold; text-align: center;
      padding: 9px 6px; border: 1px solid #051027;
      text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;
    }
    .CH-num { background-color: #051027; }

    /* Datos — alternan blanco / azul muy claro */
    .DA { background-color: #ffffff; }
    .DB { background-color: #f3f7fd; }

    /* Estilos de celda */
    td { border: 1px solid #cddcee; padding: 7px 9px; vertical-align: middle; font-size: 10.5px; color: #1a2a3a; }
    .num   { text-align: center; color: #8fa0b8; font-size: 10px; font-weight: bold; }
    .name  { font-weight: 700; color: #071a44; }
    .ced   { font-family: 'Courier New', Courier, monospace; text-align: center;
             letter-spacing: 1px; color: #1a3a6c; }
    .tel   { text-align: center; color: #2a4a6a; }
    .geo   { text-align: center; color: #2a3a50; }
    .obs   { color: #6a7a90; font-style: italic; }
    .reg   { color: #071a44; font-weight: 600; font-size: 10.5px; }
    .usr   { color: #6a80a0; font-size: 9.5px; }
    .rol   { text-align: center; color: #2a4060; font-size: 10px; }
    .dat   { text-align: center; color: #6a80a0; font-size: 9.5px; white-space: nowrap; }
    .empty { color: #b0bfd0; text-align: center; }

    /* Separadores de grupo (solo admins con acceso global) */
    .GR { background-color: #071a44; }
    .GR td {
      color: #ffffff; font-weight: bold; font-size: 10px;
      padding: 7px 10px; border: 1px solid #051027;
      text-transform: uppercase; letter-spacing: 0.8px;
    }
    .GR .num { color: rgba(255,255,255,0.3); }

    .GS { background-color: #ddeaff; }
    .GS td {
      color: #071a44; font-weight: 600; font-size: 9.5px;
      padding: 5px 10px; border: 1px solid #b8ccee;
    }
    .GS .num { color: #9ab0cc; }

    /* Totales y pie */
    .FT { background-color: #071a44; }
    .FT td { color: #ffffff; font-weight: bold; font-size: 10.5px;
             padding: 9px 12px; border: 1px solid #051027; }
    .FT .num { color: rgba(255,255,255,0.5); font-size: 10px; }
    .FT .name { color: #90d0ff; font-weight: 700; }
    .FN td { border: none; font-size: 9px; color: #8fa0b8;
             text-align: center; padding: 8px; }
  `;

  const cg = widths.map(w => `<col style="width:${w}px">`).join('');

  // ── Encabezado del reporte ──────────────────────────────
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><style>${css}</style></head>
<body><table><colgroup>${cg}</colgroup>

<tr><td class="H1"  colspan="${C}">GUIDO — Sistema de Gestión Territorial</td></tr>
<tr><td class="H2"  colspan="${C}">Reporte de Registros de Simpatizantes</td></tr>
<tr><td class="H3"  colspan="${C}">República Dominicana &nbsp;·&nbsp; Siempre cerca de ti</td></tr>
<tr><td class="BAND" colspan="${C}"></td></tr>
<tr><td class="BAND2" colspan="${C}"></td></tr>
<tr>
  <td class="META"  colspan="9">Generado por: &nbsp;<b>${escapeHtml(currentUser.name)}</b> &nbsp;·&nbsp; Rol: ${escapeHtml(currentUser.role)}</td>
  <td class="METAR" colspan="8">Fecha: ${fechaReporte} &nbsp;·&nbsp; Total: <b>${total}</b> registros</td>
</tr>
<tr><td class="GAP" colspan="${C}"></td></tr>

<tr>
  <td class="CH CH-num">N&deg;</td>
  <td class="CH">Nombre Completo</td>
  <td class="CH">Cedula</td>
  <td class="CH">Telefono</td>
  <td class="CH">Region</td>
  <td class="CH">Provincia</td>
  <td class="CH">Municipio</td>
  <td class="CH">Distrito</td>
  <td class="CH">Zona</td>
  <td class="CH">Sector</td>
  <td class="CH">Mesa</td>
  <td class="CH">Recinto</td>
  <td class="CH">Observacion</td>
  <td class="CH">Registrado Por</td>
  <td class="CH">Usuario</td>
  <td class="CH">Rol del Registrador</td>
  <td class="CH">Fecha de Registro</td>
</tr>`;

  // ── Filas de datos ──────────────────────────────────────
  let n = 0, curRole = '', curReg = '';

  ordered.forEach(v => {
    if (hasSuperAccess()) {
      if (v.registered_by_role !== curRole) {
        curRole = v.registered_by_role; curReg = '';
        html += `<tr class="GR">
  <td class="num"></td>
  <td colspan="${C - 1}">ROL: ${escapeHtml(v.registered_by_role)}</td>
</tr>`;
      }
      if (v.registered_by_name !== curReg) {
        curReg = v.registered_by_name;
        html += `<tr class="GS">
  <td class="num"></td>
  <td colspan="3">Registrador: &nbsp;<b>${escapeHtml(v.registered_by_name)}</b> &nbsp;(@${escapeHtml(v.registered_by)})</td>
  <td colspan="4">Zona: ${escapeHtml(v.registered_by_zone || '—')}</td>
  <td colspan="${C - 8}">Provincia: ${escapeHtml(v.registered_by_province || '—')}</td>
</tr>`;
      }
    }

    n++;
    const rc = n % 2 === 0 ? 'DB' : 'DA';
    const geo = (val) => val ? `<td class="geo">${escapeHtml(val)}</td>` : `<td class="empty geo">—</td>`;

    html += `<tr class="${rc}">
  <td class="num">${n}</td>
  <td class="name">${escapeHtml(v.name)}</td>
  <td class="ced">${escapeHtml(v.cedula)}</td>
  <td class="tel">${escapeHtml(v.phone)}</td>
  ${geo(v.region)}
  <td class="geo">${escapeHtml(v.province)}</td>
  <td class="geo">${escapeHtml(v.municipio)}</td>
  ${geo(v.distrito)}
  ${geo(v.zone)}
  <td class="geo">${escapeHtml(v.sector)}</td>
  <td class="geo">${escapeHtml(v.mesa)}</td>
  <td class="geo">${escapeHtml(v.recinto)}</td>
  <td class="obs">${escapeHtml(v.observacion || '—')}</td>
  <td class="reg">${escapeHtml(v.registered_by_name)}</td>
  <td class="usr">@${escapeHtml(v.registered_by)}</td>
  <td class="rol">${escapeHtml(v.registered_by_role)}</td>
  <td class="dat">${escapeHtml(formatDateDisplay(v.updated_at || v.created_at))}</td>
</tr>`;
  });

  // ── Pie del reporte ─────────────────────────────────────
  html += `
<tr><td class="GAP" colspan="${C}"></td></tr>
<tr class="FT">
  <td class="num">&nbsp;</td>
  <td class="name" colspan="3">TOTAL DE REGISTROS</td>
  <td colspan="${C - 4}" style="text-align:right;color:#7ab0f0;font-size:13px;font-weight:bold;">${total}</td>
</tr>
<tr class="FN"><td colspan="${C}">Documento de uso interno · Sistema de Gestion Territorial · Siempre cerca de ti · Republica Dominicana</td></tr>

</table></body></html>`;

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const ts   = new Date().toISOString().slice(0, 10);
  a.download = hasSuperAccess()
    ? `reporte_general_${ts}.xls`
    : `mis_registros_${currentUser.username}_${ts}.xls`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  if (typeof window.logAudit === 'function') window.logAudit('DATA_EXPORT', null, 'Registros de simpatizantes', {
    total_registros: total,
    formato:         'XLS',
    tipo:            hasSuperAccess() ? 'Reporte general' : 'Mis registros',
    exportado_por:   currentUser ? currentUser.name + ' (' + currentUser.role + ')' : '—',
    provincia_filtro: DOM.filterProvince?.value || 'Todas las provincias',
  });
}

async function clearFilters() {
  if (DOM.searchInput)     DOM.searchInput.value     = '';
  if (DOM.filterProvince)  DOM.filterProvince.value  = '';
  if (DOM.filterMunicipio) DOM.filterMunicipio.value = '';
  if (DOM.filterSector)    DOM.filterSector.value    = '';
  if (DOM.filterMesa)      DOM.filterMesa.value      = '';
  if (DOM.filterRole)      DOM.filterRole.value      = '';
  if (DOM.filterRegistrar) DOM.filterRegistrar.value = '';
  await renderVotersTable(); await renderSearchResults(); await renderAnalytics();
}

// ── Modales de recuperación de contraseña ──────────────────────

function openForgotModal() {
  DOM.forgotPasswordModal?.classList.remove('hidden');
  document.body.classList.add('modal-open');
  if (DOM.forgotEmail)   DOM.forgotEmail.value = '';
  if (DOM.forgotMessage) { DOM.forgotMessage.className = 'status-message'; DOM.forgotMessage.textContent = ''; }
}
function closeForgotModal() {
  DOM.forgotPasswordModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}
function openResetModal() {
  DOM.resetPasswordModal?.classList.remove('hidden');
  document.body.classList.add('modal-open');
}
function closeResetModal() {
  DOM.resetPasswordModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

// ── Eventos: Tabs ───────────────────────────────────────────────

DOM.showLogin?.addEventListener('click',    () => switchTab('login'));
DOM.showRegister?.addEventListener('click', () => switchTab('register'));

// ── Eventos: Recuperación de contraseña ────────────────────────

DOM.forgotPasswordBtn?.addEventListener('click', openForgotModal);
DOM.closeForgotModalBtn?.addEventListener('click', closeForgotModal);
DOM.cancelForgotBtn?.addEventListener('click',    closeForgotModal);
DOM.forgotPasswordModal?.addEventListener('click', e => { if (e.target === DOM.forgotPasswordModal) closeForgotModal(); });

DOM.forgotForm?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = normalizeText(DOM.forgotEmail?.value || '').toLowerCase();
  if (!email || !isValidEmail(email)) {
    showMessage(DOM.forgotMessage, 'Ingrese un correo electrónico válido.', 'error'); return;
  }
  const btn = this.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

  // Buscar usuario por correo
  const { data: user } = await supabase
    .from('users').select('id, name, email').eq('email', email).maybeSingle();

  if (btn) { btn.disabled = false; btn.textContent = 'Enviar enlace'; }

  // Siempre mostrar mensaje genérico (no revelar si existe o no)
  if (!user) {
    showMessage(DOM.forgotMessage, 'Si el correo existe, recibirá un enlace en su bandeja.', 'success');
    setTimeout(closeForgotModal, 3200);
    return;
  }

  // Generar token y guardarlo en la BD (expira en 1 hora)
  const token   = crypto.randomUUID();
  const expires = new Date(Date.now() + 3_600_000).toISOString();
  await supabase.from('users')
    .update({ reset_token: token, reset_token_expires: expires })
    .eq('id', user.id);

  // Enviar correo con EmailJS
  const BASE_URL = window.location.origin.startsWith('file')
    ? 'http://127.0.0.1:5500'          // Live Server local
    : window.location.origin;           // producción automático

  const resetLink = `${BASE_URL}${window.location.pathname}?reset_token=${token}`;

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_name:    user.name,
      to_email:   user.email,
      reset_link: resetLink,
      expires_in: '30 minutos'
    }, EMAILJS_PUBLIC_KEY);

    showMessage(DOM.forgotMessage, 'Correo enviado. Revise su bandeja de entrada.', 'success');
    setTimeout(closeForgotModal, 3200);
  } catch (emailErr) {
    console.error('EmailJS error:', emailErr);
    showMessage(DOM.forgotMessage, 'Error al enviar el correo. Intente más tarde.', 'error');
  }
});

// ── Eventos: Reset de contraseña ────────────────────────────────

DOM.resetForm?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const newPass  = normalizeText(DOM.resetPassword?.value        || '');
  const confPass = normalizeText(DOM.resetPasswordConfirm?.value || '');
  if (!newPass || newPass.length < 6) {
    showMessage(DOM.resetMessage, 'La contraseña debe tener al menos 6 caracteres.', 'error'); return;
  }
  if (newPass !== confPass) {
    showMessage(DOM.resetMessage, 'Las contraseñas no coinciden.', 'error'); return;
  }
  if (!window._pendingResetToken) {
    showMessage(DOM.resetMessage, 'Token de recuperación no válido. Solicite un nuevo enlace.', 'error'); return;
  }

  const btn = this.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  // Verificar que el token siga vigente
  const { data: user } = await supabase
    .from('users').select('*')
    .eq('reset_token', window._pendingResetToken)
    .maybeSingle();

  if (!user || new Date(user.reset_token_expires) <= new Date()) {
    if (btn) { btn.disabled = false; btn.textContent = 'Cambiar contraseña'; }
    showMessage(DOM.resetMessage, 'El enlace ha expirado. Solicite uno nuevo.', 'error');
    return;
  }

  const newHash = await hashPassword(newPass);
  const { error } = await supabase.from('users')
    .update({ password_hash: newHash, reset_token: null, reset_token_expires: null })
    .eq('id', user.id);

  if (btn) { btn.disabled = false; btn.textContent = 'Cambiar contraseña'; }

  if (error) {
    showMessage(DOM.resetMessage, 'Error al actualizar: ' + error.message, 'error');
  } else {
    window._pendingResetToken = null;
    if (typeof window.logAudit === 'function') {
      window.logAudit('PASSWORD_RESET', user.id, user.name, {
        usuario:   user.username,
        correo:    user.email    || '—',
        método:    'Recuperación por token de correo',
      });
    }
    showMessage(DOM.resetMessage, '¡Contraseña actualizada! Ya puede iniciar sesión.', 'success');
    setTimeout(() => { closeResetModal(); showAuth(); }, 2000);
  }
});

// ── Eventos: Login ──────────────────────────────────────────────

DOM.loginForm?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const identifier = normalizeText(document.getElementById('loginUser').value);
  const password   = normalizeText(document.getElementById('loginPassword').value);

  if (!identifier || !password) {
    showMessage(DOM.authMessage, 'Ingresa tu usuario/correo y contraseña.', 'error'); return;
  }

  // Buscar por email o por username (sin distinción de mayúsculas)
  const isEmail = identifier.includes('@');
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .filter(isEmail ? 'email' : 'username', 'ilike', identifier)
    .maybeSingle();

  if (!user) {
    showMessage(DOM.authMessage, 'Usuario o contraseña incorrectos.', 'error'); return;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    showMessage(DOM.authMessage, 'Usuario o contraseña incorrectos.', 'error'); return;
  }

  if ((user.status || 'Pendiente') !== 'Aprobado') {
    showMessage(DOM.authMessage, 'Tu usuario aún está pendiente de aprobación.', 'error'); return;
  }

  currentUser = user;
  sessionStorage.setItem('upd_uid', user.id);
  applyTheme(user.theme || 'light');
  if (typeof window.logAudit === 'function') window.logAudit('SESSION_LOGIN', user.id, user.name, {
    usuario:   user.username,
    rol:       user.role,
    región:    user.region   || '—',
    provincia: user.province || '—',
    municipio: user.municipio|| '—',
  });
  updateAdminAccess();
  await loadDashboard();
});

// ── Eventos: Logout ─────────────────────────────────────────────

DOM.logoutBtn?.addEventListener('click', async () => {
  if (typeof window.logAudit === 'function' && currentUser) {
    window.logAudit('SESSION_LOGOUT', currentUser.id, currentUser.name, {
      usuario:   currentUser.username,
      rol:       currentUser.role,
      provincia: currentUser.province || '—',
    });
  }
  currentUser = null;
  sessionStorage.removeItem('upd_uid');
  resetVoterForm();
  updateAdminAccess();
  applyTheme('light');
  showAuth();
  await updateInitialHint();
});

// ── Eventos: Registrar usuario ──────────────────────────────────

DOM.registerForm?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const users     = await getUsers();
  const name      = normalizeText(DOM.registerName.value);
  const username  = normalizeText(DOM.registerUsername.value);
  const role      = normalizeText(DOM.registerRole.value);
  const email     = normalizeText(DOM.registerEmail.value).toLowerCase();
  const phone     = formatPhone(DOM.registerPhone.value);
  const province  = normalizeText(DOM.registerProvince.value);
  const region    = normalizeText(DOM.registerRegion.value);
  const municipio = normalizeText(DOM.registerMunicipio.value);
  const distrito  = normalizeText(DOM.registerDistrito.value);
  const zone      = normalizeText(DOM.registerZone.value);
  const password  = normalizeText(DOM.registerPassword.value);
  const passConf  = normalizeText(DOM.registerPasswordConfirm.value);

  if (!name||!username||!role||!email||!phone||!province||!region||!municipio||!distrito||!zone||!password||!passConf) {
    showMessage(DOM.authMessage, 'Complete todos los campos del usuario.', 'error'); return;
  }
  if (!isValidEmail(email))  { showMessage(DOM.authMessage, 'Ingrese un correo personal válido.', 'error'); return; }
  if (!isValidPhone(phone))  { showMessage(DOM.authMessage, 'Ingrese un teléfono válido de 10 dígitos.', 'error'); return; }
  if (password.length < 6)   { showMessage(DOM.authMessage, 'La contraseña debe tener al menos 6 caracteres.', 'error'); return; }
  if (password !== passConf) { showMessage(DOM.authMessage, 'Las contraseñas no coinciden.', 'error'); return; }
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    showMessage(DOM.authMessage, 'Ese nombre de usuario ya existe.', 'error'); return;
  }
  if (users.some(u => String(u.email||'').toLowerCase() === email)) {
    showMessage(DOM.authMessage, 'Ese correo ya está registrado.', 'error'); return;
  }

  const approvedAdmins = users.filter(u => u.role === 'Administrador' && u.status === 'Aprobado').length;
  const bootstrapAdmin = approvedAdmins === 0 && role === 'Administrador';
  const createdByAdmin = hasSuperAccess();
  const status         = bootstrapAdmin || createdByAdmin ? 'Aprobado' : 'Pendiente';

  const passwordHash = await hashPassword(password);
  const newUserId    = crypto.randomUUID();

  const { error: insertError } = await supabase.from('users').insert({
    id: newUserId, name, username, role, email, phone,
    region, province, municipio, distrito, zone,
    status, password_hash: passwordHash
  });
  if (insertError) { showMessage(DOM.authMessage, 'Error al registrar: ' + insertError.message, 'error'); return; }

  if (typeof window.logAudit === 'function') window.logAudit('USER_CREATE', newUserId, name, {
    usuario:     username,
    rol:         role,
    estado:      status,
    correo:      email,
    teléfono:    phone,
    región:      region,
    provincia:   province,
    municipio:   municipio,
    distrito:    distrito,
    zona:        zone,
    creado_por:  currentUser ? currentUser.name + ' (' + currentUser.role + ')' : 'Registro inicial del sistema',
  });
  resetUserForm();
  await updateInitialHint();
  updateAdminAccess();
  showMessage(DOM.authMessage, status === 'Pendiente' ? 'Usuario registrado. Pendiente de aprobación.' : 'Usuario registrado correctamente.', 'success');
  if (currentUser) { await fillFilterOptions(); await renderUsers(); await updateStats(); }
});

// ── Eventos: Editar usuario (modal) ─────────────────────────────

DOM.userEditForm?.addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!currentUser || !hasSuperAccess()) {
    showMessage(DOM.userEditMessage, 'No tienes permisos para editar usuarios.', 'error'); return;
  }
  const editingId = normalizeText(DOM.editUserId.value);
  const name      = normalizeText(DOM.editUserName.value);
  const username  = normalizeText(DOM.editUserUsername.value);
  const role      = normalizeText(DOM.editUserRole.value);
  const email     = normalizeText(DOM.editUserEmail.value).toLowerCase();
  const phone     = formatPhone(DOM.editUserPhone.value);
  const province  = normalizeText(DOM.editUserProvince.value);
  const region    = normalizeText(DOM.editUserRegion.value);
  const municipio = normalizeText(DOM.editUserMunicipio.value);
  const distrito  = normalizeText(DOM.editUserDistrito.value);
  const zone      = normalizeText(DOM.editUserZone.value);

  if (!editingId||!name||!username||!role||!email||!phone||!province||!region||!municipio||!distrito||!zone) {
    showMessage(DOM.userEditMessage, 'Complete todos los campos del usuario.', 'error'); return;
  }
  if (!isValidEmail(email)) { showMessage(DOM.userEditMessage, 'Ingrese un correo válido.', 'error'); return; }
  if (!isValidPhone(phone)) { showMessage(DOM.userEditMessage, 'Ingrese un teléfono válido.', 'error'); return; }

  const users = await getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== editingId)) {
    showMessage(DOM.userEditMessage, 'Ese nombre de usuario ya existe.', 'error'); return;
  }
  if (users.some(u => String(u.email||'').toLowerCase() === email && u.id !== editingId)) {
    showMessage(DOM.userEditMessage, 'Ese correo ya está registrado.', 'error'); return;
  }

  const { error } = await supabase.from('users')
    .update({ name, username, role, email, phone, region, province, municipio, distrito, zone })
    .eq('id', editingId);
  if (error) { showMessage(DOM.userEditMessage, 'Error al actualizar: ' + error.message, 'error'); return; }

  // Actualizar datos del registrador en sus votantes
  await supabase.from('voters').update({
    registered_by:          username,
    registered_by_name:     name,
    registered_by_role:     role,
    registered_by_region:   region,
    registered_by_province: province,
    registered_by_municipio:municipio,
    registered_by_distrito: distrito,
    registered_by_zone:     zone
  }).eq('registered_by_id', editingId);

  if (typeof window.logAudit === 'function') window.logAudit('USER_EDIT', editingId, name, {
    usuario:     username,
    rol:         role,
    correo:      email,
    teléfono:    phone,
    región:      region,
    provincia:   province,
    municipio:   municipio,
    distrito:    distrito,
    zona:        zone,
    editado_por: currentUser ? currentUser.name + ' (' + currentUser.role + ')' : '—',
  });
  if (currentUser?.id === editingId) {
    currentUser = { ...currentUser, name, username, role, email, phone, region, province, municipio, distrito, zone };
  }

  showMessage(DOM.userEditMessage, 'Usuario actualizado correctamente.', 'success');
  closeUserEditModal();
  await fillFilterOptions();
  await renderAll();
  updateAdminAccess();
});

// ── Eventos: Acciones en tabla de usuarios ──────────────────────

DOM.usersListContainer?.addEventListener('click', async function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!action || !id) return;
  if (!hasSuperAccess()) { await showAlert('Acceso restringido', 'No tienes permisos para gestionar usuarios.', 'lock'); return; }

  const users = await getUsers();
  const user  = users.find(u => u.id === id);
  if (!user) { await showAlert('Error', 'No se encontró el usuario seleccionado.', 'warning'); return; }

  if (action === 'approve-user') {
    if (!isAdmin()) { await showAlert('Acceso restringido', 'Solo el Administrador puede aprobar solicitudes de usuarios.', 'lock'); return; }
    const { error } = await supabase.from('users').update({ status: 'Aprobado' }).eq('id', id);
    if (error) { showMessage(DOM.authMessage, 'Error al aprobar: ' + error.message, 'error'); return; }
    if (typeof window.logAudit === 'function') window.logAudit('USER_APPROVE', id, user.name, {
      usuario:      user.username,
      rol:          user.role,
      correo:       user.email    || '—',
      provincia:    user.province || '—',
      aprobado_por: currentUser ? currentUser.name + ' (' + currentUser.role + ')' : '—',
    });
    showMessage(DOM.authMessage, 'Usuario aprobado correctamente.', 'success');
    await renderUsers(); await updateStats();
    return;
  }

  if (action === 'edit-user') { fillUserForm(user); return; }

  if (action === 'delete-user') {
    if (currentUser?.id === id) { await showAlert('Acción no permitida', 'No puedes eliminar el usuario con el que estás autenticado actualmente.', 'warning'); return; }
    const voters = await getVoters();
    const linked = voters.filter(v => v.registered_by_id === id).length;
    const confirmMsg = linked > 0
      ? `Este usuario tiene ${linked} registro(s) de simpatizantes asociados. El usuario será eliminado pero sus registros permanecerán en el sistema.`
      : '¿Deseas eliminar permanentemente este usuario del sistema?';
    const confirmTitle = linked > 0 ? `Eliminar usuario con ${linked} registro(s)` : 'Eliminar usuario';
    if (!await showConfirm(confirmTitle, confirmMsg, 'danger', 'Sí, eliminar')) return;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) { showMessage(DOM.authMessage, 'Error al eliminar: ' + error.message, 'error'); return; }
    if (typeof window.logAudit === 'function') window.logAudit('USER_DELETE', id, user.name, {
      usuario:             user.username,
      correo:              user.email    || '—',
      rol:                 user.role,
      provincia:           user.province || '—',
      registros_vinculados: linked,
      eliminado_por:       currentUser ? currentUser.name + ' (' + currentUser.role + ')' : '—',
    });
    showMessage(DOM.authMessage, 'Usuario eliminado correctamente.', 'success');
    await fillFilterOptions(); await renderAll(); updateAdminAccess();
  }
});

// ── Eventos: Formulario de votantes ─────────────────────────────

DOM.voterForm?.addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!currentUser) { showMessage(DOM.voterMessage, 'Debes iniciar sesión.', 'error'); return; }

  const name       = normalizeText(DOM.voterName.value);
  const cedula     = formatCedula(DOM.voterCedula.value);
  const phone      = formatPhone(DOM.voterPhone.value);
  const region     = normalizeText(DOM.voterRegion.value);
  const province   = normalizeText(DOM.voterProvince.value);
  const municipio  = normalizeText(DOM.voterMunicipio.value);
  const distrito   = normalizeText(DOM.voterDistrito.value);
  const zone       = normalizeText(DOM.voterZone.value);
  const sector     = normalizeText(DOM.voterSector.value);
  const mesa       = normalizeText(DOM.voterMesa.value);
  const recinto    = normalizeText(DOM.voterRecinto.value);
  const edad       = parseInt(DOM.voterAge?.value, 10) || null;
  const observacion= normalizeText(DOM.voterObservation.value);
  const editingId  = normalizeText(DOM.editingVoterId.value);

  if (!name||!cedula||!phone||!edad||!region||!province||!municipio||!distrito||!zone||!sector||!mesa||!recinto) {
    showMessage(DOM.voterMessage, 'Complete todos los campos requeridos (incluyendo edad).', 'error'); return;
  }
  if (edad < 16 || edad > 120) { showMessage(DOM.voterMessage, 'La edad debe estar entre 16 y 120 años.', 'error'); return; }
  if (!isValidCedula(cedula)) { showMessage(DOM.voterMessage, 'Ingrese una cédula válida de 11 dígitos.', 'error'); return; }
  if (!isValidPhone(phone))   { showMessage(DOM.voterMessage, 'Ingrese un teléfono válido de 10 dígitos.', 'error'); return; }

  if (!editingId) {
    const { data: existing } = await supabase.from('voters').select('id').eq('cedula', cedula).maybeSingle();
    if (existing) { showMessage(DOM.voterMessage, 'Ya existe un registro con esa cédula.', 'error'); return; }

    const { error } = await supabase.from('voters').insert({
      name, cedula, phone, edad, region, province, municipio, distrito, zone, sector, mesa, recinto, observacion,
      registered_by_id:        currentUser.id,
      registered_by:           currentUser.username,
      registered_by_name:      currentUser.name,
      registered_by_role:      currentUser.role,
      registered_by_region:    currentUser.region    || '',
      registered_by_province:  currentUser.province  || '',
      registered_by_municipio: currentUser.municipio || '',
      registered_by_distrito:  currentUser.distrito  || '',
      registered_by_zone:      currentUser.zone      || ''
    });
    if (error) { showMessage(DOM.voterMessage, 'Error al guardar: ' + error.message, 'error'); return; }
    if (typeof window.logAudit === 'function') window.logAudit('VOTER_CREATE', null, name, {
      cédula:         cedula,
      edad:           edad ? edad + ' años' : '—',
      teléfono:       phone,
      región:         region,
      provincia:      province,
      municipio:      municipio,
      distrito:       distrito,
      zona:           zone,
      sector:         sector,
      mesa:           mesa,
      recinto:        recinto,
      observación:    observacion || '—',
      registrado_por: currentUser.name + ' (' + currentUser.role + ')',
    });
    resetVoterForm();
    showMessage(DOM.voterMessage, 'Registro guardado correctamente.', 'success');
    await fillFilterOptions(); await renderAll();
    return;
  }

  // Editar — admin o el propio registrador
  const { data: voterToCheck } = await supabase.from('voters').select('registered_by_id').eq('id', editingId).maybeSingle();
  if (!hasSuperAccess() && voterToCheck?.registered_by_id !== currentUser?.id) {
    showMessage(DOM.voterMessage, 'Solo puedes editar registros que tú hayas registrado.', 'error'); return;
  }
  const { data: dup } = await supabase.from('voters').select('id').eq('cedula', cedula).neq('id', editingId).maybeSingle();
  if (dup) { showMessage(DOM.voterMessage, 'Ya existe otro registro con esa cédula.', 'error'); return; }

  const { error } = await supabase.from('voters')
    .update({ name, cedula, phone, edad, region, province, municipio, distrito, zone, sector, mesa, recinto, observacion, updated_at: new Date().toISOString() })
    .eq('id', editingId);
  if (error) { showMessage(DOM.voterMessage, 'Error al actualizar: ' + error.message, 'error'); return; }
  if (typeof window.logAudit === 'function') window.logAudit('VOTER_EDIT', editingId, name, {
    cédula:      cedula,
    edad:        edad ? edad + ' años' : '—',
    teléfono:    phone,
    región:      region,
    provincia:   province,
    municipio:   municipio,
    distrito:    distrito,
    zona:        zone,
    sector:      sector,
    mesa:        mesa,
    recinto:     recinto,
    observación: observacion || '—',
    editado_por: currentUser.name + ' (' + currentUser.role + ')',
  });
  resetVoterForm();
  showMessage(DOM.voterMessage, 'Registro actualizado correctamente.', 'success');
  await fillFilterOptions(); await renderAll();
});

// ── Eventos: Acciones en tabla de votantes ──────────────────────

DOM.votersTableBody?.addEventListener('click', async function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!action || !id) return;

  const voters = await getVoters();
  const voter  = voters.find(v => v.id === id);
  if (!voter) { await showAlert('Error', 'No se encontró el registro seleccionado.', 'warning'); return; }

  if (action === 'edit-voter') {
    if (!hasSuperAccess() && voter.registered_by_id !== currentUser?.id) {
      await showAlert('Sin permiso', 'Solo puedes editar los registros que tú mismo hayas registrado.', 'lock'); return;
    }
    fillVoterForm(voter);
    if (typeof window._showPanel === 'function') window._showPanel('registro');
    return;
  }

  if (action === 'delete-voter') {
    if (!hasSuperAccess()) { await showAlert('Acceso restringido', 'No tienes permisos para eliminar registros del sistema.', 'lock'); return; }
    if (!await showConfirm('Eliminar registro', `¿Deseas eliminar permanentemente el registro de "${voter.name}"? Esta acción no se puede deshacer.`, 'danger', 'Sí, eliminar')) return;
    const { error } = await supabase.from('voters').delete().eq('id', id);
    if (error) { showMessage(DOM.voterMessage, 'Error al eliminar: ' + error.message, 'error'); return; }
    if (typeof window.logAudit === 'function') window.logAudit('VOTER_DELETE', id, voter.name, {
      cédula:         voter.cedula,
      teléfono:       voter.phone     || '—',
      provincia:      voter.province  || '—',
      municipio:      voter.municipio || '—',
      zona:           voter.zone      || '—',
      sector:         voter.sector    || '—',
      mesa:           voter.mesa      || '—',
      recinto:        voter.recinto   || '—',
      registrado_por: voter.registered_by_name || '—',
      eliminado_por:  currentUser ? currentUser.name + ' (' + currentUser.role + ')' : '—',
    });
    if (DOM.editingVoterId?.value === id) resetVoterForm();
    showMessage(DOM.voterMessage, 'Registro eliminado correctamente.', 'success');
    await fillFilterOptions(); await renderAll();
  }
});

// ── Eventos: Acciones en tarjetas de consulta ──────────────────

DOM.searchResults?.addEventListener('click', async function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!action || !id) return;

  const voters = await getVoters();
  const voter  = voters.find(v => v.id === id);
  if (!voter) { await showAlert('Error', 'No se encontró el registro seleccionado.', 'warning'); return; }

  if (action === 'edit-voter') {
    if (!hasSuperAccess() && voter.registered_by_id !== currentUser?.id) {
      await showAlert('Sin permiso', 'Solo puedes editar los registros que tú mismo hayas registrado.', 'lock'); return;
    }
    fillVoterForm(voter);
    if (typeof window._showPanel === 'function') window._showPanel('registro');
    return;
  }

  if (action === 'delete-voter') {
    if (!hasSuperAccess()) { await showAlert('Acceso restringido', 'No tienes permisos para eliminar registros del sistema.', 'lock'); return; }
    if (!await showConfirm('Eliminar registro', `¿Deseas eliminar permanentemente el registro de "${voter.name}"? Esta acción no se puede deshacer.`, 'danger', 'Sí, eliminar')) return;
    const { error } = await supabase.from('voters').delete().eq('id', id);
    if (error) { showMessage(DOM.voterMessage, 'Error al eliminar: ' + error.message, 'error'); return; }
    if (typeof window.logAudit === 'function') window.logAudit('VOTER_DELETE', id, voter.name, {
      cédula:         voter.cedula,
      teléfono:       voter.phone     || '—',
      provincia:      voter.province  || '—',
      municipio:      voter.municipio || '—',
      zona:           voter.zone      || '—',
      sector:         voter.sector    || '—',
      mesa:           voter.mesa      || '—',
      recinto:        voter.recinto   || '—',
      registrado_por: voter.registered_by_name || '—',
      eliminado_por:  currentUser ? currentUser.name + ' (' + currentUser.role + ')' : '—',
    });
    if (DOM.editingVoterId?.value === id) resetVoterForm();
    showMessage(DOM.voterMessage, 'Registro eliminado correctamente.', 'success');
    await fillFilterOptions(); await renderAll();
  }
});

// ── Eventos: Botones varios ─────────────────────────────────────

DOM.manageUsersBtn?.addEventListener('click', async () => {
  if (!hasSuperAccess()) { await showAlert('Acceso restringido', 'No tienes permisos para acceder a la gestión de usuarios.', 'lock'); return; }
  if (typeof window._showPanel === 'function') window._showPanel('usuarios');
});
DOM.cancelEditUserBtn?.addEventListener('click',   resetUserForm);
DOM.cancelEditVoterBtn?.addEventListener('click',  resetVoterForm);
DOM.closeUserEditModalBtn?.addEventListener('click', closeUserEditModal);
DOM.cancelUserEditBtn?.addEventListener('click',   closeUserEditModal);
DOM.userEditModal?.addEventListener('click', e => { if (e.target === DOM.userEditModal) closeUserEditModal(); });

// ── Eventos: Formateo de inputs ─────────────────────────────────

DOM.registerPhone?.addEventListener('input', e => e.target.value = formatPhone(e.target.value));
DOM.voterPhone?.addEventListener('input',    e => e.target.value = formatPhone(e.target.value));
DOM.editUserPhone?.addEventListener('input', e => e.target.value = formatPhone(e.target.value));

DOM.voterCedula?.addEventListener('input', function(e) {
  const input  = e.target;
  const pos    = input.selectionStart;
  const oldVal = input.value;
  const newVal = formatCedula(oldVal);
  if (newVal === oldVal) return;
  // Contar cuántos dígitos había antes del cursor en el valor original
  const digsBefore = oldVal.slice(0, pos).replace(/[^\d]/g, '').length;
  input.value = newVal;
  // Reposicionar el cursor contando los mismos dígitos en el nuevo valor
  let newPos = 0, cnt = 0;
  while (newPos < newVal.length && cnt < digsBefore) {
    if (/\d/.test(newVal[newPos])) cnt++;
    newPos++;
  }
  input.setSelectionRange(newPos, newPos);
});

// ── Eventos: Filtros ────────────────────────────────────────────

[DOM.searchInput, DOM.filterProvince, DOM.filterMunicipio,
 DOM.filterSector, DOM.filterMesa, DOM.filterRole, DOM.filterRegistrar]
  .forEach(el => {
    el?.addEventListener('input',  async () => { await renderVotersTable(); await renderSearchResults(); await renderAnalytics(); });
    el?.addEventListener('change', async () => { await renderVotersTable(); await renderSearchResults(); await renderAnalytics(); });
  });

DOM.clearFiltersBtn?.addEventListener('click', clearFilters);
DOM.exportBtn?.addEventListener('click', exportToExcel);

window.addEventListener('resize', async () => {
  if (DOM.dashboardSection && !DOM.dashboardSection.classList.contains('hidden')) await drawProvinceChart();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (DOM.userEditModal      && !DOM.userEditModal.classList.contains('hidden'))      closeUserEditModal();
    if (DOM.forgotPasswordModal && !DOM.forgotPasswordModal.classList.contains('hidden')) closeForgotModal();
  }
});

//Funcion nueva
window.exportVoters = async function () {
  var res = await supabase.from("voters").select("*");

  if (res.error || !res.data.length) {
    await showAlert('Sin registros', 'No hay datos disponibles para exportar.', 'info');
    return;
  }

  var data = res.data;

  var rows = data.map(v => [
    v.name,
    v.cedula,
    v.phone,
    v.province,
    v.municipio,
    v.sector,
    v.recinto
  ]);

  /* ===== EXCEL ===== */
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet([
    ["REGISTRO DE VOTANTES"],
    [],
    ["Nombre", "Cédula", "Teléfono", "Provincia", "Municipio", "Sector", "Recinto"],
    ...rows
  ]);

  XLSX.utils.book_append_sheet(wb, ws, "Votantes");
  XLSX.writeFile(wb, "votantes.xlsx");

  /* ===== PDF ===== */
  const { jsPDF } = window.jspdf;
  var doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Registro de Votantes", 14, 15);

  doc.autoTable({
    startY: 20,
    head: [["Nombre", "Cédula", "Teléfono", "Provincia", "Municipio"]],
    body: rows.map(r => r.slice(0,5)),
    styles: { fontSize: 8 }
  });

  doc.save("votantes.pdf");

  if (typeof window.logAudit === 'function') window.logAudit('DATA_EXPORT', null, 'Lista de simpatizantes PDF', {
    formato:       'PDF',
    tipo:          'Reporte de votantes',
    exportado_por: currentUser ? currentUser.name + ' (' + currentUser.role + ')' : '—',
  });
};

// ── Modales personalizados (reemplazan alert / confirm nativos) ──

const _DIALOG_ICONS = {
  danger:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  lock:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
};

function showConfirm(title, message, type = 'danger', okLabel = 'Confirmar') {
  return new Promise(resolve => {
    const modal     = document.getElementById('confirmModal');
    const titleEl   = document.getElementById('confirmModalTitle');
    const msgEl     = document.getElementById('confirmModalMsg');
    const iconEl    = document.getElementById('confirmModalIcon');
    const okBtn     = document.getElementById('confirmModalOkBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    if (!modal) { resolve(window.confirm(message)); return; }

    titleEl.textContent  = title;
    msgEl.textContent    = message;
    okBtn.textContent    = okLabel;
    iconEl.innerHTML     = _DIALOG_ICONS[type] || _DIALOG_ICONS.warning;
    iconEl.className     = `custom-dialog-icon cdialog-${type}`;
    okBtn.className      = `${type === 'danger' ? 'danger-btn' : 'primary-btn'} custom-dialog-ok`;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    okBtn.focus();

    const cleanup = result => {
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlay);
      resolve(result);
    };
    const onOk      = () => cleanup(true);
    const onCancel  = () => cleanup(false);
    const onOverlay = e => { if (e.target === modal) cleanup(false); };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlay);
  });
}

function showAlert(title, message, type = 'info') {
  return new Promise(resolve => {
    const modal  = document.getElementById('alertModal');
    const titleEl= document.getElementById('alertModalTitle');
    const msgEl  = document.getElementById('alertModalMsg');
    const iconEl = document.getElementById('alertModalIcon');
    const okBtn  = document.getElementById('alertModalOkBtn');
    if (!modal) { window.alert(message); resolve(); return; }

    titleEl.textContent = title;
    msgEl.textContent   = message;
    iconEl.innerHTML    = _DIALOG_ICONS[type] || _DIALOG_ICONS.info;
    iconEl.className    = `custom-dialog-icon cdialog-${type}`;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    okBtn.focus();

    const cleanup = () => {
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      okBtn.removeEventListener('click', onOk);
      modal.removeEventListener('click', onOverlay);
      resolve();
    };
    const onOk      = () => cleanup();
    const onOverlay = e => { if (e.target === modal) cleanup(); };
    okBtn.addEventListener('click', onOk);
    modal.addEventListener('click', onOverlay);
  });
}

// ── Inicialización ──────────────────────────────────────────────

(async function init() {
  populateProvinceSelects();
  populateRoleSelects();
  await updateInitialHint();
  updateAdminAccess();

  // Detectar token de recuperación en la URL (?reset_token=...)
  const urlParams  = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset_token');
  if (resetToken) {
    window.history.replaceState({}, '', window.location.pathname);
    const { data: user } = await supabase
      .from('users').select('id, reset_token_expires')
      .eq('reset_token', resetToken).maybeSingle();
    showAuth();
    if (user && new Date(user.reset_token_expires) > new Date()) {
      window._pendingResetToken = resetToken;
      openResetModal();
    } else {
      showMessage(DOM.authMessage, 'El enlace de recuperación ha expirado o no es válido. Solicite uno nuevo.', 'error');
    }
    return;
  }

  // Restaurar sesión desde sessionStorage (ID → consultar perfil actualizado)
  const storedUid = sessionStorage.getItem('upd_uid');
  if (storedUid) {
    const { data: user } = await supabase.from('users').select('*').eq('id', storedUid).maybeSingle();
    if (user && (user.status || 'Pendiente') === 'Aprobado') {
      currentUser = user;
      applyTheme(user.theme || 'light');
      updateAdminAccess();
      await loadDashboard();
      return;
    }
    sessionStorage.removeItem('upd_uid');
  }

  showAuth();
})();
