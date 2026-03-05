// ===================== MODAL VALIDADOR =====================
const modalBackdrop = $("modalBackdrop");
const btnValidator = $("btnValidator");
const btnCloseModal = $("btnCloseModal");

function toggleModal(show){
  if (!modalBackdrop) return;
  // Si vamos a abrir Factibilidad, nos aseguramos de cerrar Ventas primero
  if (show && $("ventaBackdrop")) $("ventaBackdrop").style.display = "none";
  
  modalBackdrop.style.display = show ? "grid" : "none";
}

btnValidator?.addEventListener("click", () => toggleModal(true));
btnFactibilidad?.addEventListener("click", () => toggleModal(true));
btnCloseModal?.addEventListener("click", () => toggleModal(false));
modalBackdrop?.addEventListener("click", (e) => { if (e.target === modalBackdrop) toggleModal(false); });

// tabs validador
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const isRut = tab.dataset.tab === "rut";
    $("tab-rut").style.display = isRut ? "block" : "none";
    $("tab-dir").style.display = isRut ? "none" : "block";
  });
});

// RUT check (DEMO)
const rutInput = $("rutInput");
const btnCheckRut = $("btnCheckRut");
const rutResult = $("rutResult");
const rutTitle = $("rutTitle");
const rutLines = $("rutLines");

function setRutResult(title, html){
  if (rutResult) rutResult.style.display = "block";
  if (rutTitle) rutTitle.textContent = title;
  if (rutLines) rutLines.innerHTML = html;
}

// === VALIDAR RUT (SISTEMA DE COLAS CON RESPUESTA EN VIVO) ===
btnCheckRut?.addEventListener("click", async () => {
  const rut = (rutInput?.value || "").trim();

  if ($("rutAcciones")) $("rutAcciones").style.display = "none";

  if (!rut){
    setRutResult("RUT requerido", "• Ingresa un RUT.");
    return;
  }
  if (!isRutFormatOK(rut) || !isRutDVOK(rut)){
    setRutResult("RUT inválido", "• Usa formato 12345678-9 y DV correcto.");
    return;
  }

  // 1. Mostrar estado inicial
  setRutResult("Conectando con el Robot...", "<div class='spinner'></div> Creando solicitud segura...");
  btnCheckRut.disabled = true;

  try {
    const u = getAuthedUser();
    if (!u) throw new Error("No estás autenticado");

    const codigoTicket = "FAC-" + Date.now().toString().slice(-6);
    const msjInicial = { 
      from: "me", 
      text: `🤖 Solicitud de factibilidad automática.\nPor favor revisar el RUT: ${rut}`, 
      at: nowISO() 
    };

    const nuevoTicket = {
      codigo: codigoTicket,
      estado: "Nuevo",
      tema: "Factibilidad",
      prioridad: "Alta",
      canal: "Sistema Bot",
      creado_por: u.user,
      creado_por_nombre: u.name,
      resumen: `Factibilidad RUT: ${rut}`,
      chat: [msjInicial]
    };

    if (!supabaseClient) throw new Error("Supabase no conectado");

    // 2. INSERTAR Y OBTENER EL ID DEL TICKET
    const { data: ticketData, error } = await supabaseClient.from('tickets').insert([nuevoTicket]).select().single();
    if (error) throw error;

    const ticketId = ticketData.id;

    setRutResult("¡Solicitud en Cola! ⏳", `
      • RUT a consultar: <b>${escapeHtml(rut)}</b><br>
      • <b>Estado:</b> <span style="color:#facc15;">Esperando turno... (El bot puede tardar entre 5 y 15 segundos)</span><br>
      <div class='spinner' style='margin-top: 10px;'></div>
    `);

    if (typeof cargarTicketsNube === "function") cargarTicketsNube();

    // 🚀 3. MAGIA: RADAR EN VIVO (ESPERAR RESPUESTA DEL ROBOT) 🚀
    let intentos = 0;
    let resuelto = false;

  // Se quedará mirando la base de datos súper rápido (cada 1 seg)
    while (intentos < 60) { 
      await new Promise(r => setTimeout(r, 1000)); // Escaneo ultra rápido
      intentos++;

      // Preguntar a Supabase: "¿Cómo va mi ticket?"
      const { data: checkData, error: checkErr } = await supabaseClient
        .from('tickets')
        .select('estado, chat')
        .eq('id', ticketId)
        .single();

      if (checkErr) continue;

      // Si el robot ya lo tomó:
      if (checkData.estado === "En proceso") {
         setRutResult("Robot trabajando... ⚙️", `
          • RUT a consultar: <b>${escapeHtml(rut)}</b><br>
          • <b>Estado:</b> <span style="color:#38bdf8;">Extrayendo datos desde Movistar...</span><br>
          <div class='spinner' style='margin-top: 10px; border-top-color: #38bdf8;'></div>
        `);
      }
      // Si el robot ya terminó:
      else if (checkData.estado === "Resuelto" || checkData.estado === "Cerrado") {
        
        // Extraer el último mensaje que dejó el robot
        const chatArray = checkData.chat || [];
        const ultimoMsj = chatArray[chatArray.length - 1];
        let respuestaBot = ultimoMsj ? ultimoMsj.text : "Sin respuesta detallada.";

        // Convertir los saltos de línea (\n) en HTML (<br>)
        respuestaBot = respuestaBot.replace(/\n/g, "<br>");

        // DIBUJAR EL RESULTADO FINAL EN PANTALLA
        setRutResult("✅ Factibilidad Completada", `
          <div style="background: rgba(34, 197, 94, 0.05); padding: 14px; border-radius: 8px; border: 1px dashed #22c55e;">
            ${respuestaBot}
          </div>
        `);

        // Mostrar los botones (Nueva Consulta, Finalizar, etc.)
        if ($("rutAcciones")) $("rutAcciones").style.display = "flex";

        resuelto = true;
        break; // Romper el ciclo, ya terminamos.
      }
    }

    // Si pasaron 60 segundos y el robot no respondió (quizás está apagado)
    if (!resuelto) {
       setRutResult("⏳ Tiempo de espera agotado", `
          • El robot está tardando más de lo normal o está apagado.<br>
          • Tu solicitud sigue en la fila. Podrás ver la respuesta más tarde en la pestaña de <b>Soporte</b>.
        `);
    }

  } catch (err) {
    console.error("Error al encolar factibilidad:", err);
    const errorReal = err.message || err.details || "Error desconocido";
    setRutResult("Error en Supabase ☁️", `
      • No se pudo encolar el ticket.<br>
      • <b>Motivo:</b> <span style="color:#ef4444;">${errorReal}</span>
    `);
  } finally {
    btnCheckRut.disabled = false;
  }
});

