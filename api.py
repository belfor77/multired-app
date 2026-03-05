import uvicorn
import re
import time
import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from supabase import create_client, Client
from selenium.webdriver.common.keys import Keys
# ===================== CONFIGURACIÓN SUPABASE =====================
SB_URL = "https://kaswrwdnkitiliejokbu.supabase.co"
SB_KEY = "sb_publishable_NElYaUu7PNYuh8HylySkBw_73uLAWbS"
supabase: Client = create_client(SB_URL, SB_KEY)

# ===================== CREAR LA APLICACIÓN =====================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================== FUNCIONES DE NAVEGADOR =====================
def format_rut_movistar(rut_raw: str) -> str:
    digits = re.sub(r"[^0-9kK]", "", str(rut_raw))
    if len(digits) >= 2:
        return digits[:-1] + "-" + digits[-1]
    return rut_raw

def extract_raw_html_text(driver) -> str:
    try:
        html = driver.page_source
        html = re.sub(r'<script.*?</script>', ' ', html, flags=re.IGNORECASE | re.DOTALL)
        html = re.sub(r'<style.*?</style>', ' ', html, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', html)
        return re.sub(r'\s+', ' ', text)
    except Exception as e:
        print(f"Error extrayendo HTML: {e}")
        return ""

driver_global = None

def iniciar_driver():
    global driver_global
    if driver_global is None:
        opts = ChromeOptions()
        driver_global = webdriver.Chrome(options=opts)
        driver_global.get("https://movistarclick.movistar.cl/preevaluator")
        print("\n>>> NAVEGADOR LISTO. INICIA SESIÓN MANUALMENTE PARA QUE EL ROBOT PUEDA TRABAJAR.")

def reiniciar_interfaz_movistar():
    global driver_global
    try:
        botones_nueva = driver_global.find_elements(By.XPATH, "//button[contains(., 'Nueva Consulta') or contains(., 'Nueva consulta')]")
        if len(botones_nueva) > 0:
            driver_global.execute_script("arguments[0].click();", botones_nueva[0])
            btn_no = WebDriverWait(driver_global, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='No']"))
            )
            driver_global.execute_script("arguments[0].click();", btn_no)
            time.sleep(1)
    except:
        pass

# ===================== EL ROBOT TRABAJADOR (BACKGROUND TASK) =====================
async def robot_vigilante():
    print("🤖 Robot Trabajador activado. Vigilando la sala de espera de Supabase...")
    
    while True:
        try:
            # 1. Buscar si hay 1 ticket de Factibilidad en estado "Nuevo"
            res = supabase.table("tickets").select("*").eq("tema", "Factibilidad").eq("estado", "Nuevo").limit(1).execute()
            tickets = res.data
            
            if len(tickets) > 0:
                ticket = tickets[0]
                t_id = ticket["id"]
                resumen = ticket.get("resumen", "")
                chat = ticket.get("chat", [])
                
                print(f"\n🎫 ¡TICKET ENCONTRADO! Procesando: {ticket['codigo']}")
                
                # 2. Avisarle a la web que empezamos a trabajar
                now_iso = datetime.now(timezone.utc).isoformat()
                chat.append({"from": "bot", "text": "🤖 Tomé tu solicitud. Extrayendo datos desde los sistemas oficiales...", "at": now_iso})
                supabase.table("tickets").update({"estado": "En proceso", "chat": chat}).eq("id", t_id).execute()
                
                # 3. Extraer RUT y consultar en Selenium
                if "RUT:" in resumen:
                    rut_a_consultar = resumen.split("RUT:")[1].strip()
                    rut_final = format_rut_movistar(rut_a_consultar)
                    
                    if driver_global is None:
                        resultado_texto = "❌ Error: El navegador del servidor no está iniciado."
                    else:
                        try:
                            # Escribir RUT en Movistar
                            input_rut = WebDriverWait(driver_global, 10).until(
                                EC.visibility_of_element_located((By.XPATH, "//input[@formcontrolname='rut']"))
                            )
                            input_rut.clear()
                            input_rut.send_keys(rut_final)
                            
                            # Clic Aceptar
                            btn = driver_global.find_element(By.XPATH, "//button[.//span[contains(text(), 'Aceptar')]]")
                            driver_global.execute_script("arguments[0].click();", btn)

                            # 1. Esperar inteligentemente a que carguen los datos
                            WebDriverWait(driver_global, 15).until(
                                EC.presence_of_element_located((By.XPATH, "//*[contains(translate(text(), 'É', 'é'), 'crédito') or contains(text(), 'Crédito') or contains(text(), 'Puntaje')]"))
                            )
                            time.sleep(1) # Pausa cortita extra para que los números terminen de renderizar

                            # 2. Extraer el texto VISUAL (Tal cual se ve en la pantalla, respetando saltos de línea)
                            raw_text = driver_global.find_element(By.TAG_NAME, "body").text

                            # 3. Buscar datos (Ahora el regex atrapará el formato perfectamente)
                            limite_val, ranking_val, deuda_val = "0", "N/A", "0"
                            
                            match_limite = re.search(r"L[ií]mite\s*Cr[eé]dito[^\d]+([\d\.]+)", raw_text, re.IGNORECASE)
                            if match_limite: limite_val = match_limite.group(1).replace(".", "")

                            match_puntaje = re.search(r"Puntaje\s*Cliente[^\d]+([\d]+)", raw_text, re.IGNORECASE)
                            if match_puntaje: ranking_val = match_puntaje.group(1)
                                
                            match_deuda = re.search(r"Deuda\s*interna[^\d]+([\d\.]+)", raw_text, re.IGNORECASE)
                            if match_deuda: deuda_val = match_deuda.group(1).replace(".", "")

                            # Armar respuesta bonita para el vendedor
                            resultado_texto = f"✅ **Factibilidad Exitosa**\n• Ranking: {ranking_val}\n• Límite Crédito: ${limite_val}\n• Deuda Interna: ${deuda_val}"
                            
                            # Preparar navegador para el siguiente ticket
                            reiniciar_interfaz_movistar()
                            
                        except Exception as e:
                            print(f"Error en Selenium: {e}")
                            resultado_texto = "❌ Ocurrió un error leyendo los datos. (Quizás la sesión de Movistar expiró)."
                            
                    # 4. Actualizar Ticket con resultado final
                    now_iso2 = datetime.now(timezone.utc).isoformat()
                    chat.append({"from": "bot", "text": resultado_texto, "at": now_iso2})
                    
                    supabase.table("tickets").update({
                        "estado": "Resuelto",
                        "chat": chat
                    }).eq("id", t_id).execute()
                    
                    print(f"✅ Ticket {ticket['codigo']} terminado y devuelto al vendedor.")
                    
                    # Descansar unos segundos para no parecer un robot agresivo
                    await asyncio.sleep(3)
                    
        except Exception as e:
            print(f"Error en el ciclo del vigilante: {e}")
            
        # Esperar 3 segundos antes de volver a mirar la base de datos
        await asyncio.sleep(2)

