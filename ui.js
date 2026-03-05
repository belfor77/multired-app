// ===================== THEME / PREFS =====================
const swSystemTheme = $("swSystemTheme");
const swDarkTheme = $("swDarkTheme");
const themeChip = $("themeChip");
const themeStatusText = $("themeStatusText");

const swSound = $("swSound");
const swDnd = $("swDnd");

function isSoundOn(){ return (localStorage.getItem(LS_SOUND) || "1") === "1"; }
function isDnd(){ return (localStorage.getItem(LS_DND) || "0") === "1"; }

function resolveSystemTheme(){
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const prefersDark = mq ? mq.matches : false;
  return prefersDark ? "dark" : "light";
}
function applyTheme(resolvedTheme, mode){
  const html = document.documentElement;
  html.setAttribute("data-theme", resolvedTheme);
  html.setAttribute("data-theme-mode", mode);
}
function getThemeMode(){ return localStorage.getItem(LS_THEME_MODE) || "system"; }
function getManualDark(){ return (localStorage.getItem(LS_THEME_DARK) || "0") === "1"; }

function setThemeMode(mode){
  localStorage.setItem(LS_THEME_MODE, mode);
  const resolved = (mode === "system") ? resolveSystemTheme() : mode;
  applyTheme(resolved, mode);
  document.body.classList.add("theme-transition");
  updateThemeUI();
}
function setManualDark(isDark){
  localStorage.setItem(LS_THEME_DARK, isDark ? "1" : "0");
  setThemeMode(isDark ? "dark" : "light");
}
function updateThemeUI(){
  const mode = getThemeMode();
  const resolved = (mode === "system") ? resolveSystemTheme() : mode;

  if (swSystemTheme) swSystemTheme.checked = (mode === "system");
  if (swDarkTheme){
    swDarkTheme.disabled = (mode === "system");
    swDarkTheme.checked = (resolved === "dark");
  }
  if (themeChip) themeChip.textContent = resolved === "dark" ? "Oscuro" : "Claro";
  if (themeStatusText){
    themeStatusText.textContent =
      (mode === "system")
        ? `Sistema (ahora: ${resolved === "dark" ? "Oscuro" : "Claro"})`
        : `Manual (${resolved === "dark" ? "Oscuro" : "Claro"})`;
  }
}
function initAppearanceUI(){
  updateThemeUI();
  if (swSound) swSound.checked = isSoundOn();
  if (swDnd) swDnd.checked = isDnd();
}

// events theme/prefs
swSystemTheme?.addEventListener("change", () => {
  if (swSystemTheme.checked) setThemeMode("system");
  else setManualDark(getManualDark());
});
swDarkTheme?.addEventListener("change", () => {
  if (swDarkTheme.disabled) return;
  setManualDark(!!swDarkTheme.checked);
});
swSound?.addEventListener("change", () => {
  localStorage.setItem(LS_SOUND, swSound.checked ? "1" : "0");
  toast("Preferencias", swSound.checked ? "Sonido activado" : "Sonido desactivado");
});
swDnd?.addEventListener("change", () => {
  localStorage.setItem(LS_DND, swDnd.checked ? "1" : "0");
  toast("Preferencias", swDnd.checked ? "No molestar activado" : "No molestar desactivado");
});

// system theme live update
const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
if (mq && mq.addEventListener){
  mq.addEventListener("change", () => {
    if (getThemeMode() === "system"){
      applyTheme(resolveSystemTheme(), "system");
      document.body.classList.add("theme-transition");
      updateThemeUI();
    }
  });
} else if (mq && mq.addListener){
  mq.addListener(() => {
    if (getThemeMode() === "system"){
      applyTheme(resolveSystemTheme(), "system");
      document.body.classList.add("theme-transition");
      updateThemeUI();
    }
  });
}

// ===================== SIDEBAR COLLAPSE =====================
const btnSideToggle = $("btnSideToggle");
function setSidebarCollapsed(collapsed){
  document.body.classList.toggle("side-collapsed", collapsed);
  try { localStorage.setItem(LS_SIDE, collapsed ? "1" : "0"); } catch {}
}
btnSideToggle?.addEventListener("click", () => {
  const collapsed = document.body.classList.contains("side-collapsed");
  setSidebarCollapsed(!collapsed);
});
try{
  if (localStorage.getItem(LS_SIDE) === "1") setSidebarCollapsed(true);
}catch{}