// === LÓGICA DE BOTONES POST-CONSULTA ===
const rutAcciones = $("rutAcciones");
const btnAccionNueva = $("btnAccionNueva");
const btnAccionFinalizar = $("btnAccionFinalizar");
const btnAccionTicket = $("btnAccionTicket");

async function llamarReinicioAPI() {
  try { await fetch("http://localhost:8000/reiniciar", { method: "POST" }); } 
  catch(e) { console.error("Error al reiniciar la API"); }
}

function limpiarValidador() {
  if ($("rutInput")) $("rutInput").value = "";
  if ($("rutResult")) $("rutResult").style.display = "none";
  if (rutAcciones) rutAcciones.style.display = "none";
}

btnAccionNueva?.addEventListener("click", async () => {
  limpiarValidador();
  toast("Reiniciando...", "Preparando sistema para un nuevo RUT");
  await llamarReinicioAPI(); 
});

btnAccionFinalizar?.addEventListener("click", async () => {
  limpiarValidador();
  toggleModal(false); 
  await llamarReinicioAPI(); 
});

btnAccionTicket?.addEventListener("click", () => {
  toast("Ticket OK", "Consulta finalizada con éxito");
  btnAccionFinalizar?.click(); 
});

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

// ===================== DIRECCIÓN EN CASCADA Y API =====================
const dirRegion = $("dirRegion");
const dirComuna = $("dirComuna");
const dirCalle = $("dirCalle");
const dirNumero = $("dirNumero");
const dirDepto = $("dirDepto");
const btnCheckDir = $("btnCheckDir");

