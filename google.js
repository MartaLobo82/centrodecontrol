'use strict';
// =====================================================================
//  Centro de Control — Google: sincronizar con Google Drive (móvil y
//  ordenador iguales).
//  Todo se guarda en «centro.json», en la carpeta privada de la app en
//  tu Drive (no se ve entre tus archivos). El ID de cliente puede ser el
//  mismo que el de Novelia Studio: las dos apps viven en la misma web.
// =====================================================================

const GOOGLE_CLIENT_ID = ''; // se puede dejar fijo aquí; si no, se pega en Ajustes
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const ARCHIVO = 'centro.json';

const GG = {
  e: (() => { try { return JSON.parse(localStorage.getItem('centro:google')) || {}; } catch (e) { return {}; } })(),
  guardarE() { try { localStorage.setItem('centro:google', JSON.stringify(this.e)); } catch (e) {} },
  get clientId() { return GOOGLE_CLIENT_ID || this.e.clientId || ''; },
  token: null, caduca: 0, ocupado: false, aplicando: false,
  listo() { return !!(this.e.conectado && this.clientId); },
};
if (!GG.e.disp) { GG.e.disp = uid(); GG.guardarE(); }
try { const t = JSON.parse(localStorage.getItem('centro:token')); if (t && t.caduca > Date.now() + 60000) { GG.token = t.token; GG.caduca = t.caduca; } } catch (e) {}

// ---------- permiso de Google ----------
function cargarGIS() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((res, rej) => { const s = el('script', { src: 'https://accounts.google.com/gsi/client', async: true }); s.onload = res; s.onerror = () => rej(new Error('sin conexión')); document.head.append(s); });
}
let clienteToken = null, esperandoToken = null;
async function pedirToken(interactivo) {
  if (GG.token && GG.caduca > Date.now() + 60000) return GG.token;
  if (!GG.clientId) throw new Error('falta-id');
  await cargarGIS();
  if (!clienteToken) clienteToken = google.accounts.oauth2.initTokenClient({
    client_id: GG.clientId, scope: SCOPES,
    callback: (r) => { const w = esperandoToken; esperandoToken = null; if (!w) return; if (r.error) w.rej(new Error(r.error)); else { GG.token = r.access_token; GG.caduca = Date.now() + (r.expires_in || 3600) * 1000; try { localStorage.setItem('centro:token', JSON.stringify({ token: GG.token, caduca: GG.caduca })); } catch (e) {} w.res(GG.token); } },
    error_callback: (e) => { const w = esperandoToken; esperandoToken = null; if (w) w.rej(new Error((e && e.type) || 'cancelado')); },
  });
  return new Promise((res, rej) => { esperandoToken = { res, rej }; clienteToken.requestAccessToken({ prompt: interactivo ? 'consent' : '' }); });
}
async function api(url, opts = {}) {
  const t = await pedirToken(false);
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
  if (r.status === 401) { GG.token = null; localStorage.removeItem('centro:token'); throw new Error('token'); }
  if (r.status === 403) throw new Error('permiso');
  if (!r.ok) throw new Error('google ' + r.status);
  return r;
}
const hayToken = () => GG.token && GG.caduca > Date.now() + 30000;