class AddressQuery(BaseModel):
    region: str
    comuna: str
    calle: str
    numero: str
    depto: str = ""

@app.post("/consultar_direccion")
def consultar_direccion(query: AddressQuery):
    global driver_global
    if driver_global is None:
        return {"status": "error", "message": "El navegador del robot no está iniciado."}
        
    try:
        print(f"\n--- INICIANDO CONSULTA DE DIRECCIÓN: {query.calle} {query.numero} ---")
        reiniciar_interfaz_movistar()
        time.sleep(2)

        # 1. INGRESAR RUT VÁLIDO
        try:
            print("⏳ Buscando campo RUT para desbloquear formulario...")
            rut_xpath = "//input[contains(@formcontrolname, 'rut') or contains(translate(@placeholder, 'RUT', 'rut'), 'rut') or contains(@data-placeholder, 'RUT')]"
            rut_inp = WebDriverWait(driver_global, 3).until(
                EC.presence_of_element_located((By.XPATH, rut_xpath))
            )
            driver_global.execute_script("arguments[0].removeAttribute('disabled');", rut_inp)
            driver_global.execute_script("arguments[0].focus();", rut_inp)
            
            rut_inp.send_keys(Keys.CONTROL + "a")
            rut_inp.send_keys(Keys.BACKSPACE)
            rut_inp.send_keys("21.243.324-1")
            print("✅ RUT válido ingresado. Esperando 4s para que Movistar valide...")
            time.sleep(4)
        except Exception as e:
            print(f"Nota: No se pudo ingresar RUT. {e}")

        # 2. Función para quitar tildes
        def limpiar_texto(t):
            if not t: return ""
            return t.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u').replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U')

    # 3. BUSCADOR INTELIGENTE DE OPCIONES (MODO BALANCEADO)
        def llenar_campo(nombre_humano, texto_original, id_angular):
            if not texto_original: return
            texto = limpiar_texto(texto_original)
            print(f"⏳ Escribiendo en '{nombre_humano}': {texto}...")
            try:
                xpath = f"//input[contains(translate(@data-placeholder, 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚ', 'abcdefghijklmnopqrstuvwxyzaeiou'), '{id_angular}') or contains(translate(@placeholder, 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚ', 'abcdefghijklmnopqrstuvwxyzaeiou'), '{id_angular}') or contains(translate(@formcontrolname, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{id_angular}')]"
                inp = WebDriverWait(driver_global, 5).until(EC.presence_of_element_located((By.XPATH, xpath)))
                driver_global.execute_script("arguments[0].scrollIntoView({block: 'center'});", inp)
                driver_global.execute_script("arguments[0].removeAttribute('disabled'); arguments[0].removeAttribute('readonly'); arguments[0].focus();", inp)
                
                inp.send_keys(Keys.CONTROL + "a")
                inp.send_keys(Keys.BACKSPACE)
                time.sleep(0.2)
                
                # Escribir la palabra de golpe, pero darle tiempo a Angular a reaccionar
                inp.send_keys(texto)
                time.sleep(0.3)
                inp.send_keys(" ")
                time.sleep(0.1)
                inp.send_keys(Keys.BACKSPACE)
                
                # 🛑 EL FRENO DE MANO: Dejamos respirar a Angular para que arme la lista real.
                time.sleep(1.5)
                
                try: WebDriverWait(driver_global, 4).until(EC.presence_of_element_located((By.XPATH, "//mat-option | //*[@role='option']")))
                except: pass 
                
                try:
                    opciones = driver_global.find_elements(By.XPATH, "//mat-option | //*[@role='option']")
                    opcion_elegida = next((opt for opt in opciones if texto.upper() in opt.text.upper()), opciones[0] if len(opciones) > 0 else None)
                    
                    if opcion_elegida:
                        driver_global.execute_script("arguments[0].click();", opcion_elegida)
                        time.sleep(0.5) # Pausa segura después del clic
                    else:
                        inp.send_keys(Keys.ENTER)
                        time.sleep(0.5)
                except:
                    inp.send_keys(Keys.ARROW_DOWN)
                    inp.send_keys(Keys.ENTER)
                    time.sleep(0.5)
            except Exception as e:
                raise Exception(f"No se pudo interactuar con {nombre_humano}.")

        # 4. TRADUCTOR DE REGIÓN
        region_movistar = query.region
        if region_movistar.upper() == "METROPOLITANA":
            region_movistar = "METROPOLITANA DE SANTIAGO"

        # 5. LLENAR FORMULARIO
        llenar_campo("Región", region_movistar, "regi")
        llenar_campo("Comuna", query.comuna, "comun")
        llenar_campo("Calle", query.calle, "calle")
        llenar_campo("Número", query.numero, "numer")
        if query.depto:
            llenar_campo("Depto", query.depto, "depto")
        
        # 6. CLICK ACEPTAR
        print("⏳ Buscando botón Aceptar...")
        botones = driver_global.find_elements(By.TAG_NAME, "button")
        btn_aceptar = None
        for b in botones:
            if "aceptar" in b.text.lower():
                btn_aceptar = b
                break
        
        if btn_aceptar:
            driver_global.execute_script("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", btn_aceptar)
            print("✅ Clic en Aceptar realizado.")
        else:
            raise Exception("No se encontró el botón Aceptar")
        
       # 7. ESPERAR RESULTADOS (Buscador Visual Inmune a Angular)
        print("⏳ Esperando resultados de factibilidad (modo rápido)...")
        try:
            WebDriverWait(driver_global, 20).until(
                lambda d: "Velocidad" in d.find_element(By.TAG_NAME, "body").text or "tecnología" in d.find_element(By.TAG_NAME, "body").text
            )
            time.sleep(1.5) # Pausa mínima para acelerar captura
        except:
            raise Exception("La página de Movistar tardó demasiado en cargar los resultados.")
        
        # 8. EXTRAER DATOS (Modo Atrapa-Todo)
        raw_text = driver_global.find_element(By.TAG_NAME, "body").text
        
        def extraer(patron, default="N/A"):
            match = re.search(patron, raw_text, re.IGNORECASE)
            return match.group(1).strip() if match else default

        # Usamos ([^\n]+) para atrapar todo lo que diga en esa línea (ej: "2000MB" o "2 GIGAS")
        tecnologia = extraer(r"Tipo tecnolog[ií]a\s*([^\n]+)")
        velocidad = extraer(r"Velocidad Comercial\s*([^\n]+)")
        fibra = extraer(r"Factibilidad fibra\s*(SI|NO)")
        categoria = extraer(r"Categor[ií]a\s*([^\n]+)")
        cobertura_4g = extraer(r"Cobertura 4G\s*(SI|NO)")
        
        bloqueo = "Sin Bloqueo"
        if re.search(r"Bloqueo por Tenencia", raw_text, re.IGNORECASE):
            bloqueo = "Bloqueado por Tenencia"

        print(f"✅ ¡Extracción exitosa! Fibra: {fibra} | Velocidad: {velocidad}")
        
        return {
            "status": "success",
            "data": {
                "fibra": fibra,
                "tecnologia": tecnologia,
                "velocidad": velocidad,
                "categoria": categoria,
                "internet_4g": cobertura_4g,
                "bloqueo": bloqueo
            }
        }

    except Exception as e:
        error_msg = str(e)
        # Si Selenium lanza un error vacío o un Stacktrace feo, lo cambiamos por un mensaje claro
        if not error_msg or "Message:" in error_msg:
            error_msg = "La página tardó en responder o no se encontró factibilidad."
            
        print(f"❌ Error en consulta dirección: {error_msg}")
        return {"status": "error", "message": error_msg}# ===================== INICIO DEL SERVIDOR Y RUTAS =====================
@app.on_event("startup")
async def startup_event():
    iniciar_driver()
    # Arrancar el robot en segundo plano al encender la API
    asyncio.create_task(robot_vigilante())

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)