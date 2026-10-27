'use strict';
// =====================================================================
//  Centro de Control — piezas básicas: atajos, fechas, guardado en el navegador,
//  ventanas, avisos y cambio de sección.
// =====================================================================

// ---------- atajos ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const quitarTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Quita el emoji del principio de un estado o prioridad («✅Completada» → «Completada»)
const sinEmoji = (s) => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
const emojiDe = (s) => (String(s || '').match(/^[^\p{L}\p{N}]+/u) || [''])[0].replace(/​/g, '').trim();
function el(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  });
  hijos.flat().forEach(h => { if (h != null && h !== false) e.append(h.nodeType ? h : document.createTextNode(h)); });
  return e;
}
function descargar(blob, nombre) {
  const a = el('a', { href: URL.createObjectURL(blob), download: nombre });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// ---------- fechas (siempre «AAAA-MM-DD» en hora local) ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_C = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const may = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const aStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aFecha = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const hoy = () => aStr(new Date());
const sumarDias = (s, n) => { const d = aFecha(s); d.setDate(d.getDate() + n); return aStr(d); };
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
const diaSemana = (s) => (aFecha(s).getDay() + 6) % 7; // 0 = lunes
const lunesDe = (s) => sumarDias(s, -diaSemana(s));
const mesDe = (s) => s.slice(0, 7);
const primeroMes = (ym) => ym + '-01';
const sumarMeses = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const diasDelMes = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const nombreMes = (ym) => { const [y, m] = ym.split('-').map(Number); return `${may(MESES[m - 1])} ${y}`; };
const fechaLarga = (s) => { const d = aFecha(s); return `${may(DIAS[diaSemana(s)])} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fechaCorta = (s) => { if (!s) return ''; const d = aFecha(s); return `${d.getDate()} ${MESES_C[d.getMonth()]}`; };
const fechaDM = (s) => { if (!s) return ''; const [, m, d] = s.split('-'); return `${d}/${m}`; };
// Rejilla de un mes: semanas de lunes a domingo, con los días de fuera del mes
function semanasDelMes(ym) {
  const ini = lunesDe(primeroMes(ym));
  const fin = `${ym}-${pad(diasDelMes(ym))}`;
  const semanas = [];
  for (let l = ini; l <= fin; l = sumarDias(l, 7)) semanas.push([0, 1, 2, 3, 4, 5, 6].map(i => sumarDias(l, i)));
  return semanas;
}

// ---------- guardado en el navegador (IndexedDB) ----------
const Store = (() => {
  let dbP = null;
  const abrir = () => dbP || (dbP = new Promise((res, rej) => {
    const r = indexedDB.open('centro', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const op = async (modo, fn) => { const db = await abrir(); return new Promise((res, rej) => { const t = db.transaction('kv', modo); const r = fn(t.objectStore('kv')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  return {
    get: (k) => op('readonly', s => s.get(k)),
    set: (k, v) => op('readwrite', s => s.put(v, k)),
    del: (k) => op('readwrite', s => s.delete(k)),
  };
})();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// D = todos tus datos. Se guarda solo, medio segundo después de cada cambio.
let D = null;
const alGuardar = [];
const guardarYa = async () => { if (!D) return; D.cambiado = new Date().toISOString(); await Store.set('datos', D); alGuardar.forEach(f => { try { f(); } catch (e) { console.error(e); } }); };
const guardarPronto = debounce(guardarYa, 400);
function cambio(repintar = true) { guardarPronto(); if (repintar) repintarPronto(); }
window.addEventListener('pagehide', () => { guardarYa(); });

// Preferencias de este aparato (qué sección, filtros…): no se sincronizan
const UI = (() => { try { return JSON.parse(localStorage.getItem('centro:ui')) || {}; } catch (e) { return {}; } })();
const guardarUI = () => { try { localStorage.setItem('centro:ui', JSON.stringify(UI)); } catch (e) {} };

// ---------- avisos ----------
function aviso(texto, accion) {
  const a = el('div', { class: 'aviso' }, el('span', {}, texto));
  if (accion) a.append(el('button', { onclick: () => { accion.fn(); a.remove(); } }, accion.t));
  $('#avisos').append(a);
  setTimeout(() => a.classList.add('fuera'), accion ? 6000 : 3200);
  setTimeout(() => a.remove(), accion ? 6500 : 3700);
}

// ---------- ventanas ----------
function modal(html, { alAbrir, clase = '', alCerrar } = {}) {
  const velo = el('div', { class: 'velo' });
  const caja = el('div', { class: 'modal ' + clase, role: 'dialog', 'aria-modal': 'true', html });
  velo.append(caja); document.body.append(velo);
  const cerrar = () => { velo.remove(); document.removeEventListener('keydown', tecla); if (alCerrar) alCerrar(); };
  const tecla = (e) => { if (e.key === 'Escape' && document.body.lastElementChild === velo) cerrar(); };
  document.addEventListener('keydown', tecla);
  velo.addEventListener('mousedown', (e) => { if (e.target === velo) velo.dataset.fuera = '1'; });
  velo.addEventListener('mouseup', (e) => { if (e.target === velo && velo.dataset.fuera) cerrar(); delete velo.dataset.fuera; });
  $$('[data-cerrar]', caja).forEach(b => b.onclick = cerrar);
  if (alAbrir) alAbrir(caja, cerrar);
  const primero = $('[autofocus]', caja) || $('input:not([type=checkbox]),textarea,select', caja);
  if (primero && matchMedia('(min-width: 761px)').matches) setTimeout(() => primero.focus(), 30);
  return cerrar;
}
function preguntar(titulo, texto, ok = 'Aceptar', peligro = false) {
  return new Promise(res => {
    let r = false;
    modal(`<h3>${esc(titulo)}</h3>${texto ? `<p class="suave">${esc(texto)}</p>` : ''}<div class="pie"><button class="btn" data-cerrar>Cancelar</button><button class="btn ${peligro ? 'peligro' : 'prim'}" id="pq-ok">${esc(ok)}</button></div>`,
      { alAbrir: (m, cerrar) => { $('#pq-ok', m).onclick = () => { r = true; cerrar(); }; }, alCerrar: () => res(r) });
  });
}
function pedirTexto(titulo, valor = '', etiqueta = '') {
  return new Promise(res => {
    let r = null;
    modal(`<h3>${esc(titulo)}</h3><label class="campo">${etiqueta ? `<span>${esc(etiqueta)}</span>` : ''}<input id="pt-v" value="${esc(valor)}" autofocus></label><div class="pie"><button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="pt-ok">Aceptar</button></div>`,
      { alAbrir: (m, cerrar) => { const ok = () => { r = $('#pt-v', m).value.trim(); cerrar(); }; $('#pt-ok', m).onclick = ok; $('#pt-v', m).onkeydown = (e) => { if (e.key === 'Enter') ok(); }; }, alCerrar: () => res(r) });
  });
}
// Menú pequeño junto a un botón
function menuEmergente(ancla, opciones) {
  $$('.menu-emergente').forEach(m => m.remove());
  const m = el('div', { class: 'menu-emergente' });
  opciones.filter(Boolean).forEach(o => m.append(o === '-' ? el('hr') : el('button', { class: o.peligro ? 'peligro' : '', onclick: () => { m.remove(); o.fn(); } }, o.t)));
  document.body.append(m);
  const r = ancla.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  setTimeout(() => document.addEventListener('click', function f(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', f, true); } }, true));
}

// ---------- secciones ----------
const VISTAS = {};
let vistaActual = null;
function irA(vista, opciones) {
  if (!VISTAS[vista]) vista = 'inicio';
  if (opciones) Object.assign(UI, opciones.ui || {});
  vistaActual = vista; UI.vista = vista; guardarUI();
  $$('.vista').forEach(v => v.classList.toggle('on', v.id === 'v-' + vista));
  $$('#rail button[data-vista]').forEach(b => b.classList.toggle('on', b.dataset.vista === vista));
  pintar();
  $('#main').scrollTop = 0;
  if (location.hash !== '#' + vista) history.replaceState(null, '', '#' + vista);
}
function pintar() {
  if (!vistaActual || !D) return;
  const cont = $('#v-' + vistaActual);
  const y = cont.scrollTop;
  try { VISTAS[vistaActual](cont); } catch (e) { console.error(e); cont.innerHTML = `<div class="pagina"><p>Algo ha fallado al pintar esta sección: ${esc(e.message)}</p></div>`; }
  cont.scrollTop = y;
}
const repintarPronto = debounce(() => { if (!document.querySelector('.velo')) pintar(); else repintarAlCerrar = true; }, 30);
let repintarAlCerrar = false;
new MutationObserver(() => { if (repintarAlCerrar && !document.querySelector('.velo')) { repintarAlCerrar = false; pintar(); } }).observe(document.body, { childList: true });

// Cabecera común de cada sección
function cabecera(titulo, sub, acciones = '') {
  return `<header class="cab-pag"><div><h1>${titulo}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="acciones-pag">${acciones}</div></header>`;
}
function pestanas(lista, actual, clave) {
  return `<div class="pestanas" data-clave="${clave}">${lista.map(([k, t]) => `<button data-p="${k}" class="${k === actual ? 'on' : ''}">${t}</button>`).join('')}</div>`;
}
function enlazarPestanas(cont) {
  $$('.pestanas[data-clave]', cont).forEach(p => p.onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; UI[p.dataset.clave] = b.dataset.p; guardarUI(); pintar(); });
}