// Base de datos Completa de Regiones y Comunas de Chile
const regionesData = {
  "ARICA Y PARINACOTA": ["ARICA", "CAMARONES", "PUTRE", "GENERAL LAGOS"],
  "TARAPACA": ["IQUIQUE", "ALTO HOSPICIO", "POZO ALMONTE", "CAMINA", "COLCHANE", "HUARA", "PICA"],
  "ANTOFAGASTA": ["ANTOFAGASTA", "MEJILLONES", "SIERRA GORDA", "TALTAL", "CALAMA", "OLLAGUE", "SAN PEDRO DE ATACAMA", "TOCOPILLA", "MARIA ELENA"],
  "ATACAMA": ["COPIAPO", "CALDERA", "TIERRA AMARILLA", "CHANARAL", "DIEGO DE ALMAGRO", "VALLENAR", "ALTO DEL CARMEN", "FREIRINA", "HUASCO"],
  "COQUIMBO": ["LA SERENA", "COQUIMBO", "ANDACOLLO", "LA HIGUERA", "PAIHUANO", "VICUNA", "ILLAPEL", "CANELA", "LOS VILOS", "SALAMANCA", "OVALLE", "COMBARBALA", "MONTE PATRIA", "PUNITAQUI", "RIO HURTADO"],
  "VALPARAISO": ["VALPARAISO", "CASABLANCA", "CONCON", "JUAN FERNANDEZ", "PUCHUNCAVI", "QUINTERO", "VINA DEL MAR", "ISLA DE PASCUA", "LOS ANDES", "CALLE LARGA", "RINCONADA", "SAN ESTEBAN", "LA LIGUA", "CABILDO", "PAPUDO", "PETORCA", "ZAPALLAR", "QUILLOTA", "CALERA", "HIJUELAS", "LA CRUZ", "NOGALES", "SAN ANTONIO", "ALGARROBO", "CARTAGENA", "EL QUISCO", "EL TABO", "SANTO DOMINGO", "SAN FELIPE", "CATEMU", "LLAILLAY", "PANQUEHUE", "PUTAENDO", "SANTA MARIA", "QUILPUE", "LIMACHE", "OLMUE", "VILLA ALEMANA"],
  "METROPOLITANA": ["SANTIAGO", "CERRILLOS", "CERRO NAVIA", "CONCHALI", "EL BOSQUE", "ESTACION CENTRAL", "HUECHURABA", "INDEPENDENCIA", "LA CISTERNA", "LA FLORIDA", "LA GRANJA", "LA PINTANA", "LA REINA", "LAS CONDES", "LO BARNECHEA", "LO ESPEJO", "LO PRADO", "MACUL", "MAIPU", "NUNOA", "PEDRO AGUIRRE CERDA", "PENALOLEN", "PROVIDENCIA", "PUDAHUEL", "QUILICURA", "QUINTA NORMAL", "RECOLETA", "RENCA", "SAN JOAQUIN", "SAN MIGUEL", "SAN RAMON", "VITACURA", "PUENTE ALTO", "PIRQUE", "SAN JOSE DE MAIPO", "COLINA", "LAMPA", "TILTIL", "SAN BERNARDO", "BUIN", "CALERA DE TANGO", "PAINE", "MELIPILLA", "ALHUE", "CURACAVI", "MARIA PINTO", "SAN PEDRO", "TALAGANTE", "EL MONTE", "ISLA DE MAIPO", "PADRE HURTADO", "PENAFLOR"],
  "O'HIGGINS": ["RANCAGUA", "CODEGUA", "COINCO", "COLTAUCO", "DONIHUE", "GRANEROS", "LAS CABRAS", "MACHALI", "MALLOA", "MOSTAZAL", "OLIVAR", "PEUMO", "PICHIDEGUA", "QUINTA DE TILCOCO", "RENGO", "REQUINOA", "SAN VICENTE", "PICHILEMU", "LA ESTRELLA", "LITUECHE", "MARCHIHUE", "NAVIDAD", "PAREDONES", "SAN FERNANDO", "CHEPICA", "CHIMBARONGO", "LOLOL", "NANCAGUA", "PALMILLA", "PERALILLO", "PLACILLA", "PUMANQUE", "SANTA CRUZ"],
  "MAULE": ["TALCA", "CONSTITUCION", "CUREPTO", "EMPEDRADO", "MAULE", "PELARCO", "PENCAHUE", "RIO CLARO", "SAN CLEMENTE", "SAN RAFAEL", "CAUQUENES", "CHANCO", "PELLUHUE", "CURICO", "HUALANE", "LICANTEN", "MOLINA", "RAUCO", "ROMERAL", "SAGRADA FAMILIA", "TENO", "VICHUQUEN", "LINARES", "COLBUN", "LONGAVI", "PARRAL", "RETIRO", "SAN JAVIER", "VILLA ALEGRE", "YERBAS BUENAS"],
  "NUBLE": ["CHILLAN", "BULNES", "COBQUECURA", "COELEMU", "COIHUECO", "CHILLAN VIEJO", "EL CARMEN", "NINHUE", "NITIHUEL", "PEMUCO", "PINTO", "PORTEZUELO", "QUILLON", "QUIRIHUE", "RANQUIL", "SAN CARLOS", "SAN FABIAN", "SAN IGNACIO", "SAN NICOLAS", "TREGUACO", "YUNGAY"],
  "BIO BIO": ["CONCEPCION", "CORONEL", "CHIGUAYANTE", "FLORIDA", "HUALQUI", "LOTA", "PENCO", "SAN PEDRO DE LA PAZ", "SANTA JUANA", "TALCAHUANO", "TOME", "HUALPEN", "LEBU", "ARAUCO", "CANETE", "CONTULMO", "CURANILAHUE", "LOS ALAMOS", "TIRUA", "LOS ANGELES", "ANTUCO", "CABRERO", "LAJA", "MULCHEN", "NACIMIENTO", "NEGRETE", "QUILACO", "QUILLECO", "SAN ROSENDO", "SANTA BARBARA", "TUCAPEL", "YUMBEL", "ALTO BIOBIO"],
  "ARAUCANIA": ["TEMUCO", "CARAHUE", "CUNCO", "CURARREHUE", "FREIRE", "GALVARINO", "GORBEA", "LAUTARO", "LONCOCHE", "MELIPEUCO", "NUEVA IMPERIAL", "PADRE LAS CASAS", "PERQUENCO", "PITRUFQUEN", "PUCON", "SAAVEDRA", "TEODORO SCHMIDT", "TOLTEN", "VILCUN", "VILLARRICA", "CHOLCHOL", "ANGOL", "COLLIPULLI", "CURACAUTIN", "ERCILLA", "LONQUIMAY", "LOS SAUCES", "LUMACO", "PUREN", "RENAICO", "TRAIGUEN", "VICTORIA"],
  "LOS RIOS": ["VALDIVIA", "CORRAL", "LANCO", "LOS LAGOS", "MAFIL", "MARIQUINA", "PAILLACO", "PANGUIPULLI", "LA UNION", "FUTRONO", "LAGO RANCO", "RIO BUENO"],
  "LOS LAGOS": ["PUERTO MONTT", "CALBUCO", "COCHAMO", "FRESIA", "FRUTILLAR", "LOS MUERMOS", "LLANQUIHUE", "PUERTO VARAS", "CASTRO", "ANCUD", "CHONCHI", "CURACO DE VELEZ", "DALCAHUE", "PUQUELDON", "QUEILEN", "QUELLON", "QUEMCHI", "QUINCHAO", "OSORNO", "PUERTO OCTAY", "PURRANQUE", "PUYEHUE", "RIO NEGRO", "SAN JUAN DE LA COSTA", "SAN PABLO", "CHAITEN", "FUTALEUFU", "HUALAIHUE", "PALENA"],
  "AYSEN": ["COYHAIQUE", "LAGO VERDE", "AYSEN", "CISNES", "GUAITECAS", "COCHRANE", "O'HIGGINS", "TORTEL", "CHILE CHICO", "RIO IBANEZ"],
  "MAGALLANES": ["PUNTA ARENAS", "LAGUNA BLANCA", "RIO VERDE", "SAN GREGORIO", "CABO DE HORNOS", "ANTARTICA", "PORVENIR", "PRIMAVERA", "TIMAUKEL", "NATALES", "TORRES DEL PAINE"]
};

if(dirRegion) {
  Object.keys(regionesData).forEach(region => {
    const opt = document.createElement("option");
    opt.value = region;
    opt.textContent = region;
    dirRegion.appendChild(opt);
  });
}

