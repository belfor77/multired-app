// ===================== DOCUMENTOS =====================
const docFile = $("docFile");
const docsBody = $("docsBody");

function renderDocs(){
  if (!docsBody) return;
  const docs = getDocs();

  docsBody.innerHTML = docs.map(d => `
    <tr>
      <td>${escapeHtml(d.name)}</td>
      <td>${escapeHtml(d.type || "-")}</td>
      <td>${escapeHtml(fmtDate(d.at))}</td>
      <td style="text-align:right;">
        <button class="btn" data-doc-del="${escapeHtml(d.id)}" type="button">Eliminar</button>
      </td>
    </tr>
  `).join("") || `
    <tr><td colspan="4" style="color: rgba(255,255,255,.6);">Aún no hay documentos (demo).</td></tr>
  `;

  docsBody.querySelectorAll("[data-doc-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-doc-del");
      const list = getDocs().filter(x => x.id !== id);
      setDocs(list);
      toast("Documentos", "Eliminado");
      renderDocs();
    });
  });
}

$("btnAddDoc")?.addEventListener("click", () => {
  if (!docFile?.files || docFile.files.length === 0){
    toast("Documentos", "Selecciona un archivo primero");
    return;
  }
  const f = docFile.files[0];
  const docs = getDocs();
  docs.unshift({ id: uid("DOC"), name: f.name, type: f.type || "archivo", at: nowISO() });
  setDocs(docs);

  addAviso("Documento agregado", f.name);
  toast("Documento agregado", f.name);

  docFile.value = "";
  renderDocs();
});

// ===================== AVISOS =====================
const avisosList = $("avisosList");

function renderAvisos(){
  if (!avisosList) return;
  const list = getAvisos();

  avisosList.innerHTML = list.map(a => `
    <div class="aviso-item">
      <div class="aviso-title">${escapeHtml(a.title)}</div>
      <div class="aviso-meta">${escapeHtml(a.meta)} • ${escapeHtml(fmtDate(a.at))}</div>
    </div>
  `).join("") || `<div class="hint" style="margin:0;">No hay avisos recientes.</div>`;
}

$("btnAvisosClear")?.addEventListener("click", () => {
  setAvisos([]);
  toast("Avisos", "Bandeja limpia");
  renderAvisos();
  updateBadgeCounts();
});

// ===================== SOPORTE: INTAKE + CHAT FLOAT + PANEL INTERNO =====================
const supportFab = $("supportFab");
const supportPanel = $("supportPanel");
const supportClose = $("supportClose");
const supportReset = $("supportReset");
const supportBody = $("supportBody");
const supportMsg = $("supportMsg");
const supportSend = $("supportSend");
const chatBadge = $("chatBadge");
const supportHeaderText = $("supportHeaderText");
const supportFooterHint = $("supportFooterHint");
const supportAttach = $("supportAttach");
const supportAttachInput = $("supportAttachInput");

const intakeBackdrop = $("intakeBackdrop");
const btnCloseIntake = $("btnCloseIntake");
const btnCreateTicket = $("btnCreateTicket");
const intakeTopic = $("intakeTopic");
const intakePriority = $("intakePriority");
const intakeChannel = $("intakeChannel");
const intakeDynamicLabel = $("intakeDynamicLabel");
const intakeDynamic = $("intakeDynamic");
const intakeDynamicHint = $("intakeDynamicHint");

function getSupportTickets(){ return safeParse(localStorage.getItem(LS_SUPPORT_TICKETS) || "[]", []); }
function setSupportTickets(list){ localStorage.setItem(LS_SUPPORT_TICKETS, JSON.stringify(list || [])); }
function getActiveTicketId(){ return localStorage.getItem(LS_SUPPORT_ACTIVE) || ""; }
function setActiveTicketId(id){ if (!id) localStorage.removeItem(LS_SUPPORT_ACTIVE); else localStorage.setItem(LS_SUPPORT_ACTIVE, id); }

function openIntake(){ if (intakeBackdrop) { intakeBackdrop.style.display = "grid"; updateIntakeDynamic(); } }
function closeIntake(){ if (intakeBackdrop) intakeBackdrop.style.display = "none"; }

btnCloseIntake?.addEventListener("click", closeIntake);
intakeBackdrop?.addEventListener("click", (e) => { if (e.target === intakeBackdrop) closeIntake(); });

