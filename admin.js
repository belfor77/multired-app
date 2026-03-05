// ===================== PANEL DE SUPERVISOR (ADMIN) =====================

// 1. Abrir el panel desde el botón secreto
$("btnAdminPanelVentas")?.addEventListener("click", () => {
  showView("viewAdminPanel");
  loadAdminSellers();
  renderAdminPanel();
});

// 2. Volver al menú
$("btnBackFromAdmin")?.addEventListener("click", goVentasMenu);

// 3. Escuchar cuando el admin elige un vendedor distinto
const adminSellerSelect = $("adminSellerSelect");
let adminRenderLimit = 20; // 🚀 LÍMITE DE CARGA INICIAL ADMIN

adminSellerSelect?.addEventListener("change", () => {
  adminRenderLimit = 20; // Reset al cambiar vendedor
  renderAdminPanel();
});
$("btnAdminRefresh")?.addEventListener("click", async () => {
  toast("Actualizando...", "Descargando ventas de ejecutivos ☁️");
  await sincronizarDesdeNube();
  adminRenderLimit = 20;
  renderAdminPanel();
});
// 4. Cargar la lista de vendedores automáticamente
function loadAdminSellers() {
  if (!adminSellerSelect) return;
  const sales = getSales();
  
  // Extraemos todos los IDs de vendedores únicos que tengan ventas
  const sellers = [...new Set(sales.map(s => s.vendedor_id).filter(Boolean))];
  
  const currentVal = adminSellerSelect.value;
  adminSellerSelect.innerHTML = '<option value="">Todos los ejecutivos</option>';
  
  sellers.forEach(vId => {
    // Buscar su nombre real en la lista de usuarios, o usar el ID
    const users = getUsers();
    const u = users.find(x => x.user === vId);
    const nombre = u ? u.name : vId;
    
    const opt = document.createElement("option");
    opt.value = vId;
    opt.textContent = `${nombre} (Usuario: ${vId})`;
    adminSellerSelect.appendChild(opt);
  });
  
  adminSellerSelect.value = currentVal; // Mantiene la selección si ya había una
}