dirRegion?.addEventListener("change", () => {
  dirComuna.innerHTML = '<option value="">Seleccione Comuna</option>'; 
  if (dirRegion.value) {
    dirComuna.disabled = false;
    regionesData[dirRegion.value].forEach(comuna => {
      const opt = document.createElement("option");
      opt.value = comuna;
      opt.textContent = comuna;
      dirComuna.appendChild(opt);
    });
  } else {
    dirComuna.disabled = true;
    dirCalle.disabled = true; dirCalle.value = "";
    dirNumero.disabled = true; dirNumero.value = "";
    dirDepto.disabled = true; dirDepto.value = "";
    btnCheckDir.disabled = true;
  }
});

dirComuna?.addEventListener("change", () => {
  if (dirComuna.value) {
    dirCalle.disabled = false;
  } else {
    dirCalle.disabled = true; dirCalle.value = "";
    dirNumero.disabled = true; dirNumero.value = "";
    dirDepto.disabled = true; dirDepto.value = "";
    btnCheckDir.disabled = true;
  }
});

dirCalle?.addEventListener("input", () => {
  if (dirCalle.value.length > 2) {
    dirNumero.disabled = false;
  } else {
    dirNumero.disabled = true; dirNumero.value = "";
    dirDepto.disabled = true; dirDepto.value = "";
    btnCheckDir.disabled = true;
  }
});

dirNumero?.addEventListener("input", () => {
  if (dirNumero.value.length > 0) {
    dirDepto.disabled = false;
    btnCheckDir.disabled = false;
  } else {
    dirDepto.disabled = true; dirDepto.value = "";
    btnCheckDir.disabled = true;
  }
});