function updateIntakeDynamic(){
  const topic = intakeTopic?.value || "Otro";
  if (!intakeDynamicLabel || !intakeDynamicHint) return;

  if (topic === "Factibilidad"){
    intakeDynamicLabel.textContent = "Dirección / Comuna";
    intakeDynamic.placeholder = "Ej: Av. Vicuña Mackenna 1234, La Florida";
    intakeDynamicHint.textContent = "Tip: agrega calle + número + comuna.";
  } else if (topic === "Cuenta"){
    intakeDynamicLabel.textContent = "Correo / Usuario";
    intakeDynamic.placeholder = "Ej: correo@ejemplo.com";
    intakeDynamicHint.textContent = "Tip: indica el correo con el que te registraste.";
  } else if (topic === "Ventas"){
    intakeDynamicLabel.textContent = "Código de venta / RUT";
    intakeDynamic.placeholder = "Ej: V-1234567 o 12.345.678-9";
    intakeDynamicHint.textContent = "Tip: pega el código o RUT del cliente.";
  } else if (topic === "Conectividad"){
    intakeDynamicLabel.textContent = "Zona / Síntoma";
    intakeDynamic.placeholder = "Ej: sin internet / baja velocidad / comuna...";
    intakeDynamicHint.textContent = "Tip: di desde cuándo ocurre.";
  } else {
    intakeDynamicLabel.textContent = "Describe el problema";
    intakeDynamic.placeholder = "Describe en 1 frase...";
    intakeDynamicHint.textContent = "Tip: mientras más específico, mejor.";
  }
}
intakeTopic?.addEventListener("change", updateIntakeDynamic);

btnCreateTicket?.addEventListener("click", async () => {
  const topic = intakeTopic?.value || "Otro";
  const priority = intakePriority?.value || "Media";
  const channel = intakeChannel?.value || "Correo";
  const summary = (intakeDynamic?.value || "").trim();

  if (!summary){ toast("Soporte", "Describe el problema en 1 frase"); return; }
  const u = getAuthedUser();
  if (!u) { toast("Error", "No estás autenticado"); return; }

  const btn = $("btnCreateTicket");
  btn.disabled = true;
  btn.textContent = "Creando ticket... ☁️";

  const codigoTicket = "TK-" + Date.now().toString().slice(-6);
  const msjInicial = { from: "bot", text: `✅ Ticket creado (${topic} • ${priority}). Resumen: ${summary}`, at: nowISO() };

  const nuevoTicket = {
    codigo: codigoTicket, estado: "Nuevo", tema: topic, prioridad: priority,
    canal: channel, creado_por: u.user, creado_por_nombre: u.name,
    resumen: summary, chat: [msjInicial]
  };

  try {
    const { data, error } = await supabaseClient.from('tickets').insert([nuevoTicket]).select().single();
    if (error) throw error;
    setActiveTicketId(data.id);
    addAviso("Ticket creado", `${data.codigo} • ${topic}`);
    toast("Ticket creado", `${data.codigo}`);
    closeIntake();
    openSupportPanel();
    await cargarTicketsNube(); 
  } catch (err) {
    console.error("Error al crear ticket:", err);
    toast("Error", "No se pudo crear el ticket en la nube");
  } finally {
    btn.disabled = false; btn.textContent = "Crear ticket y abrir chat";
  }
});

function openSupportPanel(){
  if (!supportPanel) return;
  supportPanel.style.display = "flex";
  updateSupportHeader();
  updateBadgeCounts();
}
function closeSupportPanel(){ if (supportPanel) supportPanel.style.display = "none"; }
supportClose?.addEventListener("click", closeSupportPanel);

supportFab?.addEventListener("click", () => {
  const isOpen = supportPanel?.style.display === "flex";
  if (isOpen){ closeSupportPanel(); return; }
  const active = getActiveTicketId();
  if (!active) openIntake(); else { openSupportPanel(); renderSupportChat(); }
});

