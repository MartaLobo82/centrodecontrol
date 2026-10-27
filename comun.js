'use strict';
// Centro de Control — formularios, fichas, tablas y gráficos comunes
function formulario(obj, campos) {
  return `<div class="form">${campos.map(c => {
    if (c.tipo === 'sep') return `<h4 class="sep-form">${esc(c.t)}</h4>`;
    const v = obj[c.k] ?? '';
    const id = 'f-' + c.k;
    const cl = `campo ${c.ancho || ''}`;
    let input;
    if (c.tipo === 'area') input = `<textarea id="${id}" data-k="${c.k}" rows="${c.filas || 3}" placeholder="${esc(c.ph || '')}">${esc(v)}</textarea>`;
    else if (c.tipo === 'select') {
      const ops = [...(c.op || [])];
      if (v && !ops.includes(v)) ops.unshift(v);
      input = `<select id="${id}" data-k="${c.k}">${c.vacio !== false ? '<option value=""></option>' : ''}${ops.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else if (c.tipo === 'check') return `<label class="${cl} check"><input type="checkbox" id="${id}" data-k="${c.k}"${v ? ' checked' : ''}><span>${esc(c.t)}</span></label>`;
    else if (c.tipo === 'lista') input = `<input id="${id}" data-k="${c.k}" value="${esc(v)}" list="${id}-l" placeholder="${esc(c.ph || '')}"><datalist id="${id}-l">${(c.op || []).map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
    else input = `<input id="${id}" data-k="${c.k}" type="${{ fecha: 'date', hora: 'time', num: 'number' }[c.tipo] || 'text'}"${c.tipo === 'num' ? ' step="any" inputmode="decimal"' : ''} value="${esc(v)}" placeholder="${esc(c.ph || '')}"${c.k === 'tarea' || c.k === 'titulo' || c.k === 'texto' ? ' autofocus' : ''}>`;
    return `<label class="${cl}"><span>${esc(c.t)}</span>${input}${c.ayuda ? `<small>${c.ayuda}</small>` : ''}</label>`;
  }).join('')}</div>`;
}
function leerFormulario(m, campos, obj) {
  campos.forEach(c => {
    if (!c.k) return;
    const i = $(`[data-k="${c.k}"]`, m); if (!i) return;
    let v = c.tipo === 'check' ? i.checked : i.value;
    if (c.tipo === 'num') v = v === '' ? '' : Number(v);
    if (typeof v === 'string') v = v.trim();
    if (v === '' || v === false) delete obj[c.k]; else obj[c.k] = v;
  });
  return obj;
}
// Ficha genérica: título, campos y botones (Guardar, Borrar, extras)
function ficha({ titulo, obj, campos, onGuardar, onBorrar, extras = [], clase = '' }) {
  const copia = JSON.parse(JSON.stringify(obj));
  modal(`<h3>${titulo}</h3>${formulario(copia, campos)}
    <div class="pie">${onBorrar ? '<button class="btn peligro-suave" id="fi-borrar">Borrar</button>' : ''}<span class="hueco"></span>
    ${extras.map((x, i) => `<button class="btn" data-extra="${i}">${x.t}</button>`).join('')}
    <button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="fi-ok">Guardar</button></div>`, {
    clase: 'ficha ' + clase,
    alAbrir: (m, cerrar) => {
      const ok = () => { const r = leerFormulario(m, campos, copia); if (onGuardar(r) !== false) cerrar(); };
      $('#fi-ok', m).onclick = ok;
      m.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ok(); if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); ok(); } });
      if (onBorrar) $('#fi-borrar', m).onclick = async () => { if (await onBorrar()) cerrar(); };
      $$('[data-extra]', m).forEach(b => b.onclick = () => { const r = leerFormulario(m, campos, copia); extras[+b.dataset.extra].fn(r, cerrar, m); });
      campos.forEach(c => { if (c.alCambiar) { const i = $(`[data-k="${c.k}"]`, m); if (i) i.addEventListener('change', () => c.alCambiar(i.value, m)); } });
    }
  });
}

// ---------- tareas ----------
function borrarConDeshacer(lista, id, texto) {
  const i = D[lista].findIndex(o => o.id === id); if (i < 0) return;
  const [o] = D[lista].splice(i, 1);
  cambio();
  aviso(texto, { t: 'Deshacer', fn: () => { D[lista].splice(i, 0, o); cambio(); } });
}