btnCheckDir?.addEventListener("click", async () => {
  const box = $("dirResult");
  const title = $("dirTitle");
  const lines = $("dirLines");

  box.style.display = "block";
  title.textContent = "Verificando...";
  lines.innerHTML = "<div class='spinner'></div> Buscando factibilidad en Movistar...";
  btnCheckDir.disabled = true;

  const payload = {
    region: dirRegion.value,
    comuna: dirComuna.value,
    calle: dirCalle.value,
    numero: dirNumero.value,
    depto: dirDepto.value || ""
  };

  // 1. Registro silencioso en Supabase para el Supervisor
  const u = getAuthedUser();
  let ticketId = null;
  let chatTicket = [];

  if (u && typeof supabaseClient !== "undefined") {
    const codigoTicket = "FAC-" + Date.now().toString().slice(-6);
    chatTicket = [{ 
        from: "me", 
        text: `📍 Consulta Dirección:\n${payload.calle} ${payload.numero}, ${payload.comuna}`, 
        at: nowISO() 
    }];

    const nuevoTicket = {
      codigo: codigoTicket,
      estado: "Resuelto", // Se marca resuelto de inmediato al terminar la consulta
      tema: "Factibilidad",
      prioridad: "Media",
      canal: "Sistema Bot",
      creado_por: u.user,
      creado_por_nombre: u.name,
      resumen: `Factibilidad: ${payload.calle} ${payload.numero}`,
      chat: chatTicket
    };

    try {
      const { data } = await supabaseClient.from('tickets').insert([nuevoTicket]).select().single();
      if (data) ticketId = data.id;
    } catch (e) { console.warn("Error guardando registro de auditoría."); }
  }

  // 2. Llamada al robot de Python
  try {
    const response = await fetch("http://localhost:8000/consultar_direccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const res = await response.json();
    btnCheckDir.disabled = false;
    
    if (res.status === "success") {
      const data = res.data; 
      const colorFibra = data.fibra === "SI" ? "#22c55e" : "#ef4444";
      const colorBloqueo = data.bloqueo === "Sin Bloqueo" ? "#22c55e" : "#ef4444"; 

      title.textContent = "Resultados de Factibilidad";
      lines.innerHTML = `
        <table style="width: 100%; font-size: 14px; border-spacing: 0;">
          <tr><td>Factibilidad Fibra:</td><td style="text-align: right; font-weight: bold; color: ${colorFibra};">${data.fibra}</td></tr>
          <tr><td>Tecnología:</td><td style="text-align: right; font-weight: bold;">${data.tecnologia}</td></tr>
          <tr><td>Velocidad Max:</td><td style="text-align: right; font-weight: bold;">${data.velocidad}</td></tr>
          <tr><td>Bloqueo:</td><td style="text-align: right; font-weight: bold; color: ${colorBloqueo};">${data.bloqueo}</td></tr>
        </table>
      `;

      if (ticketId) {
        chatTicket.push({ from: "bot", text: `✅ Resultado: Fibra ${data.fibra}, Vel: ${data.velocidad}, Bloqueo: ${data.bloqueo}`, at: nowISO() });
        await supabaseClient.from('tickets').update({ chat: chatTicket }).eq('id', ticketId);
      }
    } else {
      title.textContent = "Error";
      lines.innerHTML = `• ${res.message}`;
    }
  } catch (err) {
    btnCheckDir.disabled = false;
    title.textContent = "Error de Conexión";
    lines.innerHTML = "• No se pudo conectar con la API del Robot.";
  }
});

// ===================== BUSCAR (RUT / CODE) =====================
const searchType = $("searchType");
const searchInput = $("searchInput");
const btnDoSearch = $("btnDoSearch");
const searchResult = $("searchResult");
const searchLines = $("searchLines");

function updateSearchPlaceholder(){
  const t = searchType?.value || "rut";
  if (!searchInput) return;
  searchInput.placeholder = t === "rut" ? "Ej: 12.345.678-9" : "Ej: V-1234567";
}
searchType?.addEventListener("change", updateSearchPlaceholder);
updateSearchPlaceholder();

btnDoSearch?.addEventListener("click", () => {
  const t = searchType?.value || "rut";
  const q = (searchInput?.value || "").trim();
  const sales = getSales();

  if (!q){
    if (searchResult) searchResult.style.display = "block";
    if (searchLines) searchLines.innerHTML = "• Ingresa un valor para buscar.";
    return;
  }

  let found = null;
  if (t === "rut"){
    const qn = norm(q.replace(/\./g,""));
    found = sales.find(s => norm((s.rut||"").replace(/\./g,"")) === qn);
  } else {
    const qn = norm(q);
    found = sales.find(s => norm(s.code) === qn);
  }

  if (searchResult) searchResult.style.display = "block";
  if (!found){
    if (searchLines) searchLines.innerHTML = "• No se encontró coincidencia (demo).";
    return;
  }

  if (searchLines) searchLines.innerHTML = `
    • Código: <b>${escapeHtml(found.code)}</b><br>
    • RUT: <b>${escapeHtml(found.rut)}</b><br>
    • Cliente: <b>${escapeHtml(found.nombre)}</b><br>
    • Comuna: <b>${escapeHtml(found.comuna)}</b><br>
    • Estado: <b>${escapeHtml(found.estado)}</b><br>
    • Fecha: <b>${escapeHtml(fmtDate(found.at))}</b>
  `;
});

// ===================== VENTAS: REGISTRAR + LISTADO + DETALLE =====================
const ventaBackdrop = $("ventaBackdrop");
const btnCloseVenta = $("btnCloseVenta");
const btnCancelarVenta = $("btnCancelarVenta");
const ventaForm = $("ventaForm");
const tipoVivienda = $("tipoVivienda");
const deptoBox = $("deptoBox");
const numDepto = $("numDepto");
const ventaEvid = $("ventaEvid");

function makeSaleCode(){ return "V-" + Date.now().toString().slice(-7); }

// 👇 Función para abrir el modal (ahora cierra el otro si está abierto) 👇
function openVentaModal(e){
  if (e) e.preventDefault();
  
  const modalFactibilidad = $("modalBackdrop");
  if (modalFactibilidad) modalFactibilidad.style.display = "none";
  
  if (ventaBackdrop) ventaBackdrop.style.display = "grid"; 
}

// ===================== LÓGICA PASO A PASO DEL FORMULARIO =====================
const ventaPaso1 = $("ventaPaso1");
const ventaPaso2 = $("ventaPaso2");
const btnVentaSiguiente = $("btnVentaSiguiente");
const btnVentaAtras = $("btnVentaAtras");

// Botón Siguiente
btnVentaSiguiente?.addEventListener("click", () => {
  // Validamos SOLO los campos del Paso 1 para que los ocultos del Paso 2 no traben el navegador
  const inputsPaso1 = ventaPaso1.querySelectorAll("input, select, textarea");
  let todoValido = true;
  
  for (let input of inputsPaso1) {
    if (!input.checkValidity()) {
      input.reportValidity(); // Muestra el mensaje rojo "Completa este campo"
      todoValido = false;
      break; // Nos detenemos en el primer error que encuentre
    }
  }

  // Si el Paso 1 está todo lleno, pasamos al Paso 2
  if (todoValido) {
    ventaPaso1.style.display = "none";
    ventaPaso2.style.display = "block";
  }
});
// Botón Atrás
btnVentaAtras?.addEventListener("click", () => {
  ventaPaso2.style.display = "none";
  ventaPaso1.style.display = "block";
});

// Mostrar/Ocultar Cajas de Producto según el Checkbox
$("chkFibra")?.addEventListener("change", (e) => $("boxOpcionesFibra").style.display = e.target.checked ? "block" : "none");
$("chkTv")?.addEventListener("change", (e) => $("boxOpcionesTv").style.display = e.target.checked ? "block" : "none");
$("chkFijo")?.addEventListener("change", (e) => $("boxOpcionesFijo").style.display = e.target.checked ? "block" : "none");

// Mostrar/Ocultar campo de fecha específica
$("ventaFechaTipo")?.addEventListener("change", (e) => {
  $("boxVentaFecha").style.display = e.target.value === "rango" ? "block" : "none";
});

function closeVentaModal(){ 
  if (ventaBackdrop) ventaBackdrop.style.display = "none"; 
  if (ventaForm) ventaForm.reset();
  
  // Ocultar paso 2 y mostrar paso 1 al cerrar
  if(ventaPaso1) ventaPaso1.style.display = "block";
  if(ventaPaso2) ventaPaso2.style.display = "none";
  
  if($("boxOpcionesFibra")) $("boxOpcionesFibra").style.display = "none";
  if($("boxOpcionesTv")) $("boxOpcionesTv").style.display = "none";
  if($("boxOpcionesFijo")) $("boxOpcionesFijo").style.display = "none";
  if($("boxVentaFecha")) $("boxVentaFecha").style.display = "none";
  if(deptoBox) deptoBox.style.display = "none";
}

// 👇 Conectamos AMBOS botones aquí 👇
$("btnVentasRegistrar")?.addEventListener("click", openVentaModal); // Botón grande de Ventas
$("btnTopRegistrarVenta")?.addEventListener("click", openVentaModal); // Botón de la barra superior

btnCloseVenta?.addEventListener("click", closeVentaModal);
btnCancelarVenta?.addEventListener("click", closeVentaModal);
ventaBackdrop?.addEventListener("click", (e) => { if (e.target === ventaBackdrop) closeVentaModal(); });

tipoVivienda?.addEventListener("change", () => {
  if (tipoVivienda.value === "depto"){
    if (deptoBox) deptoBox.style.display = "block";
    if (numDepto) numDepto.required = true;
  } else {
    if (deptoBox) deptoBox.style.display = "none";
    if (numDepto){ numDepto.required = false; numDepto.value = ""; }
  }
});

function fileMetaList(fileInput){
  const arr = [];
  const files = fileInput?.files ? Array.from(fileInput.files) : [];
  files.forEach(f => arr.push({ name:f.name, type:f.type || "archivo", at: nowISO() }));
  return arr;
}

ventaForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const rut = ($("rut")?.value || "").trim();
  if (rut && (!isRutFormatOK(rut) || !isRutDVOK(rut))){
    toast("Venta", "RUT inválido (formato/DV)");
    ventaPaso2.style.display = "none";
    ventaPaso1.style.display = "block";
    return;
  }

// Catálogo de Precios (Basado en Matriz de Ofertas)
  const catalogoPrecios = {
    "Fibra 400 MB": 12990,
    "Fibra 600 MB": 15990,
    "Fibra 800 MB": 16990,
    "Fibra Gamer": 20990,
    "TV Inicial (60 canales)": 9990,
    "TV Full (110 canales)": 14990,
    "Línea Ilimitada Nacional": 5990,
    "Línea + 300 Min a Móviles": 7990
  };

  // Recopilar los productos contratados y calcular el precio total
  let productosContratados = [];
  let precioTotal = 0;

  if ($("chkFibra")?.checked && $("planFibra")?.value) {
    let plan = $("planFibra").value;
    productosContratados.push(plan);
    // Extraemos el nombre base para buscar el precio
    let nombreBase = plan.split(" - ")[0];
    if (catalogoPrecios[nombreBase]) precioTotal += catalogoPrecios[nombreBase];
  }
  
  if ($("chkTv")?.checked && $("planTv")?.value) {
    let plan = $("planTv").value;
    productosContratados.push(plan);
    let nombreBase = plan.split(" - ")[0];
    if (catalogoPrecios[nombreBase]) precioTotal += catalogoPrecios[nombreBase];
  }
  
  if ($("chkFijo")?.checked && $("planFijo")?.value) {
    let plan = $("planFijo").value;
    productosContratados.push(plan);
    let nombreBase = plan.split(" - ")[0];
    if (catalogoPrecios[nombreBase]) precioTotal += catalogoPrecios[nombreBase];
  }

  // Aplicar descuentos simulados si es DUO o TRIO (Ajustable según necesidad real)
  if (productosContratados.length === 2) {
    precioTotal = precioTotal - 3000; // Descuento genérico de DUO
  } else if (productosContratados.length === 3) {
    precioTotal = precioTotal - 5000; // Descuento genérico de TRIO
  }

  if (productosContratados.length === 0) {
    toast("Servicios", "Debes seleccionar al menos un producto (Fibra, TV o Fijo)");
    return;
  }

 // Determinar la fecha de instalación (Rango Semanal)
  let fechaInstalacion = $("ventaFechaTipo")?.value;
  if (fechaInstalacion === "rango") {
    fechaInstalacion = $("ventaFechaEspecifica")?.value || "Sin rango especificado";
  }

 const usuarioActual = getAuthedUser();
  const sale = {
    id: uid("SALE"),
    code: makeSaleCode(),
    rut,
    nombre: ($("nombre")?.value || "").trim(),
    correo: ($("correo")?.value || "").trim(),
    telefono: ($("telefono")?.value || "").trim(),
    direccion: ($("ventaDireccion")?.value || "").trim(),
    comuna: ($("ventaComuna")?.value || "").trim(),
    tipoVivienda: ($("tipoVivienda")?.value || ""),
    numDepto: ($("numDepto")?.value || "").trim(),
    estado: "Validación",
    evid: fileMetaList(ventaEvid),
    at: nowISO(),
    vendedor_id: usuarioActual?.user || "desconocido",
    vendedor_nombre: usuarioActual?.name || "Desconocido",
    servicios: productosContratados.join(" | "),
    precio_mensual: precioTotal,
    ciclo_facturacion: ($("ventaCiclo")?.value || ""),
    fecha_agenda: fechaInstalacion,
    log: [{ action: "Venta Registrada", by: usuarioActual?.name || "Desconocido", at: nowISO() }]
  };

  async function enviarASupabase(datosVenta) {
    if (!supabaseClient) return;
    try {
      const { error } = await supabaseClient.from("ventas").insert([datosVenta]);
      if (error) throw error;
      toast("Sincronizado ☁️", "Venta respaldada en la nube.");
    } catch (err) {
      console.warn("Error en Supabase:", err);
    }
  }

  const sales = getSales();
  sales.unshift(sale);
  setSales(sales);
  enviarASupabase(sale);

  addAviso("Venta registrada", `${sale.code} • ${sale.nombre} • ${sale.comuna}`);
  toast("Venta guardada", `Código: ${sale.code}`);

  closeVentaModal();
  goCart();
});