// ===================== VIEWS / NAVIGATION =====================
const views = Array.from(document.querySelectorAll(".view"));
function hideAllViews(){ views.forEach(v => v.style.display = "none"); }
function showView(id){
  views.forEach(v => {
    v.style.display = "none";
  });

  const el = $(id);
  if (!el) return;

  // NO forzamos display, dejamos que el CSS lo controle
  el.style.display = "";
  el.classList.remove("view-in");
void el.offsetWidth; // reflow para reiniciar animación
el.classList.add("view-in");
}

const sideButtons = Array.from(document.querySelectorAll(".iconbar .ibtn"));
function setActiveSide(btn){
  sideButtons.forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

// Sidebar buttons (IDs reales del HTML)
const btnSidePanel    = $("btnSidePanel");
const btnSideCapacitaciones = $("btnSideCapacitaciones");
const btnSideCart     = $("btnSideCart");
const btnSideSupport  = $("btnSideSupport");
const btnSideDocs     = $("btnSideDocs");
const btnSideAvisos   = $("btnSideAvisos");
const btnSidePolicies = $("btnSidePolicies");
const btnSideSettings = $("btnSideSettings");

// Top links
const btnTopSoporte = $("btnTopSoporte");
const btnTopVentas = $("btnTopVentas");
const btnTopAvisos = $("btnTopAvisos");
const btnFactibilidad = $("btnFactibilidad");
const btnTopRegistrarVenta = $("btnTopRegistrarVenta");
// Back buttons
$("btnBackDashboard")?.addEventListener("click", () => goDashboard());
$("btnBackFromSearch")?.addEventListener("click", () => goDashboard());
$("btnBackFromCart")?.addEventListener("click", () => goDashboard());
$("btnBackFromDocs")?.addEventListener("click", () => goDashboard());
$("btnBackFromCapacitaciones")?.addEventListener("click", () => goDashboard());
$("btnBackFromAvisos")?.addEventListener("click", () => goDashboard());
$("btnBackFromPolicies")?.addEventListener("click", () => goDashboard());
$("btnBackFromSettings")?.addEventListener("click", () => goDashboard());
$("btnBackFromSupport")?.addEventListener("click", () => goDashboard());
$("btnBackFromProfileInfo")?.addEventListener("click", () => goDashboard());
$("btnBackFromProfileSecurity")?.addEventListener("click", () => goDashboard());

// navigation functions
function goDashboard(){
  showView("viewDashboard");
  setActiveSide(btnSidePanel);
}
function goSearch(){
  showView("viewSearch");
  setActiveSide(null); // no hay botón de Search en la sidebar
}
function goVentasMenu(){
  showView("viewVentas");
  setActiveSide(null);
}
function goCart(){
  renderCart();
  showView("viewCart");
  setActiveSide(btnSideCart);
}

function goCapacitaciones(){
  renderCapacitaciones(); 
  showView("viewCapacitaciones");
  setActiveSide(btnSideCapacitaciones);
}
function goSupport(){
  renderTicketsTable();
  showView("viewSupport");
  setActiveSide(btnSideSupport);
}
function goDocs(){
  renderDocs();
  showView("viewDocs");
  setActiveSide(btnSideDocs);
}
function goAvisos(){
  renderAvisos();
  showView("viewAvisos");
  setActiveSide(btnSideAvisos);
}
function goPolicies(){
  showView("viewPolicies");
  setActiveSide(btnSidePolicies);
}
function goSettings(){
  initAppearanceUI();
  showView("viewSettings");
  setActiveSide(btnSideSettings);
}
function goProfileInfo(){
  fillProfileInfo();
  showView("viewProfileInfo");
  setActiveSide(null);
}
function goProfileSecurity(){
  showView("viewProfileSecurity");
  setActiveSide(null);
}

// bind sidebar
btnSidePanel?.addEventListener("click", goDashboard);
btnSideCapacitaciones?.addEventListener("click", goCapacitaciones);
btnSideCart?.addEventListener("click", goCart);
btnSideSupport?.addEventListener("click", goSupport);
btnSideDocs?.addEventListener("click", goDocs);
btnSideAvisos?.addEventListener("click", goAvisos);
btnSidePolicies?.addEventListener("click", goPolicies);
btnSideSettings?.addEventListener("click", goSettings);
// bind top links
btnTopVentas?.addEventListener("click", goVentasMenu);
btnTopSoporte?.addEventListener("click", goSupport);
btnTopAvisos?.addEventListener("click", goAvisos);

function openSharedStaffPanel() {
  showView("viewAdminPanel");
  if (typeof loadAdminSellers === 'function') loadAdminSellers();
  if (typeof renderAdminPanel === 'function') renderAdminPanel();
  if (typeof switchAdminTab === 'function') switchAdminTab('ventas');
  
  const u = getAuthedUser();
  const titleEl = $("adminPanelTitle");
  if (titleEl) {
    if (u?.rol === "BackOffice" || u?.user === "backoffice1") {
      titleEl.innerHTML = "Panel BackOffice 🟢";
      titleEl.style.color = "#22c55e";
    } else {
      titleEl.innerHTML = "Panel de Supervisor 👑";
      titleEl.style.color = "#facc15";
    }
  }
}

$("btnTopAdminPanel")?.addEventListener("click", openSharedStaffPanel);
$("btnTopBackofficePanel")?.addEventListener("click", openSharedStaffPanel);
$("btnAdminPanelVentas")?.addEventListener("click", openSharedStaffPanel);
$("btnBackofficePanelVentas")?.addEventListener("click", openSharedStaffPanel);

// 🔥 Evento para el botón flotante de Soporte (Admin RUTS) 🔥
$("adminSupportFab")?.addEventListener("click", () => {
  goSupport(); // Te lleva a la pantalla de tickets
  
  // Si el panel flotante de chat está abierto, lo cerramos para no estorbar visualmente
  const supportPanel = $("supportPanel");
  if (supportPanel && supportPanel.style.display === "flex") {
    supportPanel.style.display = "none";
  }
});

// ===================== USER MENU =====================
const btnUserMenu = $("btnUserMenu");
const userMenu = $("userMenu");
function setUserMenu(open){
  if (!userMenu) return;
  userMenu.style.display = open ? "block" : "none";
}
btnUserMenu?.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = userMenu?.style.display === "block";
  setUserMenu(!open);
});
document.addEventListener("click", () => setUserMenu(false));