// 5. Renderizar los datos y las tarjetas
function renderAdminPanel() {
  const adminSalesBody = $("adminSalesBody");
  if (!adminSalesBody) return;
  
  const selectedSeller = adminSellerSelect?.value || "";
  let allSales = getSales();
  
  // Si eligió a un vendedor en específico, filtramos todo
  if (selectedSeller) {
    allSales = allSales.filter(s => s.vendedor_id === selectedSeller);
  }
  
  // Actualizar los recuadros de arriba (Mini KPIs)
  const exitosas = allSales.filter(s => (s.estado||"").toLowerCase() === "exitosa").length;
  const pendientes = allSales.filter(s => (s.estado||"").toLowerCase() === "pendiente").length;
  const rechazadas = allSales.filter(s => (s.estado||"").toLowerCase() === "rechazada").length;
  
  if ($("admKpiTotal")) $("admKpiTotal").textContent = allSales.length;
  if ($("admKpiExitosas")) $("admKpiExitosas").textContent = exitosas;
  if ($("admKpiPendientes")) $("admKpiPendientes").textContent = pendientes;
  if ($("admKpiRechazadas")) $("admKpiRechazadas").textContent = rechazadas;

  // Funciones visuales (Reusadas para que se vea igual de profesional)
  const getBorderClass = (st) => {
    const s = (st || "").toLowerCase();
    if(s === "pendiente") return "border-pendiente";
    if(s === "validación" || s === "validacion") return "border-validacion";
    if(s === "instalación" || s === "instalacion") return "border-instalacion";
    if(s === "exitosa") return "border-exitosa";
    if(s === "rechazada") return "border-rechazada";
    return "border-pendiente";
  };
  const getStatusBadge = (st) => {
    const s = (st || "").toLowerCase();
    if(s === "pendiente") return "sc-badge pendiente";
    if(s === "validación" || s === "validacion") return "sc-badge validacion";
    if(s === "instalación" || s === "instalacion") return "sc-badge instalacion";
    if(s === "exitosa") return "sc-badge exitosa";
    if(s === "rechazada") return "sc-badge rechazada";
    return "sc-badge pendiente";
  };

  // 🚀 APLICAMOS EL CORTE ANTI-COLAPSO EN ADMIN 🚀
  const toRender = allSales.slice(0, adminRenderLimit);

  // Dibujar las tarjetas
  adminSalesBody.innerHTML = toRender.map(s => `
    <div class="sale-card ${getBorderClass(s.estado)}">
      <div class="sc-head-pro">
        <div class="sc-rut-pro">
          <span style="color:#facc15; font-size:12px; border: 1px solid #facc15; padding: 2px 6px; border-radius:4px; margin-right: 6px;">Vendedor: ${escapeHtml(s.vendedor_nombre || s.vendedor_id || "Desconocido")}</span>
          ${escapeHtml(s.rut || "Sin RUT")}
        </div>
        <div class="sc-date-pro">📅 ${escapeHtml(fmtDate(s.at))}</div>
      </div>
     <div class="sc-body-pro">
        <div class="sc-info-left">
          <div class="sc-row-id">
            <span class="sc-id-text"># ${escapeHtml(s.code)}</span>
            ${s.numero_orden ? `<span style="color: #facc15; font-size: 13px; font-weight: 800; margin-left: 8px;">📄 Orden: ${escapeHtml(s.numero_orden)}</span>` : ''}
          </div>
          <div><span class="${getStatusBadge(s.estado)}">${escapeHtml(s.estado || "Pendiente")}</span></div>
          <div class="sc-address-box">
            <div>
              <b style="color: var(--text-main);">${escapeHtml(s.comuna || "Sin comuna")}</b><br>
              ${escapeHtml(s.direccion || "Sin dirección")}
            </div>
          </div>
        </div>
        <div class="sc-agenda-right" style="background: transparent; border-left: 1px dashed var(--border-light); justify-content: center; align-items: center; padding: 15px;">
          ${renderMiniTimeline(s.estado)}
        </div>
      </div>
      <div class="sc-foot-pro">
        <div class="sc-client-name">👤 Cliente: ${escapeHtml(s.nombre || "Sin Nombre")}</div>
        <button class="btn-action secondary" style="font-size: 12px; padding: 6px 14px;" data-sale-open="${escapeHtml(s.id)}" type="button">Ver Detalle / Cambiar Estado</button>
      </div>
    </div>
  `).join("") || `
    <div style="text-align: center; padding: 40px; color: rgba(255,255,255,.6);">
      No hay ventas para mostrar en este filtro.
    </div>
  `;

  // Reconectar los botones de detalle para que el Admin pueda intervenir la venta
  adminSalesBody.querySelectorAll("[data-sale-open]").forEach(btn => {
    btn.addEventListener("click", () => openSaleDetail(btn.getAttribute("data-sale-open")));
  });

  // 🚀 BOTÓN DE CARGAR MÁS EN ADMIN 🚀
  if (adminRenderLimit < allSales.length) {
    const btnLoadMore = document.createElement("button");
    btnLoadMore.className = "btn-action secondary";
    btnLoadMore.style.width = "100%";
    btnLoadMore.style.justifyContent = "center";
    btnLoadMore.style.marginTop = "10px";
    btnLoadMore.style.padding = "12px";
    btnLoadMore.innerHTML = `⬇️ Cargar más ventas (${allSales.length - adminRenderLimit} ocultas)`;
    btnLoadMore.onclick = () => {
      adminRenderLimit += 20;
      renderAdminPanel();
    };
    adminSalesBody.appendChild(btnLoadMore);
  }
}

// ===================== CARGA MASIVA DE ESTADOS DESDE EXCEL =====================