$("btnVentasListado")?.addEventListener("click", goCart);

// listado ventas
const cartBody = $("cartBody");
const cartSearch = $("cartSearch");
const cartStatusFilter = $("cartStatusFilter");
const cartDateFrom = $("cartDateFrom");
const cartDateTo = $("cartDateTo");

let cartRenderLimit = 20; // 🚀 LÍMITE DE CARGA ANTI-COLAPSOS

$("btnCartRefresh")?.addEventListener("click", async () => {
  toast("Actualizando...", "Descargando desde la nube ☁️");
  await sincronizarDesdeNube();
  cartRenderLimit = 20; // Reseteamos al actualizar
  renderCart();
});

// Si el usuario busca o filtra, volvemos a mostrar los primeros 20
cartSearch?.addEventListener("input", () => { cartRenderLimit = 20; renderCart(); });
cartStatusFilter?.addEventListener("change", () => { cartRenderLimit = 20; renderCart(); });
cartDateFrom?.addEventListener("change", () => { cartRenderLimit = 20; renderCart(); });
cartDateTo?.addEventListener("change", () => { cartRenderLimit = 20; renderCart(); });

// 🔥 GENERADOR DE BARRA DE PROGRESO (MINI TIMELINE) 🔥
function renderMiniTimeline(estado) {
  const e = (estado || "").toLowerCase();
  const isRechazada = e === "rechazada";
  
  let s1 = "active";
  if (e === "instalación" || e === "instalacion" || e === "exitosa" || isRechazada) s1 = "completed";
  
  let s2 = "";
  if (e === "instalación" || e === "instalacion") s2 = "active";
  if (e === "exitosa" || isRechazada) s2 = "completed";
  
  let s3 = ""; let icon3 = "3"; let label3 = "Exitosa";
  if (e === "exitosa") { s3 = "completed"; icon3 = "✓"; } 
  else if (isRechazada) { s3 = "rejected"; icon3 = "✕"; label3 = "Rechazada"; }

  return `
    <div class="mini-timeline">
      <div class="mini-step ${s1}"><div class="mini-icon">${s1==='completed'?'✓':'1'}</div><div class="mini-label">Validación</div></div>
      <div class="mini-line ${s1==='completed'?'completed':''}"></div>
      <div class="mini-step ${s2}"><div class="mini-icon">${s2==='completed'?'✓':'2'}</div><div class="mini-label">Instalación</div></div>
      <div class="mini-line ${s2==='completed'?'completed':''}"></div>
      <div class="mini-step ${s3}"><div class="mini-icon">${icon3}</div><div class="mini-label">${label3}</div></div>
    </div>
  `;
}