$("btnProfileInfo")?.addEventListener("click", () => { setUserMenu(false); goProfileInfo(); });
$("btnProfileSecurity")?.addEventListener("click", () => { setUserMenu(false); goProfileSecurity(); });

$("btnLogout")?.addEventListener("click", () => {
  setUserMenu(false);
  setAuth(false);
  location.reload();
});
$("btnLogoutAll")?.addEventListener("click", () => {
  setUserMenu(false);
  // demo: limpiamos auth + “sesiones”
  localStorage.removeItem(LS_AUTH);
  localStorage.removeItem(LS_AUTH_USER);
  localStorage.removeItem(LS_SUPPORT_ACTIVE);
  toast("Sesión", "Cerraste sesión en todos (demo)");
  location.reload();
});

function fillProfileHeader(){
  const u = getAuthedUser();
  const name = u?.name || u?.user || "—";
  const isAdmin = (u?.user === "admin" || u?.rol === "Admin");
  const isBackoffice = (u?.user === "backoffice1" || u?.rol === "BackOffice");
  
  let role = "Ejecutivo Freelancer";
  let icon = "";
  if (isAdmin) { role = "Administrador General"; icon = "👑"; }
  else if (isBackoffice) { role = "Operaciones BackOffice"; icon = "🟢"; }
  
  const pn = $("profileName");
  const pr = $("profileRole");
  
  if (pn) {
    pn.innerHTML = (isAdmin || isBackoffice) ? `${escapeHtml(name)} <span style="font-size:16px;" title="Staff">${icon}</span>` : escapeHtml(name);
  }
  if (pr) {
    pr.textContent = role;
    if (isAdmin) pr.style.color = "#facc15"; 
    if (isBackoffice) pr.style.color = "#22c55e"; 
  }

  // Control de clases en el Body para mostrar los botones correctos
  document.body.classList.toggle("is-admin", isAdmin);
  document.body.classList.toggle("is-backoffice", isBackoffice);
}
function fillProfileInfo(){
  const u = getAuthedUser();
  const box = $("profileInfoBox");
  if (!box) return;
  if (!u) { box.textContent = "—"; return; }
  box.innerHTML = `
    <b>Nombre:</b> ${escapeHtml(u.name || "-")}<br>
    <b>Usuario:</b> ${escapeHtml(u.user || "-")}<br>
    <b>Correo:</b> ${escapeHtml(u.email || "-")}<br>
    <b>RUT:</b> ${escapeHtml(u.rut || "-")}<br>
    <b>País:</b> ${escapeHtml(u.country || "-")}<br>
    <b>Teléfono:</b> ${escapeHtml(u.phone || "-")}
  `;
}
$("btnShowSessions")?.addEventListener("click", () => {
  const u = getAuthedUser();
  alert(`Sesión (demo)\nUsuario: ${u?.user || "—"}\nÚltimo inicio: ${fmtDate(u?.last_login || nowISO())}`);
});