// ---------- Drive ----------
const huella = (v) => { const s = JSON.stringify(v); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); };
const sinMarca = () => { const c = { ...D }; delete c.cambiado; return c; };
async function archivoRemoto() {
  const r = await api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'${ARCHIVO}'&fields=files(id,modifiedTime,appProperties)&orderBy=modifiedTime%20desc`);
  const j = await r.json(); return (j.files || [])[0] || null;
}
async function subir(remoto) {
  await guardarYa();
  const fecha = new Date().toISOString();
  const cuerpo = JSON.stringify({ app: 'centro', tipo: 'sincro', version: 1, fecha, disp: GG.e.disp, datos: D });
  const props = { fecha, disp: GG.e.disp };
  const lim = 'centro' + uid();
  const meta = remoto ? { appProperties: props } : { name: ARCHIVO, parents: ['appDataFolder'], appProperties: props };
  const multi = `--${lim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${lim}\r\nContent-Type: application/json\r\n\r\n${cuerpo}\r\n--${lim}--`;
  await api(remoto ? `https://www.googleapis.com/upload/drive/v3/files/${remoto.id}?uploadType=multipart` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: remoto ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${lim}` }, body: multi });
  GG.e.base = fecha; GG.e.sucio = 0; GG.e.ultima = Date.now(); GG.e.huella = huella(sinMarca()); GG.guardarE();
}
async function traerRemoto(remoto) {
  const r = await api(`https://www.googleapis.com/drive/v3/files/${remoto.id}?alt=media`);
  const j = await r.json();
  if (!j || !j.datos) throw new Error('archivo');
  GG.aplicando = true;
  D = completar(j.datos);
  await Store.set('datos', D);
  GG.aplicando = false;
  GG.e.base = j.fecha; GG.e.sucio = 0; GG.e.ultima = Date.now(); GG.e.huella = huella(sinMarca()); GG.guardarE();
  aplicarTema(); pintar();
}
async function sincronizar(manual) {
  if (!GG.listo() || GG.ocupado || !navigator.onLine || $('#sc-este')) return;
  if (!hayToken() && !manual) { estadoSincro('Toca para conectar'); return; }
  GG.ocupado = true; estadoSincro('Sincronizando…');
  try {
    const remoto = await archivoRemoto();
    const fechaR = remoto && remoto.appProperties && remoto.appProperties.fecha;
    const otro = remoto && fechaR !== GG.e.base;
    if (!remoto) await subir(null);
    else if (otro && !GG.e.sucio) { estadoSincro('Trayendo cambios…'); await traerRemoto(remoto); aviso('Traído lo último de Google Drive'); }
    else if (otro && GG.e.sucio) { GG.ocupado = false; estadoSincro('Hay cambios en los dos sitios'); return conflicto(remoto); }
    else if (GG.e.sucio) await subir(remoto);
    estadoSincro('');
    if (manual) aviso('Sincronizado con Google Drive');
  } catch (e) {
    const m = e.message;
    estadoSincro(m === 'falta-id' ? 'Falta configurar' : /token|popup|cancel|access_denied|interaction/.test(m) ? 'Toca para conectar' : !navigator.onLine ? 'Sin conexión' : 'No se ha podido');
    if (manual) aviso(m === 'falta-id' ? 'Falta el ID de cliente de Google (Ajustes)' : 'No he podido sincronizar. Vuelve a intentarlo.');
  } finally { GG.ocupado = false; }
}
function conflicto(remoto) {
  const f = new Date(remoto.appProperties.fecha).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  modal(`<h3>Hay cambios en los dos sitios</h3><p class="suave">Has cambiado cosas aquí y en otro aparato (el ${esc(f)}). No puedo juntarlas, así que dime con cuál me quedo. La otra te la descargo como copia, para que no pierdas nada.</p>
    <div class="pie" style="flex-wrap:wrap"><button class="btn" data-cerrar>Ahora no</button><button class="btn" id="sc-otro">Lo del otro aparato</button><button class="btn prim" id="sc-este">Lo de este aparato</button></div>`, {
    alAbrir: (m, cerrar) => {
      $('#sc-este', m).onclick = async () => { cerrar(); try { GG.ocupado = true; const r = await api(`https://www.googleapis.com/drive/v3/files/${remoto.id}?alt=media`); descargar(await r.blob(), `Centro de Control · lo del otro aparato ${hoy()}.json`); await subir(remoto); aviso('Guardado lo de este aparato'); } catch (e) { aviso('No he podido subirlo'); } finally { GG.ocupado = false; estadoSincro(''); } };
      $('#sc-otro', m).onclick = async () => { cerrar(); try { await hacerCopia('lo de este aparato'); await traerRemoto(remoto); aviso('Traído lo del otro aparato'); } catch (e) { aviso('No he podido traerlo'); } };
    }
  });
}
const subirPronto = debounce(() => { if (GG.listo() && hayToken()) sincronizar(); }, 20000);
alGuardar.push(() => {
  if (GG.aplicando || !GG.e.conectado) return;
  const h = huella(sinMarca());
  if (h !== GG.e.huella) { if (!GG.e.sucio) { GG.e.sucio = Date.now(); GG.guardarE(); } estadoSincro(''); subirPronto(); }
});
async function conectar() {
  try { await pedirToken(!GG.e.conectado); GG.e.conectado = true; GG.guardarE(); await sincronizar(true); }
  catch (e) { aviso(e.message === 'falta-id' ? 'Falta el ID de cliente de Google: míralo en Ajustes' : 'No se ha conectado con Google'); estadoSincro(e.message === 'falta-id' ? 'Falta configurar' : 'Toca para conectar'); }
}
function estadoSincro(t) {
  let b = $('#sincro-pill');
  if (!GG.e.conectado) { if (b) b.remove(); return; }
  if (!b) { b = el('button', { id: 'sincro-pill', class: 'sincro-pill', title: 'Sincronizar con Google Drive', onclick: () => conectar() }); document.body.append(b); }
  const hace = GG.e.ultima ? Math.round((Date.now() - GG.e.ultima) / 60000) : null;
  b.textContent = t || (GG.e.sucio ? '☁ Cambios sin subir' : hace === null ? '☁ Drive' : `☁ Al día${hace < 1 ? '' : hace < 60 ? ` · hace ${hace} min` : ''}`);
  b.classList.toggle('alerta', /conectar|configurar|podido|dos sitios/.test(t));
  b.classList.toggle('girando', /…$/.test(t));
}

// ---------- tarjeta en Ajustes ----------
function tarjetaGoogle() {
  const E = GG.e;
  return `<section class="tarjeta" id="aj-google"><h2>Sincronizar móvil y ordenador</h2>
    ${E.conectado ? `<p style="margin-top:0">Conectada a Google Drive.${E.ultima ? ` Última sincronización: ${new Date(E.ultima).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''}${E.sucio ? ' <b>Hay cambios sin subir.</b>' : ''}</p>
      <div class="fila-btns"><button class="btn prim" id="gg-ya">Sincronizar ahora</button><button class="btn" id="gg-off">Desconectar este aparato</button></div>`
    : `<p style="margin-top:0">Guarda el Centro de Control en tu Google Drive (en una carpeta privada de la app) para tenerlo igual en el móvil y en el ordenador.</p>
      <button class="btn prim" id="gg-on"${GG.clientId ? '' : ' disabled'}>Conectar con Google Drive</button>`}
    <details style="margin-top:12px"${GG.clientId ? '' : ' open'}><summary class="suave" style="cursor:pointer">${GG.clientId ? 'Configuración de Google' : 'Antes de conectar: configurar Google (una sola vez)'}</summary>
      <p class="suave" style="font-size:13px">Si ya tienes un ID de cliente de Google para otra app en esta misma web, puedes usar el mismo.</p>
      <ol class="suave pasos-g">
        <li>Entra en <b>console.cloud.google.com</b> con tu cuenta y crea un proyecto (o usa el de tus otras apps).</li>
        <li>En «APIs y servicios» › «Biblioteca», habilita <b>Google Drive API</b>.</li>
        <li>En «Pantalla de consentimiento de OAuth»: tipo <b>Externo</b>, tu correo, y en «Usuarios de prueba» añade tu cuenta.</li>
        <li>En «Credenciales» › «Crear credenciales» › <b>ID de cliente de OAuth</b> › <b>Aplicación web</b>. En «Orígenes de JavaScript autorizados» pon <b>${esc(location.origin)}</b>.</li>
        <li>Copia el <b>ID de cliente</b> (acaba en .apps.googleusercontent.com) y pégalo aquí.</li></ol>
      <label class="campo"><span>ID de cliente de Google</span><input id="gg-id" value="${esc(E.clientId || GOOGLE_CLIENT_ID)}" placeholder="123456-abc.apps.googleusercontent.com"${GOOGLE_CLIENT_ID ? ' disabled' : ''}></label>
      <p class="tenue" style="font-size:12px;margin:0">Google te dirá que la app «no está verificada»: es normal, es tu propia app. Pulsa «Continuar».</p></details></section>`;
}
function enlazarGoogle(cont) {
  const c = $('#aj-google', cont); if (!c) return;
  const rehacer = () => pintar();
  if ($('#gg-id', c)) $('#gg-id', c).onchange = (e) => { GG.e.clientId = e.target.value.trim(); clienteToken = null; GG.guardarE(); rehacer(); };
  if ($('#gg-on', c)) $('#gg-on', c).onclick = async () => {
    if (!(await preguntar('¿Conectar con Google?', 'Si en tu Drive ya hay datos del Centro de Control de otro aparato, me los traigo y sustituye a lo que hay aquí (antes te descargo una copia). Si no hay nada, subo lo de este aparato.', 'Conectar'))) return;
    try {
      await pedirToken(true);
      const remoto = await archivoRemoto();
      GG.e.conectado = true;
      if (remoto) { await hacerCopia('antes de sincronizar'); GG.e.base = null; GG.e.sucio = 0; GG.guardarE(); await traerRemoto(remoto); aviso('Traído de Google Drive'); }
      else { GG.e.sucio = Date.now(); GG.guardarE(); await sincronizar(true); }
      rehacer();
    } catch (e) { aviso('No se ha conectado con Google'); }
  };
  if ($('#gg-ya', c)) $('#gg-ya', c).onclick = async () => { await conectar(); rehacer(); };
    if ($('#gg-off', c)) $('#gg-off', c).onclick = () => { GG.e.conectado = false; GG.token = null; localStorage.removeItem('centro:token'); GG.guardarE(); estadoSincro(''); rehacer(); aviso('Desconectado. Tus datos siguen aquí y en Drive.'); };
}

// ---------- arranque ----------
function arrancarGoogle() {
  if (!GG.e.conectado) return;
  estadoSincro('');
  const alDia = () => sincronizar();
  if (hayToken()) alDia();
  else {
    estadoSincro('Toca para conectar');
    // Google necesita un toque para renovar el permiso: el primero que des en la app
    document.addEventListener('click', function uno() { document.removeEventListener('click', uno, true); pedirToken(false).then(alDia).catch(() => {}); }, true);
  }
  setInterval(() => { if (!document.hidden && hayToken()) sincronizar(); }, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && hayToken()) sincronizar(); else if (document.hidden && GG.e.sucio && hayToken()) sincronizar(); });
}