function renderCart(){
  if (!cartBody) return;
  const q = norm(cartSearch?.value || "");
  const status = cartStatusFilter?.value || "";
  
  // 1. Obtenemos quién está mirando la pantalla
  const u = getAuthedUser();
  // Ahora consideramos Administradores y BackOffice para que vean todo
  const isAdmin = (u?.rol === "Admin" || u?.rol === "BackOffice" || u?.user === "admin");
  
  let allSales = getSales();
  
  // 2. FILTRO DE SEGURIDAD: Si no es jefe, filtramos solo sus ventas
  if (!isAdmin && u) {
    allSales = allSales.filter(s => s.vendedor_id === u.user);
  }

 const dateFrom = cartDateFrom?.value;
  const dateTo = cartDateTo?.value;

  const filtered = allSales.filter(s => {
    const okQ = !q || (
      norm(s.code).includes(q) ||
      norm(s.rut).includes(q) ||
      norm(s.nombre).includes(q) ||
      norm(s.comuna).includes(q)
    );
    const okS = !status || (s.estado === status);
    
    // Filtro de fechas (comparando formato YYYY-MM-DD)
    let okDate = true;
    if (dateFrom || dateTo) {
      const saleDate = new Date(s.at).toISOString().split('T')[0];
      if (dateFrom && saleDate < dateFrom) okDate = false;
      if (dateTo && saleDate > dateTo) okDate = false;
    }

    return okQ && okS && okDate;
  });

  // Funciones para asignar clases y estilos según el estado
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

  // Simulación inteligente de la Agenda de Instalación
  const renderAgenda = (estado) => {
    if(estado === "Exitosa") return `<div class="sc-agenda-content">✅ Servicio Activo</div>`;
    if(estado === "Rechazada") return `<div class="sc-agenda-content" style="color:#ef4444;">❌ Venta anulada</div>`;
    if(estado === "Instalación" || estado === "Instalacion") return `<div class="sc-agenda-content highlight">Hoy<br>Entre 14:00 y 18:00 hrs</div>`;
    return `<div class="sc-agenda-content">La venta no se ha<br>programado aún</div>`;
  };

 // 🚀 APLICAMOS EL CORTE ANTI-COLAPSO 🚀
  const toRender = filtered.slice(0, cartRenderLimit);

  cartBody.innerHTML = toRender.map(s => `
    <div class="sale-card ${getBorderClass(s.estado)}">
      
      <div class="sc-head-pro">
        <div class="sc-rut-pro">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          ${escapeHtml(s.rut || "Sin RUT")}
        </div>
        <div class="sc-date-pro">📅 ${escapeHtml(fmtDate(s.at))}</div>
      </div>

      <div class="sc-body-pro">
        
       <div class="sc-info-left">
          <div class="sc-row-id">
            <span class="sc-id-text"># ${escapeHtml(s.code)}</span>
            ${s.numero_orden ? `<span style="color: #facc15; font-size: 13px; font-weight: 800; margin-left: 8px;">📄 Orden: ${escapeHtml(s.numero_orden)}</span>` : ''}
            <span class="sc-venta-tipo">📺🏠 Venta Hogar</span>
          </div>
          
          <div>
            <span class="${getStatusBadge(s.estado)}">${escapeHtml(s.estado || "Pendiente")}</span>
          </div>

          <div class="sc-address-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <div>
              <b style="color: var(--text-main);">${escapeHtml(s.comuna || "Sin comuna")}</b><br>
              ${escapeHtml(s.direccion || "Sin dirección")}<br>
              ${s.tipoVivienda === "depto" && s.numDepto ? `Depto ${escapeHtml(s.numDepto)}` : 'Casa'}
            </div>
          </div>
        </div>

        <div class="sc-agenda-right">
          <div class="sc-agenda-title">Agenda de Instalación</div>

          <div style="margin: 10px 0 6px;">
            ${renderMiniTimeline(s.estado)}
          </div>

          ${renderAgenda(s.estado)}
        </div>

      </div>

      <div class="sc-foot-pro">
        <div class="sc-client-name">👤 ${escapeHtml(s.nombre || "Cliente B2C")}</div>
        <button class="btn-action secondary" style="font-size: 12px; padding: 6px 14px;" data-sale-open="${escapeHtml(s.id)}" type="button">Ver Detalle</button>
      </div>

    </div>
  `).join("") || `
    <div class="empty">
      <div class="ico">🧾</div>
      <div class="t">No hay ventas para mostrar</div>
      <div class="s">Prueba quitando filtros o registra una venta nueva.</div>
    </div>
  `;

  // Reconectar los botones de "Ver Detalle"
  cartBody.querySelectorAll("[data-sale-open]").forEach(btn => {
    btn.addEventListener("click", () => openSaleDetail(btn.getAttribute("data-sale-open")));
  });

  // 🚀 BOTÓN DE CARGAR MÁS 🚀
  if (cartRenderLimit < filtered.length) {
    const btnLoadMore = document.createElement("button");
    btnLoadMore.className = "btn-action secondary";
    btnLoadMore.style.width = "100%";
    btnLoadMore.style.justifyContent = "center";
    btnLoadMore.style.marginTop = "10px";
    btnLoadMore.style.padding = "12px";
    btnLoadMore.innerHTML = `⬇️ Cargar más ventas (${filtered.length - cartRenderLimit} ocultas)`;
    btnLoadMore.onclick = () => {
      cartRenderLimit += 20; // Aumentamos el límite de a 20
      renderCart();
    };
    cartBody.appendChild(btnLoadMore);
  }

  updateKpis();
}
// ===================== ABRIR DETALLE DE VENTA =====================
window.openSaleDetail = function(id) {
  const allSales = getSales();
  const sale = allSales.find(s => s.id === id);
  if (!sale) return;

  const modal = $("saleDetailBackdrop");
  if (modal) modal.style.display = "grid";

  // Llenar datos básicos
  $("saleDetailTitle").textContent = "Detalle Venta • " + sale.code;
  
  // Usamos las funciones moneyCLP y escapeHtml que ya tienes en config.js
  $("saleDetailData").innerHTML = `
    <b>RUT:</b> ${escapeHtml(sale.rut)}<br>
    <b>Cliente:</b> ${escapeHtml(sale.nombre)}<br>
    <b>Teléfono:</b> ${escapeHtml(sale.telefono)}<br>
    <b>Dirección:</b> ${escapeHtml(sale.direccion)}, ${escapeHtml(sale.comuna)}<br>
    <b>Servicios:</b> ${escapeHtml(sale.servicios || 'No especificado')}<br>
    <b>Precio Mensual:</b> $${moneyCLP(sale.precio_mensual || 0)}<br>
    <b>Estado actual:</b> <span style="font-weight:bold; color:var(--brand-blue);">${escapeHtml(sale.estado)}</span>
  `;

  // Renderizar la barra de progreso
  $("saleTimeline").innerHTML = renderMiniTimeline(sale.estado);
  $("saleDetailStatus").value = sale.estado;
  
  // Mostrar u ocultar la caja del Número de Orden según el rol
  const u = getAuthedUser();
  const isStaff = u && (u.rol === "Admin" || u.rol === "BackOffice" || u.user === "admin");
  const boxOrden = $("boxNumeroOrden");
  const inputOrden = $("inputNumeroOrden");
  
  if (boxOrden && inputOrden) {
    if (isStaff) {
      boxOrden.style.display = "block";
      inputOrden.value = sale.numero_orden || "";
    } else {
      boxOrden.style.display = "none";
    }
  }

  // Guardar el ID de la venta temporalmente para poder editarla
  window.currentSaleIdDetail = id; 
};