// Detectar cuando se elige un archivo para cambiar el texto visual
$("fileCargaMasiva")?.addEventListener("change", (e) => {
  const fileNameDisplay = $("fileNameDisplay");
  if (fileNameDisplay) {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = e.target.files[0].name;
      fileNameDisplay.style.color = "#4ade80"; // Se pone verde al elegir archivo
    } else {
      fileNameDisplay.textContent = "Ningún archivo";
      fileNameDisplay.style.color = "var(--text-muted)";
    }
  }
});

$("btnCargaMasiva")?.addEventListener("click", async () => {
  const fileInput = $("fileCargaMasiva");
  const file = fileInput?.files[0];
  
  if (!file) {
    toast("Atención", "Debes seleccionar un archivo Excel (.xlsx) o CSV primero.");
    return;
  }

  const btn = $("btnCargaMasiva");
  btn.disabled = true;
  btn.textContent = "Procesando... ⏳";
  toast("Leyendo archivo", "No cierres la ventana.", 3000);

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {defval: ""}); // Convierte a objetos JS

      if (rows.length === 0) {
        toast("Error", "El archivo está vacío o no tiene el formato correcto.");
        btn.disabled = false; btn.textContent = "Procesar Archivo"; return;
      }

      let allSales = getSales();
      let updatedCount = 0;

      // Recorremos fila por fila del Excel
      for (let row of rows) {
        // Aseguramos leer correctamente las columnas "ORDEN" y "ESTADO" (quitando espacios extra)
        const ordenExcel = String(row["ORDEN"] || "").trim();
        const estadoExcel = String(row["ESTADO"] || "").trim().toUpperCase();

        if (!ordenExcel) continue;

        // Buscamos si tenemos una venta guardada con ese Número de Orden
        const saleIndex = allSales.findIndex(s => s.numero_orden === ordenExcel);
        
        if (saleIndex >= 0) {
          let nuevoEstadoApp = allSales[saleIndex].estado;

          // Traductor Inteligente de Estados (De Movistar a tu App)
          if (estadoExcel === "PENDIENTE" || estadoExcel === "EN PROCESO") nuevoEstadoApp = "Instalación";
          if (estadoExcel === "TERMINADA" || estadoExcel === "ACTIVA") nuevoEstadoApp = "Exitosa";
          if (estadoExcel === "BAJA" || estadoExcel === "CANCELADA" || estadoExcel === "RECHAZADA") nuevoEstadoApp = "Rechazada";

          // Si el estado es diferente al que ya teníamos, lo actualizamos
          if (allSales[saleIndex].estado !== nuevoEstadoApp) {
            allSales[saleIndex].estado = nuevoEstadoApp;
            allSales[saleIndex].log = allSales[saleIndex].log || [];
            allSales[saleIndex].log.push({
              action: `Actualización masiva: ${nuevoEstadoApp} (Detectado en Excel como: ${estadoExcel})`,
              by: getAuthedUser()?.name || "Robot Sistema",
              at: nowISO()
            });

            // Subir la actualización individual a Supabase
            if (supabaseClient) {
              await supabaseClient
                .from('ventas')
                .update({ estado: nuevoEstadoApp, log: allSales[saleIndex].log })
                .eq('numero_orden', ordenExcel);
            }
            updatedCount++;
          }
        }
      }

      // Refrescar vistas
      setSales(allSales);
      if (typeof renderAdminPanel === 'function') renderAdminPanel();
      if (typeof updateKpis === 'function') updateKpis();
      
      toast("¡Carga Exitosa! ✅", `Se actualizaron ${updatedCount} ventas automáticamente.`, 5000);
      fileInput.value = ""; // Limpia el input

    } catch (error) {
      console.error("Error procesando Excel:", error);
      toast("Error de lectura", "Hubo un problema leyendo el archivo. Verifica el formato.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Procesar Archivo";
    }
  };
  
  reader.readAsArrayBuffer(file);
});
// ===================== SISTEMA DE VERIFICACIÓN KYC (ADMIN) =====================