supportReset?.addEventListener("click", () => {
  const active = getActiveTicketId();
  if (!active){ toast("Soporte", "No hay ticket activo"); return; }
  if (!confirm("¿Cerrar ticket activo localmente?")) return;

  const list = getSupportTickets();
  const idx = list.findIndex(t => t.id === active);
  if (idx >= 0){
    list[idx].status = "Resuelto";
    list[idx].chat.push({ from:"bot", text:"✅ Ticket cerrado localmente.", at: nowISO() });
    setSupportTickets(list);
    addAviso("Ticket resuelto", `${list[idx].ticket} • ${list[idx].topic}`);
  }
  setActiveTicketId("");
  closeSupportPanel();
  updateBadgeCounts();
});

function updateSupportHeader(){
  const active = getActiveTicketId();
  const list = getSupportTickets();
  const t = list.find(x => x.id === active);
  if (supportHeaderText) supportHeaderText.textContent = t ? `Soporte • ${t.ticket}` : "Soporte";
  if (supportFooterHint) supportFooterHint.textContent = t ? `${t.topic} • ${t.status} • ${t.priority}` : "Crea un ticket para comenzar.";
}

function renderSupportChat(){
  if (!supportBody) return;
  const active = getActiveTicketId();
  const list = getSupportTickets();
  const t = list.find(x => x.id === active);
  updateSupportHeader();
  if (!t){
    supportBody.innerHTML = `<div class="hint" style="margin:0;">No hay ticket activo. Abre uno con el botón 💬</div>`;
    return;
  }
  supportBody.innerHTML = t.chat.map(m => `
    <div class="msg ${m.from === "me" ? "me" : ""}">
      <div>${escapeHtml(m.text)}</div>
      <div class="meta">${escapeHtml(fmtDate(m.at))}</div>
    </div>
  `).join("");
  supportBody.scrollTop = supportBody.scrollHeight;
}

supportSend?.addEventListener("click", async () => {
  const text = (supportMsg?.value || "").trim();
  if (!text) return;
  const activeId = getActiveTicketId();
  if (!activeId){ toast("Soporte", "Primero crea un ticket"); openIntake(); return; }

  const list = getSupportTickets();
  const t = list.find(x => x.id === activeId);
  if (!t) return;

  const nuevoMsj = { from: "me", text, at: nowISO() };
  t.chat.push(nuevoMsj);
  setSupportTickets(list); 
  supportMsg.value = "";
  renderSupportChat();

  try {
    const { error } = await supabaseClient.from('tickets').update({ chat: t.chat }).eq('id', activeId);
    if (error) throw error;
  } catch (err) {
    console.error("Error al enviar msj:", err);
    toast("Error", "No se pudo guardar el mensaje en la nube");
  }
});

supportMsg?.addEventListener("keydown", (e) => { if (e.key === "Enter"){ e.preventDefault(); supportSend?.click(); } });

// ===================== PANEL TICKETS INTERNO =====================
const tkBody = $("tkBody");
const tkStatusFilter = $("tkStatusFilter");
const tkTopicFilter = $("tkTopicFilter");
const tkSearch = $("tkSearch");
$("btnTkRefresh")?.addEventListener("click", renderTicketsTable);
tkStatusFilter?.addEventListener("change", renderTicketsTable);
tkTopicFilter?.addEventListener("change", renderTicketsTable);
tkSearch?.addEventListener("input", renderTicketsTable);

const ticketDetailBackdrop = $("ticketDetailBackdrop");
const btnCloseTicketDetail = $("btnCloseTicketDetail");
const ticketDetailTitle = $("ticketDetailTitle");
const ticketDetailData = $("ticketDetailData");
const ticketDetailChat = $("ticketDetailChat");
const ticketDetailStatus = $("ticketDetailStatus");
const btnSaveTicketStatus = $("btnSaveTicketStatus");
let currentTicketId = null;

