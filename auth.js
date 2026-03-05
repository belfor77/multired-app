// ===================== SPLASH + AUTH =====================
const splash = $("splash");
const loginBackdrop = $("loginBackdrop");
const verifyBackdrop = $("verifyBackdrop");
const forgotBackdrop = $("forgotBackdrop");

// auth tabs
const tabLogin = $("tabLogin");
const tabRegister = $("tabRegister");
const loginPane = $("loginPane");
const registerPane = $("registerPane");
const authTitle = $("authTitle");

function showAuth(which){
  const isLogin = which === "login";
  tabLogin?.classList.toggle("active", isLogin);
  tabRegister?.classList.toggle("active", !isLogin);
  if (authTitle) authTitle.textContent = isLogin ? "Iniciar sesión" : "Registrarse";
  if (loginPane) loginPane.style.display = isLogin ? "block" : "none";
  if (registerPane) registerPane.style.display = isLogin ? "none" : "block";
}
tabLogin?.addEventListener("click", () => showAuth("login"));
tabRegister?.addEventListener("click", () => showAuth("register"));

function openBackdrop(el){ if (el) el.style.display = "grid"; }
function closeBackdrop(el){ if (el) el.style.display = "none"; }

// fake email verification (demo)
let pendingVerify = null; // {user,email,code}
function openVerifyFor(userObj){
  pendingVerify = {
    user: userObj.user,
    email: userObj.email,
    code: String(Math.floor(100000 + Math.random()*900000))
  };
  const hint = $("verifyHint");
  if (hint) hint.textContent = `(Demo) Código enviado: ${pendingVerify.code}`;
  $("verifyCodeInput") && ($("verifyCodeInput").value = "");
  openBackdrop(verifyBackdrop);
}
$("btnCloseVerify")?.addEventListener("click", () => closeBackdrop(verifyBackdrop));
verifyBackdrop?.addEventListener("click", (e) => { if (e.target === verifyBackdrop) closeBackdrop(verifyBackdrop); });

$("btnVerifyCode")?.addEventListener("click", () => {
  const code = ($("verifyCodeInput")?.value || "").trim();
  if (!pendingVerify) { closeBackdrop(verifyBackdrop); return; }
  if (code !== pendingVerify.code){
    toast("Código incorrecto", "Intenta nuevamente");
    return;
  }
  closeBackdrop(verifyBackdrop);
  toast("Cuenta verificada", `Ya puedes iniciar sesión: ${pendingVerify.user}`);
  pendingVerify = null;
  showAuth("login");
});

// forgot pass demo
$("btnForgotPass")?.addEventListener("click", () => openBackdrop(forgotBackdrop));
$("btnCloseForgot")?.addEventListener("click", () => closeBackdrop(forgotBackdrop));
forgotBackdrop?.addEventListener("click", (e) => { if (e.target === forgotBackdrop) closeBackdrop(forgotBackdrop); });

$("btnDoForgot")?.addEventListener("click", () => {
  const email = ($("forgotEmail")?.value || "").trim().toLowerCase();
  const newPass = ($("forgotNewPass")?.value || "").trim();
  if (!email || !newPass){
    toast("Falta info", "Completa correo y nueva contraseña");
    return;
  }
  const users = getUsers();
  const idx = users.findIndex(u => (u.email || "").toLowerCase() === email);
  if (idx < 0){
    toast("No encontrado", "Ese correo no existe (demo)");
    return;
  }
  if (!isPassOk(newPass)){
    toast("Contraseña débil", "Mín. 8, 1 mayúscula, 1 número");
    return;
  }
  users[idx].pass = newPass;
  setUsers(users);
  toast("Contraseña actualizada", "Ahora inicia sesión");
  closeBackdrop(forgotBackdrop);
  showAuth("login");
});

// password rules
function isPassOk(p){
  if (!p || p.length < 8) return false;
  if (!/[A-Z]/.test(p)) return false;
  if (!/[0-9]/.test(p)) return false;
  return true;
}