function switchAdminTab(tab) {
  const tabVentas = $("tabAdminVentas");
  const tabKyc = $("tabAdminKyc");
  const tabMapa = $("tabAdminMapa");
  
  const contentVentas = $("adminTabVentas");
  const contentKyc = $("adminTabKyc");
  const contentMapa = $("adminTabMapa");

  if (tabVentas) tabVentas.classList.remove("active");
  if (tabKyc) tabKyc.classList.remove("active");
  if (tabMapa) tabMapa.classList.remove("active");
  
  if (contentVentas) contentVentas.style.display = "none";
  if (contentKyc) contentKyc.style.display = "none";
  if (contentMapa) contentMapa.style.display = "none";

  if (tab === 'ventas') {
    if (tabVentas) tabVentas.classList.add("active");
    if (contentVentas) contentVentas.style.display = "block";
  } else if (tab === 'kyc') {
    if (tabKyc) tabKyc.classList.add("active");
    if (contentKyc) contentKyc.style.display = "block";
    renderPendingUsers(); 
  } else if (tab === 'mapa') {
    if (tabMapa) tabMapa.classList.add("active");
    if (contentMapa) contentMapa.style.display = "block";
    renderHeatmap(); 
  }
}

let adminMap = null;
let heatLayer = null;

const comunaCoords = {
  "SANTIAGO": [-33.4489, -70.6693],
  "PUENTE ALTO": [-33.6117, -70.5758],
  "MAIPU": [-33.5100, -70.7561],
  "LA FLORIDA": [-33.5228, -70.5983],
  "PROVIDENCIA": [-33.4314, -70.6093],
  "ÑUÑOA": [-33.4548, -70.5975],
  "LAS CONDES": [-33.4140, -70.5645],
  "QUILICURA": [-33.3643, -70.7350],
  "VALPARAISO": [-33.0456, -71.6197],
  "VINA DEL MAR": [-33.0245, -71.5518],
  "CONCEPCION": [-36.8201, -73.0444]
};

function renderHeatmap() {
  const mapContainer = $("salesMap");
  if (!mapContainer) return;

  if (!adminMap) {
    adminMap = L.map('salesMap').setView([-33.4489, -70.6693], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }).addTo(adminMap);
  }

  setTimeout(() => { adminMap.invalidateSize(); }, 300);

  const allSales = getSales();
  const validSales = allSales.filter(s => {
    const est = (s.estado || "").toLowerCase();
    return est === "exitosa" || est === "instalación" || est === "instalacion";
  });

  const heatData = validSales.map(s => {
    const com = (s.comuna || "").toUpperCase();
    const baseCoords = comunaCoords[com] || comunaCoords["SANTIAGO"];
    const lat = baseCoords[0] + (Math.random() - 0.5) * 0.04;
    const lon = baseCoords[1] + (Math.random() - 0.5) * 0.04;
    return [lat, lon, 1];
  });

  if (heatLayer) { adminMap.removeLayer(heatLayer); }

  if (typeof L.heatLayer !== 'undefined') {
    heatLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 20,
      maxZoom: 14,
      gradient: {
        0.4: '#38bdf8',
        0.6: '#22c55e',
        0.8: '#facc15',
        1.0: '#ef4444'
      }
    }).addTo(adminMap);
  }
}