// ===================== CERRAR Y ACTUALIZAR ESTADO =====================
$("btnCloseSaleDetail")?.addEventListener("click", () => {
  $("saleDetailBackdrop").style.display = "none";
});

// Guardar nuevo estado desde el Detalle
$("btnSaveSaleStatus")?.addEventListener("click", async () => {
  if (!window.currentSaleIdDetail) return;
  const allSales = getSales();
  const idx = allSales.findIndex(s => s.id === window.currentSaleIdDetail);
  if (idx < 0) return;

  const nuevoEstado = $("saleDetailStatus").value;
  const inputOrden = $("inputNumeroOrden");
  const nuevaOrden = inputOrden ? inputOrden.value.trim() : "";

  allSales[idx].estado = nuevoEstado;
  allSales[idx].numero_orden = nuevaOrden;
  
  // Actualizar en Supabase si estás conectado
  if (typeof supabaseClient !== "undefined" && supabaseClient) {
    await supabaseClient.from('ventas').update({ 
      estado: nuevoEstado,
      numero_orden: nuevaOrden 
    }).eq('id', window.currentSaleIdDetail);
  }
  
  setSales(allSales);
  toast("Venta actualizada", `Estado: ${nuevoEstado} | Orden: ${nuevaOrden || "Sin orden"}`);
  
  $("saleDetailBackdrop").style.display = "none";
  
  // Recargar las vistas
  if (typeof renderCart === "function") renderCart();
  if (typeof renderAdminPanel === "function") renderAdminPanel();
});