// RUT validation
function cleanRut(rut){ return (rut || "").replace(/\s/g,"").replace(/\./g,""); }
function isRutFormatOK(rut){ return /^[0-9]{7,8}-[0-9kK]{1}$/.test(cleanRut(rut)); }
function rutDV(num){
  let s=1, m=0;
  while(num){
    s = (s + num%10*(9-m++%6))%11;
    num = Math.floor(num/10);
  }
  return s ? String(s-1) : "K";
}
function isRutDVOK(rut){
  const c = cleanRut(rut);
  if (!isRutFormatOK(c)) return false;
  const [n,dv] = c.split("-");
  return rutDV(parseInt(n,10)) === dv.toUpperCase();
}

// LOGIN (CONECTADO A LA NUBE Y VERIFICACIÓN DE ESTADO)
$("btnLogin")?.addEventListener("click", async () => {
  const u = ($("loginUser")?.value || "").trim().toLowerCase(); // aquí debe ser EMAIL
  const p = ($("loginPass")?.value || "").trim();

  if (!u || !p) {
    toast("Login", "Ingresa correo y contraseña");
    return;
  }



  if (!supabaseClient) {
    toast("Supabase", "No se inicializó Supabase.");
    return;
  }

  const btnLog = $("btnLogin");
  btnLog.disabled = true;
  btnLog.textContent = "Conectando... ☁️";

  try {
    // ✅ Login seguro con SUPABASE AUTH (NO tabla usuarios)
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: u,
      password: p
    });

    if (error || !data?.user) {
      toast("Error", "Correo o contraseña incorrectos.");
      return;
    }

    const userId = data.user.id;

    // ✅ Leer perfil
    const { data: profile, error: pErr } = await supabaseClient
      .from("usuarios")
      .select("*")
      .eq("id", userId)
      .single();

    if (pErr || !profile) {
      toast("Error", "No se encontró el perfil (profiles).");
      await supabaseClient.auth.signOut();
      return;
    }

    // 🔒 Bloquear si no está aprobado
    if (profile.estado_cuenta === "Pendiente") {
      toast("Cuenta en Revisión ⏳", "El administrador está validando tu carnet.");
      await supabaseClient.auth.signOut();
      return;
    }

    if (profile.estado_cuenta === "Rechazado") {
      toast("Cuenta Rechazada ❌", "Contacta a soporte.");
      await supabaseClient.auth.signOut();
      return;
    }

    // ✅ actualizar last_login
    await supabaseClient.from("usuarios").update({ last_login: nowISO() }).eq("id", userId);

    // ✅ compatibilidad con tu app
    const userObj = {
      ...profile,
      user: userId,
      name: profile.nombre || profile.correo || "Usuario"
    };

    setAuth(true, userObj);
    document.body.classList.add("auth-ready");
    closeBackdrop(loginBackdrop);
    fillProfileHeader();
    toast("Sesión iniciada", `Bienvenido/a ${userObj.name}`);

  } catch (err) {
    console.error("Error en login:", err);
    toast("Error de red", "No se pudo conectar.");
  } finally {
    btnLog.disabled = false;
    btnLog.textContent = "Entrar";
  }
});
// REGISTER (PRODUCCIÓN A LA NUBE)
// REGISTER (SUPABASE AUTH + KYC + PROFILES)
$("btnRegister")?.addEventListener("click", async () => {
  const nombres = ($("regNombres")?.value || "").trim();
  const apellidos = ($("regApellidos")?.value || "").trim();
  const name = `${nombres} ${apellidos}`.trim();
  
  const rut = ($("regRut")?.value || "").trim();
  const country = $("regCountry")?.value || "Chile";
  
  const phoneCode = $("regPhoneCode")?.value || "+56";
  const phoneNum = ($("regPhoneNum")?.value || "").trim();
  const phone = `${phoneCode} ${phoneNum}`;
  
  const email = ($("regEmail")?.value || "").trim().toLowerCase();
  const pass = ($("regPass")?.value || "").trim();
  const terms = !!$("regTerms")?.checked;

  const carnetFrente = $("regCarnetFrente")?.files?.[0];
  const carnetDorso  = $("regCarnetDorso")?.files?.[0];

  if (!name || !email || !pass || !rut || !phone) {
    toast("Registro", "Completa todos los campos");
    return;
  }
  if (!carnetFrente || !carnetDorso) {
    toast("Identidad requerida", "Sube el carnet por ambos lados");
    return;
  }
  if (!terms) {
    toast("Registro", "Debes aceptar Términos y Privacidad");
    return;
  }
  if (rut && (!isRutFormatOK(rut) || !isRutDVOK(rut))) {
    toast("RUT inválido", "Formato o dígito verificador incorrecto");
    return;
  }
  if (!supabaseClient) {
    toast("Supabase", "No se inicializó Supabase");
    return;
  }

  const btnReg = $("btnRegister");
  btnReg.disabled = true;
  btnReg.textContent = "Creando cuenta... ⏳";
  toast("Procesando...", "No cierres la ventana.", 4000);

  try {
    // 1) Crear usuario en Supabase Auth (aquí quedan passwords seguros)
    const { data: signUpData, error: signUpErr } = await supabaseClient.auth.signUp({
      email,
      password: pass
    });

    if (signUpErr || !signUpData?.user) {
      throw signUpErr || new Error("No se pudo crear el usuario (Auth).");
    }

    const userId = signUpData.user.id;

    // 2) Subir documentos (ya autenticado)
    btnReg.textContent = "Subiendo carnet... ⏳";

    const extF = (carnetFrente.name.split(".").pop() || "jpg").toLowerCase();
    const extD = (carnetDorso.name.split(".").pop() || "jpg").toLowerCase();

    const pathFrente = `${userId}/carnet_frente_${Date.now()}.${extF}`;
    const pathDorso  = `${userId}/carnet_dorso_${Date.now()}.${extD}`;

    const up1 = await supabaseClient.storage.from("carnets").upload(pathFrente, carnetFrente, {
      upsert: true,
      contentType: carnetFrente.type || "image/jpeg"
    });
    if (up1.error) throw up1.error;

    const up2 = await supabaseClient.storage.from("carnets").upload(pathDorso, carnetDorso, {
      upsert: true,
      contentType: carnetDorso.type || "image/jpeg"
    });
    if (up2.error) throw up2.error;

    // Si tu bucket es PRIVADO, guarda los PATHS (recomendado).
    // Si tu bucket es PÚBLICO, puedes convertirlos a URL pública.
    // Guardaremos PATHS para máxima seguridad:
    const foto_carnet_frente = pathFrente;
    const foto_carnet_dorso  = pathDorso;

    // 3) Crear/guardar perfil en tabla profiles (no usuarios)
    btnReg.textContent = "Guardando perfil... ⏳";

    const profileRow = {
      id: userId,
      correo: email,
      nombre: name,
      rut,
      telefono: phone,
      pais: country,
      estado_cuenta: "Pendiente",
      rol: "Vendedor",
      foto_carnet_frente,
      foto_carnet_dorso,
      created_at: nowISO()
    };

    const { error: профErr } = await supabaseClient.from("usuarios").insert([profileRow]);
    if (профErr) throw профErr;

    // 4) Cerrar sesión: hasta que el admin apruebe
    await supabaseClient.auth.signOut();

    toast("¡Registro enviado! ✅", "Tu cuenta queda en revisión. Te avisaremos cuando esté aprobada.");
    showAuth("login");

  } catch (err) {
    console.error("Error en registro:", err);
    toast("Error ⚠️", (err?.message || "Hubo un problema. Intenta nuevamente."));
  } finally {
    btnReg.disabled = false;
    btnReg.textContent = "Crear cuenta";
  }
});

// splash + show login if needed
function startIntro(){
  if (isAuthed()){
    document.body.classList.add("auth-ready");
    if (splash) splash.style.display = "none";
    closeBackdrop(loginBackdrop);
    fillProfileHeader();
    return;
  }
  setTimeout(() => {
    if (splash) splash.style.display = "none";
    openBackdrop(loginBackdrop);
    showAuth("login");
    getUsers(); // ensure admin
  }, 1700);
}