async function renderPendingUsers() {
 const container = $("kycVerificationList");
  if (!container) return;
  showSkeleton("kycVerificationList", 2); // Muestra 2 tarjetas fantasma
  try {
    // Consultamos la tabla PROFILES donde guardaste a los usuarios
    const { data: pendientes, error } = await supabaseClient
      .from('usuarios')
      .select('*')
      .eq('estado_cuenta', 'Pendiente');

    if (error) throw error;

    if (!pendientes || pendientes.length === 0) {
      container.innerHTML = "<p style='width:100%; text-align:center; padding:20px; font-weight:bold; color:#22c55e;'>✅ No hay usuarios pendientes de aprobación.</p>";
      return;
    }

    // Armamos las tarjetas
    let html = "";
    for (const u of pendientes) {
      // SEGURIDAD: Generar "Llaves Temporales" (Signed URLs) válidas por 1 hora (3600 segundos)
      const { data: linkFrente } = await supabaseClient.storage.from('carnets').createSignedUrl(u.foto_carnet_frente, 3600);
      const { data: linkDorso } = await supabaseClient.storage.from('carnets').createSignedUrl(u.foto_carnet_dorso, 3600);
      
      const urlFrente = linkFrente ? linkFrente.signedUrl : "";
      const urlDorso = linkDorso ? linkDorso.signedUrl : "";
      html += `
        <div class="sale-card" style="border-left: 4px solid #facc15;">
          <div class="sc-head-pro">
            <div class="sc-client-name" style="font-size:16px; font-weight: 900; color: var(--text-main);">👤 ${escapeHtml(u.nombre)}</div>
            <div class="sc-date-pro" style="background: rgba(250,204,21,0.2); padding: 4px 8px; border-radius:4px; color:#facc15;">RUT: ${escapeHtml(u.rut)}</div>
          </div>
          <div class="sc-body-pro" style="display:flex; flex-direction: column; gap: 12px; padding: 16px;">
            <p style="font-size:13px; color:var(--text-muted); margin:0;">
              <b>Correo:</b> ${escapeHtml(u.correo)}<br>
              <b>Teléfono:</b> ${escapeHtml(u.telefono)}
            </p>
            
            <div style="display: flex; gap: 10px;">
              <div style="flex:1; text-align:center;">
                <span style="font-size:11px; color:var(--brand-blue); font-weight:bold;">CARNET FRENTE</span>
                <img src="${urlFrente}" style="width:100%; height: 120px; object-fit: cover; border-radius:8px; border: 1px solid var(--border-light); cursor:pointer; margin-top:4px;" onclick="window.open('${urlFrente}')" title="Clic para agrandar">
              </div>
              <div style="flex:1; text-align:center;">
                <span style="font-size:11px; color:var(--brand-blue); font-weight:bold;">CARNET DORSO</span>
                <img src="${urlDorso}" style="width:100%; height: 120px; object-fit: cover; border-radius:8px; border: 1px solid var(--border-light); cursor:pointer; margin-top:4px;" onclick="window.open('${urlDorso}')" title="Clic para agrandar">
              </div>
            </div>
          </div>
          <div class="sc-foot-pro" style="display:flex; gap:10px; padding: 12px 16px;">
            <button class="btn-action primary" style="flex:1; justify-content:center; background:#22c55e; border-color:#22c55e;" onclick="updateUserStatus('${u.id}', 'Aprobado')">✅ Aprobar</button>
            <button class="btn-action secondary" style="flex:1; justify-content:center; background:rgba(239,68,68,0.1); border-color:#ef4444; color:#ef4444;" onclick="updateUserStatus('${u.id}', 'Rechazado')">❌ Rechazar</button>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='width:100%; text-align:center;'>Error al cargar los usuarios. Verifica la consola.</p>";
  }
}

// Función global para actualizar el estado
window.updateUserStatus = async function(userId, nuevoEstado) {
  if (!confirm(`¿Estás seguro de marcar a este ejecutivo como ${nuevoEstado}?`)) return;

  try {
    const { error } = await supabaseClient
      .from('usuarios')
      .update({ estado_cuenta: nuevoEstado })
      .eq('id', userId);

    if (error) throw error;

    toast("Sistema", `Usuario ${nuevoEstado} exitosamente.`);
    renderPendingUsers(); // Refrescamos la lista automáticamente
  } catch (err) {
    toast("Error", "No se pudo actualizar el estado.");
    console.error(err);
  }
};