function renderTicketsTable(){
  const body = document.getElementById("tkBody");
  if (!body) return;
  
  const list = getSupportTickets();
  const searchEl = document.getElementById("tkSearch");
  const statusEl = document.getElementById("tkStatusFilter");
  
  const qs = norm(searchEl ? searchEl.value : "");
  const st = statusEl ? statusEl.value : "";

  const u = getAuthedUser();
  const isAdmin = u && (u.rol === "Admin" || u.rol === "BackOffice" || u.user === "admin");

  const filtered = list.filter(t => {
    // Si no es Admin, ocultamos los tickets automáticos del Bot
    if (!isAdmin && t.channel === "Sistema Bot") return false;

    const okQ = !qs || (norm(t.ticket).includes(qs) || norm(t.customer || "").includes(qs));
    const okS = !st || t.status === st;
    return okQ && okS;
  });

  body.innerHTML = filtered.map(t => `
    <tr>
      <td>
        <b>${escapeHtml(t.ticket)}</b>
        ${t.channel === "Sistema Bot" ? '<span style="font-size:10px; background:#019DF4; color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">BOT</span>' : ''}
      </td>
      <td><span class="chip-status" data-s="${t.status}"><span class="dot"></span>${escapeHtml(t.status)}</span></td>
      <td>${escapeHtml(t.topic)}</td>
      <td>${escapeHtml(t.priority)}</td>
      <td>${escapeHtml(t.customer || "—")}</td>
      <td>${escapeHtml(t.channel)}</td>
      <td>${escapeHtml(fmtDate(t.created_at))}</td>
      <td style="text-align:right;">
        <button class="btn" onclick="openTicketDetail('${t.id}')" type="button">Ver Detalle</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="8" style="text-align:center; padding:20px; color:rgba(255,255,255,0.5);">No hay tickets disponibles.</td></tr>`;
}

function openTicketDetail(id){
  const list = getSupportTickets();
  const t = list.find(x => x.id === id);
  if (!t) return;
  currentTicketId = id;
  if (ticketDetailBackdrop) ticketDetailBackdrop.style.display = "grid";
  if (ticketDetailTitle) ticketDetailTitle.textContent = `Ticket • ${t.ticket}`;
  if (ticketDetailStatus) ticketDetailStatus.value = t.status;
  if (ticketDetailData){
    ticketDetailData.innerHTML = `<b>Ticket:</b> ${escapeHtml(t.ticket)}<br><b>Estado:</b> ${escapeHtml(t.status)}<br><b>Tema:</b> ${escapeHtml(t.topic)}<br><b>Prioridad:</b> ${escapeHtml(t.priority)}<br><b>Cliente:</b> ${escapeHtml(t.customer || "—")}<br><b>Resumen:</b> ${escapeHtml(t.summary)}<br><b>Fecha:</b> ${escapeHtml(fmtDate(t.created_at))}`;
  }
  if (ticketDetailChat){
    ticketDetailChat.innerHTML = (t.chat || []).map(m => `<div style="margin-bottom:10px;"><div><b>${m.from === "me" ? "Cliente" : "Soporte"}</b>: ${escapeHtml(m.text)}</div><div style="opacity:.65;font-size:12px;margin-top:2px;">${escapeHtml(fmtDate(m.at))}</div></div>`).join("") || "—";
  }
}
function closeTicketDetail(){ if (ticketDetailBackdrop) ticketDetailBackdrop.style.display = "none"; currentTicketId = null; }
btnCloseTicketDetail?.addEventListener("click", closeTicketDetail);
ticketDetailBackdrop?.addEventListener("click", (e) => { if (e.target === ticketDetailBackdrop) closeTicketDetail(); });

btnSaveTicketStatus?.addEventListener("click", async () => {
  if (!currentTicketId) return;
  const list = getSupportTickets();
  const idx = list.findIndex(t => t.id === currentTicketId);
  if (idx < 0) return;

  const newStatus = ticketDetailStatus?.value || "Nuevo";
  list[idx].status = newStatus;
  list[idx].chat.push({ from:"bot", text:`Estado actualizado a: ${newStatus}`, at: nowISO() });
  setSupportTickets(list);
  
  if (supabaseClient) {
      await supabaseClient.from('tickets').update({ estado: newStatus, chat: list[idx].chat }).eq('id', currentTicketId);
  }

  toast("Ticket", `Estado: ${list[idx].ticket} → ${newStatus}`);
  renderTicketsTable();
  openTicketDetail(currentTicketId);
});

// ===================== KPI UPDATES =====================
const kpiTickets = $("kpiTickets");
const kpiVentas = $("kpiVentas");
const kpiPendientes = $("kpiPendientes");

function easeOutBack(t){ const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

function animateCounter(el, from, to, duration, formatFn){
  const start = performance.now();
  const diff = to - from;
  function step(now){
    const p = Math.min(1, (now - start) / duration);
    const v = from + diff * easeOutBack(p);
    el.textContent = formatFn(Math.round(v));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function setKpiAnimated(el, value, formatFn = (n) => String(n), duration = 520){
  if (!el) return;
  const prev = Number(el.dataset.value ?? "0");
  const next = Number(value ?? 0);
  if (prev === next){ el.textContent = formatFn(next); el.dataset.value = String(next); return; }
  el.dataset.value = String(next);
  if (next > prev){ el.classList.add("kpi-up"); setTimeout(() => el.classList.remove("kpi-up"), 600); }
  animateCounter(el, prev, next, duration, formatFn);
}

function updateKpis(){
  const allSales = getSales();
  const u = getAuthedUser();
  if(!u) return;

  const isAdmin = (u?.rol === "Admin" || u?.rol === "BackOffice" || u?.user === "admin");
  const mySales = isAdmin ? allSales : allSales.filter(s => s.vendedor_id === u.user);

  const total = mySales.length;
  const instaladas = mySales.filter(s => (s.estado || "").toLowerCase() === "exitosa").length;
  const pendientes = mySales.filter(s => ["pendiente", "validación", "validacion"].includes((s.estado || "").toLowerCase())).length;

  setKpiAnimated(document.querySelector("#cardInstaladas .kpi-value"), instaladas, (n) => moneyCLP(n));
  setKpiAnimated(kpiVentas, total, (n) => String(n));
  setKpiAnimated(kpiPendientes, pendientes, (n) => String(n));

  const tickets = getSupportTickets();
  const nuevos = tickets.filter(t => t.status === "Nuevo").length;
  setKpiAnimated(kpiTickets, nuevos, (n) => String(n));

  const currentYear = new Date().getFullYear();
  let counts = [0, 0, 0, 0, 0, 0]; 
  mySales.forEach(sale => {
    const saleDate = new Date(sale.at);
    const month = saleDate.getMonth();
    if (saleDate.getFullYear() === currentYear && month <= 5) counts[month]++;
  });

  if (typeof ApexCharts !== 'undefined') renderApexChart(counts);
}

let apexChartInstance = null;
function renderApexChart(counts) {
  if (apexChartInstance) { apexChartInstance.updateSeries([{ data: counts }]); return; }
  const options = {
    chart: { type: 'bar', height: 320, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit', animations: { enabled: true, easing: 'easeinout', speed: 800 } },
    series: [{ name: 'Ventas Instaladas', data: counts }],
    xaxis: { categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'], labels: { style: { colors: '#9CA3AF', fontWeight: 600 } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: '#9CA3AF', fontWeight: 600 } } },
    grid: { borderColor: 'rgba(150, 150, 150, 0.15)', strokeDashArray: 4, yaxis: { lines: { show: true } } },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '45%', dataLabels: { position: 'top' } } },
    colors: ['#019DF4'],
    dataLabels: { enabled: true, formatter: function (val) { return val > 0 ? val : ""; }, offsetY: -20, style: { fontSize: '13px', colors: ['#9CA3AF'] } },
    tooltip: { theme: 'dark', y: { formatter: function (val) { return val + " ventas registradas" } } }
  };
  const chartBox = document.querySelector("#salesChart");
  if (chartBox) { apexChartInstance = new ApexCharts(chartBox, options); apexChartInstance.render(); }
}

function updateBadgeCounts(){
  if (!chatBadge) return;
  const panelOpen = supportPanel?.style.display === "flex";
  if (panelOpen){ chatBadge.style.display = "none"; return; }
  const active = getActiveTicketId();
  if (!active){ chatBadge.style.display = "none"; return; }

  const list = getSupportTickets();
  const t = list.find(x => x.id === active);
  const count = t ? (t.chat || []).length : 0;

  if (count > 2){ chatBadge.textContent = "1"; chatBadge.style.display = "grid"; } 
  else { chatBadge.style.display = "none"; }
}

// ===================== EXTRAS (NAVEGACIÓN, SWIPE, VALIDACIONES) =====================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape"){
    toggleModal(false); if(typeof closeVentaModal === 'function') closeVentaModal();
    if(typeof closeSaleDetail === 'function') closeSaleDetail(); closeTicketDetail(); closeSupportPanel(); closeIntake(); setUserMenu(false);
  }
});

document.addEventListener('click', function(e) {
  if (e.target.closest('#btnTopRegistrarVenta') || e.target.closest('#btnVentasRegistrar') || e.target.closest('#btnRegistrarVentaMovil')) {
    e.preventDefault();
    const modalFact = document.getElementById("modalBackdrop");
    if (modalFact) modalFact.style.display = "none";
    const modalVent = document.getElementById("ventaBackdrop");
    if (modalVent) modalVent.style.display = "grid";
  }
});

let touchStartX = 0; let touchEndX = 0;
document.addEventListener('touchstart', e => {
  const card = e.target.closest('.sale-card'); if (!card) return;
  touchStartX = e.changedTouches[0].screenX;
}, {passive: true});
document.addEventListener('touchend', e => {
  const card = e.target.closest('.sale-card'); if (!card) return;
  touchEndX = e.changedTouches[0].screenX;
  if (touchStartX - touchEndX > 60) {
    const rutElement = card.querySelector('.sc-rut') || card.querySelector('.sc-rut-pro');
    if (rutElement) {
      const rutText = rutElement.textContent.replace(/[^0-9kK-]/gi, '').trim();
      navigator.clipboard.writeText(rutText);
      card.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      card.style.transform = "translateX(-15px)";
      setTimeout(() => card.style.transform = "translateX(0)", 200);
      toast("Atajo rápido 📱", `RUT copiado: ${rutText}`);
      if (window.navigator.vibrate) window.navigator.vibrate(50); 
    }
  }
}, {passive: true});

// Validaciones RUT y Teléfono Generales
const inputsRut = [document.getElementById("rutInput"), document.getElementById("rut"), document.getElementById("regRut")];
inputsRut.forEach(input => {
  input?.addEventListener("input", (e) => {
    let valor = e.target.value.replace(/[^0-9kK]/g, "").slice(0, 9);
    if (valor.length > 1) {
      const cuerpo = valor.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      const dv = valor.slice(-1).toUpperCase();
      e.target.value = `${cuerpo}-${dv}`;
    } else { e.target.value = valor; }
  });
});

const inputVentaTel = document.getElementById("telefono");
inputVentaTel?.addEventListener("input", (e) => {
  let valor = e.target.value.replace(/\D/g, ""); 
  if (valor.startsWith("569")) valor = valor.substring(3); else if (valor.startsWith("9")) valor = valor.substring(1);
  valor = valor.substring(0, 8); 
  e.target.value = valor.length > 4 ? `+56 9 ${valor.substring(0,4)} ${valor.substring(4)}` : (valor.length > 0 ? `+56 9 ${valor}` : "");
});

const selectRegCountry = document.getElementById("regCountry");
const selectRegPhoneCode = document.getElementById("regPhoneCode");
selectRegCountry?.addEventListener("change", (e) => {
  const iso = e.target.options[e.target.selectedIndex].dataset.iso;
  document.getElementById("iconRegCountry").className = `fi fi-${iso}`;
  if (selectRegPhoneCode) {
    for (let i = 0; i < selectRegPhoneCode.options.length; i++) {
      if (selectRegPhoneCode.options[i].dataset.iso === iso) {
        selectRegPhoneCode.selectedIndex = i;
        document.getElementById("iconRegPhone").className = `fi fi-${iso}`;
        break;
      }
    }
  }
});
selectRegPhoneCode?.addEventListener("change", (e) => {
  const iso = e.target.options[e.target.selectedIndex].dataset.iso;
  document.getElementById("iconRegPhone").className = `fi fi-${iso}`;
});

document.getElementById("regPhoneNum")?.addEventListener("input", (e) => {
  let valor = e.target.value.replace(/\D/g, ""); 
  if (selectRegPhoneCode?.value === "+56") {
    if (valor.startsWith("9")) valor = valor.substring(1);
    valor = valor.substring(0, 8); 
    e.target.value = valor.length > 4 ? `9 ${valor.substring(0,4)} ${valor.substring(4)}` : (valor.length > 0 ? `9 ${valor}` : "");
  } else { e.target.value = valor; }
});

// Cascada Comunas para Ventas
const ventaRegion = $("ventaRegion"); const ventaComuna = $("ventaComuna"); const ventaDireccion = $("ventaDireccion"); const listaCallesVenta = $("listaCallesVenta");
if(ventaRegion && typeof regionesData !== 'undefined') {
  Object.keys(regionesData).forEach(region => {
    const opt = document.createElement("option"); opt.value = region; opt.textContent = region; ventaRegion.appendChild(opt);
  });
}
ventaRegion?.addEventListener("change", () => {
  ventaComuna.innerHTML = '<option value="">Seleccione Comuna</option>'; 
  if (ventaRegion.value && typeof regionesData !== 'undefined') {
    ventaComuna.disabled = false;
    regionesData[ventaRegion.value].forEach(comuna => {
      const opt = document.createElement("option"); opt.value = comuna; opt.textContent = comuna; ventaComuna.appendChild(opt);
    });
  } else { ventaComuna.disabled = true; ventaDireccion.disabled = true; ventaDireccion.value = ""; }
});
ventaComuna?.addEventListener("change", () => { ventaDireccion.disabled = !ventaComuna.value; if(!ventaComuna.value) ventaDireccion.value = ""; });

let timerVentaBusqueda;
ventaDireccion?.addEventListener("input", (e) => {
  const comunaActual = ventaComuna.value; const texto = e.target.value;
  if (!comunaActual || texto.length < 3) return;
  clearTimeout(timerVentaBusqueda);
  timerVentaBusqueda = setTimeout(async () => {
    try {
      const res = await fetch(`http://localhost:8000/buscar_calles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comuna: comunaActual, calle_parcial: texto }) });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        listaCallesVenta.innerHTML = ""; 
        json.data.map(item => item.streetName || item.description || item).filter(Boolean).forEach(calle => {
          const option = document.createElement("option"); option.value = calle; listaCallesVenta.appendChild(option);
        });
      }
    } catch (error) { console.error("Error buscando calles:", error); }
  }, 400);
});

// Navegación rápida KPIs
document.getElementById("cardInstaladas")?.addEventListener("click", () => { const f = $("cartStatusFilter"); if (f) f.value = "Exitosa"; goCart(); });
document.getElementById("cardTickets")?.addEventListener("click", () => { const f = $("tkStatusFilter"); if (f) f.value = "Nuevo"; goSupport(); });
document.getElementById("cardVentasTotales")?.addEventListener("click", () => { const f = $("cartStatusFilter"); if (f) f.value = ""; goCart(); });
document.getElementById("cardPendientes")?.addEventListener("click", () => { const f = $("cartStatusFilter"); if (f) f.value = "Pendiente"; goCart(); });
document.getElementById("cardReagendadas")?.addEventListener("click", () => { const f = $("cartStatusFilter"); if (f) f.value = ""; goCart(); });

// ===================== DETECTOR DE RED (MODO OFFLINE / CALLE) =====================
const offlineBanner = document.getElementById("offlineBanner");
function updateNetworkStatus() {
  if (navigator.onLine) {
    offlineBanner?.classList.remove("show"); document.body.classList.remove("is-offline");
    if (window.wasOffline) { toast("Conexión restaurada 🌐", "Ya puedes consultar factibilidad nuevamente.", 3500); window.wasOffline = false; }
  } else {
    offlineBanner?.classList.add("show");
    if (offlineBanner) offlineBanner.style.transform = "translateY(0)";
    document.body.classList.add("is-offline"); window.wasOffline = true;
  }
}
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
updateNetworkStatus();

// ===================== REALTIME SUPABASE =====================
function iniciarSuscripcionRealtime() {
  if (!supabaseClient) return;
  supabaseClient.channel('cambios-ventas')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ventas' }, (payload) => {
        const u = getAuthedUser(); if (!u) return;
        const v = payload.new;
        if (v.vendedor_id === u.user) {
          toast("¡Actualización de Venta! 🔔", `Tu venta ${v.code} pasó a estado: ${v.estado}`, 6000);
          addAviso(`Estado actualizado: ${v.code}`, `La auditoría marcó tu venta como ${v.estado}`);
          const badge = $("avisosBadge"); if (badge) badge.style.display = "grid";
          sincronizarDesdeNube();
        }
      }
    ).subscribe();
}
$("btnTopAvisos")?.addEventListener("click", () => { const badge = $("avisosBadge"); if (badge) badge.style.display = "none"; });

// ===================== ACADEMIA =====================
const academiaCursos = [
  { id: "M1", titulo: "Revisar Factibilidad", tag: "SISTEMAS", emoji: "🔍", link: "#" },
  { id: "M2", titulo: "Ingreso Venta Fija", tag: "VENTAS", emoji: "🏠", link: "#" },
  { id: "M3", titulo: "Ciclo de Facturación", tag: "CLIENTES", emoji: "💳", link: "#" },
  { id: "M4", titulo: "Link Reagendas", tag: "OPERACIONES", emoji: "📅", link: "#" },
  { id: "M5", titulo: "Planes Actuales", tag: "PROMO", emoji: "🔥", link: "#" },
  { id: "M6", titulo: "Promocion Destacada", tag: "DESTACADO", emoji: "🌟", link: "#" }
];
function renderCapacitaciones() {
  const grid = $("capGrid"); if (!grid) return;
  grid.innerHTML = academiaCursos.map(c => `
    <article class="cap-card" onclick="if('${c.link}' !== '#') window.open('${c.link}', '_blank'); else toast('Próximamente', 'Cargando este manual... ⏳');">
      <div class="cap-thumb">${c.emoji}<span class="cap-badge-netflix">${c.tag}</span></div>
      <div class="cap-info-netflix">
        <div class="cap-title-netflix">${c.titulo}</div>
        <button class="cap-btn-netflix"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 22v-20l18 10-18 10z"/></svg> Ver Ahora</button>
      </div>
    </article>
  `).join("");
}

// ===================== INIT =====================
function showSkeleton(containerId, count = 3) {
  const container = $(containerId); if (!container) return;
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `<div class="skeleton-card"><div class="sk-head"><div class="skeleton-anim sk-line"></div><div class="skeleton-anim sk-line short"></div></div><div class="sk-body"><div style="display:flex; flex-direction:column; gap:12px;"><div class="skeleton-anim sk-line" style="width:30%; height:20px; border-radius:10px;"></div><div class="skeleton-anim sk-line long"></div><div class="skeleton-anim sk-line long" style="width:50%;"></div></div><div class="skeleton-anim sk-box"></div></div></div>`;
  }
  container.innerHTML = html;
}

async function sincronizarDesdeNube() {
  if (!supabaseClient) return; 
  showSkeleton("cartBody", 3); showSkeleton("adminSalesBody", 3);
  try {
    const { data, error } = await supabaseClient.from('ventas').select('*').order('at', { ascending: false }); 
    if (error) throw error;
    setSales(data || []); 
    updateKpis();
    if(typeof renderCart === 'function') renderCart();
    if (typeof renderAdminPanel === "function") renderAdminPanel();
  } catch (err) {
    console.warn("Fallo nube:", err);
    if(typeof renderCart === 'function') renderCart();
  }
}

async function cargarTicketsNube() {
  if (!supabaseClient) return;
  const u = getAuthedUser(); if (!u) return;
  try {
    let query = supabaseClient.from('tickets').select('*').order('created_at', { ascending: false });
    if (u.user !== "admin") query = query.eq('creado_por', u.user);
    const { data, error } = await query;
    if (error) throw error;
    const tf = data.map(t => ({ id: t.id, ticket: t.codigo, status: t.estado, topic: t.tema, priority: t.prioridad, channel: t.canal, created_at: t.created_at, customer: t.creado_por_nombre, summary: t.resumen, chat: t.chat || [], attachments: t.adjuntos || [] }));
    setSupportTickets(tf);
    renderTicketsTable();
    if (getActiveTicketId()) renderSupportChat();
    updateBadgeCounts();
  } catch (err) { console.error("Error tickets:", err); }
}

function initThemeFromStorage(){ const mode = getThemeMode(); if (mode === "system") setThemeMode("system"); else setManualDark(getManualDark()); }

function init(){
  initThemeFromStorage();
  if(typeof startIntro === 'function') startIntro();
  
  if (isAuthed()){
    document.body.classList.add("auth-ready");
    const lb = document.getElementById("loginBackdrop");
    if (lb) lb.style.display = "none";
    const sp = document.getElementById("splash");
    if (sp) sp.style.display = "none";
    
    sincronizarDesdeNube();
    cargarTicketsNube();
    setTimeout(iniciarSuscripcionRealtime, 2000);
  }

  if(typeof fillProfileHeader === 'function') fillProfileHeader();
  if(typeof goDashboard === 'function') goDashboard();
  if(typeof renderCart === 'function') renderCart();
  renderDocs();
  renderAvisos();
  renderTicketsTable();
  updateKpis();
  updateBadgeCounts();
}

// Iniciar aplicación
init();