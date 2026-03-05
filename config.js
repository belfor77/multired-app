// ===================== CONFIGURACIÓN NUBE (SUPABASE) =====================
const SB_URL = "https://kaswrwdnkitiliejokbu.supabase.co";
const SB_KEY = "sb_publishable_NElYaUu7PNYuh8HylySkBw_73uLAWbS";

// ✅ NO usar "supabase" como variable (ese nombre ya existe por el CDN)
let supabaseClient = null;

// Intentamos conectar, pero si falla, la app sigue funcionando local
try {
  // El CDN normalmente expone "window.supabase"
  if (typeof window.supabase !== "undefined" && typeof window.supabase.createClient === "function") {
    supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
    console.log("Supabase conectado correctamente ☁️");
  } else {
    console.warn("Librería Supabase no detectada. Trabajando en modo local.");
  }
} catch (e) {
  console.error("Error al inicializar Supabase:", e);
}

// ===================== STORAGE KEYS =====================
const LS_SALES = "sales_demo_v2";
const LS_DOCS  = "docs_demo_v2";
const LS_NOTIF = "avisos_demo_v2";
const LS_USERS = "users_demo_v2";
const LS_AUTH  = "auth_ok_v2";
const LS_AUTH_USER = "auth_user_v2";
const LS_THEME_MODE = "theme_mode"; // system | light | dark
const LS_THEME_DARK = "theme_dark_manual"; // 1|0
const LS_SUPPORT_TICKETS = "support_tickets_v2"; // tickets + chat por ticket (demo)
const LS_SUPPORT_ACTIVE = "support_active_ticket_v2"; // id ticket activo (demo)
const LS_DND = "pref_dnd_v2";
const LS_SOUND = "pref_sound_v2";
const LS_SIDE = "sideCollapsed_v2";

// ===================== HELPERS =====================
const $ = (id) => document.getElementById(id);

function safeParse(json, fallback){
  try { return JSON.parse(json); } catch { return fallback; }
}
function nowISO(){ return new Date().toISOString(); }
function fmtDate(iso){
  try{
    return new Date(iso).toLocaleString("es-CL", { dateStyle:"short", timeStyle:"short" });
  }catch{ return iso || ""; }
}
function norm(s){ return (s||"").toString().trim().toLowerCase(); }
function moneyCLP(n){
  const num = Number(String(n ?? "0").replace(/[^\d]/g,"")) || 0;
  return new Intl.NumberFormat("es-CL").format(num);
}
function uid(prefix="ID"){
  return `${prefix}-${Math.random().toString(16).slice(2,8).toUpperCase()}${Date.now().toString().slice(-4)}`;
}

// ===================== TOASTS =====================
const toastWrap = $("toastWrap");
function toast(title, meta="", ms=2500, type="info"){
  if (isDnd()) return;
  if (!toastWrap) return;

  const el = document.createElement("div");
    el.className = `toast toast-${type}`;
  el.innerHTML = `
    <div class="t-title">${escapeHtml(title)}</div>
    ${meta ? `<div class="t-meta">${escapeHtml(meta)}</div>` : ""}
  `;
  toastWrap.appendChild(el);

  if (isSoundOn()) beep();

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-4px)";
    el.style.transition = "all .18s ease";
    setTimeout(() => el.remove(), 180);
  }, ms);
}
function escapeHtml(str){
  return (str ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
// 👇 PEGA ESTO AQUÍ DEBAJO 👇
async function apiPost(path, body){
  const res = await fetch(`http://localhost:8000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json();
}
function beep(){
  // beep cortito con WebAudio (no molesto)
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 90);
  }catch{}
}

// ===================== DATA ACCESSORS =====================
function getSales(){ return safeParse(localStorage.getItem(LS_SALES) || "[]", []); }
function setSales(arr){ localStorage.setItem(LS_SALES, JSON.stringify(arr || [])); }

function getDocs(){ return safeParse(localStorage.getItem(LS_DOCS) || "[]", []); }
function setDocs(arr){ localStorage.setItem(LS_DOCS, JSON.stringify(arr || [])); }

function getAvisos(){ return safeParse(localStorage.getItem(LS_NOTIF) || "[]", []); }
function setAvisos(arr){ localStorage.setItem(LS_NOTIF, JSON.stringify(arr || [])); }
function addAviso(title, meta){
  const list = getAvisos();
  list.unshift({ id: uid("AV"), title, meta, at: nowISO() });
  setAvisos(list);
  updateBadgeCounts();
}

function getUsers(){
  const list = safeParse(localStorage.getItem(LS_USERS) || "[]", []);
  // admin demo
  const hasAdmin = list.some(u => u.user === "admin");
  if (!hasAdmin){
    list.unshift({
      user: "admin",
      pass: "Admin1234",
      email: "admin@demo.cl",
      name: "Admin",
      rut: "",
      country: "Chile",
      phone: ""
    });
    localStorage.setItem(LS_USERS, JSON.stringify(list));
  }
  return list;
}
function setUsers(list){ localStorage.setItem(LS_USERS, JSON.stringify(list || [])); }

function setAuth(ok, userObj){
  localStorage.setItem(LS_AUTH, ok ? "1" : "0");
  if (ok && userObj){
    localStorage.setItem(LS_AUTH_USER, JSON.stringify(userObj));
  } else {
    localStorage.removeItem(LS_AUTH_USER);
  }
}
function isAuthed(){ return localStorage.getItem(LS_AUTH) === "1"; }
function getAuthedUser(){ return safeParse(localStorage.getItem(LS_AUTH_USER) || "null", null); }