function elegirArchivo(fn) {
  const i = el('input', { type: 'file', accept: '.json,application/json' });
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    try { fn(JSON.parse(await f.text())); } catch (e) { aviso('No he podido leer ese archivo'); }
  };
  i.click();
}
const PALETAS = [
  ['Terracota', '#9c4f35'], ['Salvia', '#5d7a62'], ['Bosque', '#2f5d50'], ['Rosa', '#b0506f'], ['Frambuesa', '#a3324f'],
  ['Lavanda', '#7462a3'], ['Azul', '#3d6a9e'], ['Petróleo', '#1f6b72'], ['Mostaza', '#a1761a'], ['Grafito', '#45464a'],
];
const hexARgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const rgbAHex = (r) => '#' + r.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const mezclar = (a, b, p) => { const x = hexARgb(a), y = hexARgb(b); return rgbAHex(x.map((v, i) => v * p + y[i] * (1 - p))); };
const luz = (h) => { const [r, g, b] = hexARgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const contraste = (a, b) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
// Texto que se lee bien encima de un color
const textoSobre = (h) => contraste(h, '#ffffff') >= contraste(h, '#1c1916') ? '#ffffff' : '#1c1916';
function coloresDe() { return (D && D.ajustes.colores) || {}; }

// ---------- tema y color principal ----------
const COLOR_ACENTO = '#7462a3';
function aplicarTema() {
  const t = D && D.ajustes.tema;
  const noche = t === 'noche' || (t !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = noche ? 'noche' : 'claro';
  const base = coloresDe().acento || COLOR_ACENTO;
  let ac = base;
  if (noche) { ac = mezclar(base, '#ffffff', .62); if (contraste(ac, '#24211d') < 4.5) ac = mezclar(base, '#ffffff', .45); }
  const claro = noche ? mezclar(base, '#1c1916', .3) : mezclar(base, '#ffffff', .16);
  let st = document.getElementById('estilo-colores');
  if (!st) { st = document.createElement('style'); st.id = 'estilo-colores'; document.head.append(st); }
  st.textContent = `:root, :root[data-theme="noche"] { --acento: ${ac}; --acento-claro: ${claro}; --sobre-acento: ${textoSobre(ac)}; }`;
  const m = $('meta[name=theme-color]'); if (m) m.content = noche ? '#1c1916' : base;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema());

// ---------- piezas de página ----------
function selectorAnio(clave = 'anio') {
  const Y = UI[clave] || new Date().getFullYear();
  return `<div class="nav-cal"><button class="icono" data-anio="-1" aria-label="Año anterior">‹</button><h2 class="titulo-cal">${Y}</h2><button class="icono" data-anio="1" aria-label="Año siguiente">›</button></div>`;
}
function enlazarAnio(cont, clave = 'anio') {
  $$('[data-anio]', cont).forEach(b => b.onclick = () => { UI[clave] = (UI[clave] || new Date().getFullYear()) + Number(b.dataset.anio); guardarUI(); pintar(); });
}
const anioUI = (clave = 'anio') => UI[clave] || new Date().getFullYear();
function cifra(titulo, valor, sub = '', clase = '') {
  return `<div class="cifra ${clase}"><span class="ct">${titulo}</span><b>${valor}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
}
// Tabla sencilla: cols = [{t, v: fila => html, cl: 'num'|'', pie: html}]
function tabla(cols, filas, { id = '', clickable = false, vacio = 'No hay nada aquí todavía', pie = false } = {}) {
  if (!filas.length) return `<p class="vacio">${vacio}</p>`;
  return `<div class="tabla-wrap"><table class="tabla ${clickable ? 'clic' : ''}" ${id ? `id="${id}"` : ''}>
    <thead><tr>${cols.map(c => `<th class="${c.cl || ''}">${c.t}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f, i) => `<tr data-i="${i}" class="${f._cl || ''}">${cols.map(c => `<td class="${c.cl || ''}" data-t="${esc(String(c.t).replace(/<[^>]+>/g, ''))}">${c.v(f) ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
    ${pie ? `<tfoot><tr>${cols.map(c => `<td class="${c.cl || ''}">${c.pie ?? ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
}
function enlazarTabla(cont, id, filas, fn) {
  const t = $('#' + id, cont); if (!t) return;
  t.onclick = (e) => { if (e.target.closest('a,button,input,select,label')) return; const tr = e.target.closest('tbody tr'); if (tr) fn(filas[+tr.dataset.i], e); };
}

// Barras apiladas por mes (SVG), con aviso al pasar el dedo o el ratón
function grafBarras(meses, series, valor, { alto = 220, etiqueta = (ym) => MESES_C[+ym.slice(5) - 1] } = {}) {
  const tot = meses.map(m => series.reduce((a, s) => a + Math.max(0, valor(m, s.k)), 0));
  const max = Math.max(1, ...tot);
  const paso = Math.pow(10, Math.floor(Math.log10(max))); const tope = Math.ceil(max / paso) * paso;
  const W = 640, H = alto, iz = 46, ab = 22, ar = 8, an = (W - iz - 4) / meses.length, bw = Math.min(34, an * .62);
  const y = (v) => ar + (H - ar - ab) * (1 - v / tope);
  const lineas = [0, .25, .5, .75, 1].map(f => `<line x1="${iz}" x2="${W}" y1="${y(tope * f)}" y2="${y(tope * f)}" class="g-rejilla"/><text x="${iz - 6}" y="${y(tope * f) + 4}" class="g-eje" text-anchor="end">${fmtN(tope * f)}</text>`).join('');
  const barras = meses.map((m, i) => {
    let acc = 0; const x = iz + i * an + (an - bw) / 2;
    const trozos = series.map(s => { const v = Math.max(0, valor(m, s.k)); if (!v) return ''; const y1 = y(acc + v), y0 = y(acc); acc += v; const h = Math.max(0, y0 - y1 - 1.5); return `<rect x="${x}" y="${y1}" width="${bw}" height="${h}" rx="3" fill="${s.color}"/>`; }).join('');
    const tip = `${esc(nombreMes(m))}|${series.map(s => `${s.nombre}: ${fmtE(valor(m, s.k))}`).join('|')}|Total: ${fmtE(tot[i])}`;
    return `<g class="g-barra" data-tip="${tip}"><rect x="${iz + i * an}" y="${ar}" width="${an}" height="${H - ar - ab}" fill="transparent"/>${trozos}<text x="${x + bw / 2}" y="${H - 6}" class="g-eje" text-anchor="middle">${etiqueta(m)}</text></g>`;
  }).join('');
  return `<div class="grafico"><div class="leyenda-g">${series.map(s => `<span><i style="background:${s.color}"></i>${s.nombre}</span>`).join('')}</div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras por mes">${lineas}${barras}</svg><div class="g-tip" hidden></div></div>`;
}
// Barras horizontales (por fuente, por libro)
function grafHoriz(items, { max } = {}) {
  const m = max || Math.max(1, ...items.map(i => i.v));
  return `<div class="horiz">${items.map(i => `<div class="h-fila" title="${esc(i.t)}: ${fmtE(i.v)}"><span class="h-t">${esc(i.t)}</span><div class="h-barra"><i style="width:${Math.max(0, i.v) / m * 100}%;background:${i.color || 'var(--acento)'}"></i></div><b>${fmtE0(i.v)}</b></div>`).join('')}</div>`;
}
function enlazarGraficos(cont) {
  $$('.grafico', cont).forEach(g => {
    const tip = $('.g-tip', g);
    $$('.g-barra', g).forEach(b => {
      const mostrar = (e) => {
        const p = b.dataset.tip.split('|');
        tip.innerHTML = `<b>${p[0]}</b>${p.slice(1).map(x => `<div>${x}</div>`).join('')}`; tip.hidden = false;
        const r = g.getBoundingClientRect(), br = b.getBoundingClientRect();
        let x = br.left - r.left + br.width / 2 - tip.offsetWidth / 2; x = Math.max(0, Math.min(r.width - tip.offsetWidth, x));
        tip.style.left = x + 'px'; tip.style.top = '28px';
        $$('.g-barra', g).forEach(o => o.classList.toggle('apagada', o !== b));
      };
      b.addEventListener('mouseenter', mostrar); b.addEventListener('click', mostrar);
    });
    g.addEventListener('mouseleave', () => { tip.hidden = true; $$('.g-barra', g).forEach(o => o.classList.remove('apagada')); });
  });
}
const SERIES_ING = FUENTES.map(([k, nombre, color]) => ({ k, nombre, color }));
