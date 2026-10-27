'use strict';
// =====================================================================
//  Centro de Control — Amazon KDP: subir el informe de Amazon tal cual
//  (Excel o CSV), resumen por libro y mes, y las filas de ventas y KENP.
// =====================================================================

// ---------- leer el informe ----------
const COLS_KDP = [
  // [campo, patrón del encabezado]. El orden importa: «netas» antes que «vendidas».
  ['mes', /^(fecha( de (las )?regal[ií]as)?|royalty date|date|fecha|mes|month|period[oa]?)$/],
  ['titulo', /^(t[ií]tulo|title)$/],
  ['autor', /^(nombre del autor|autor|author( name)?)$/],
  ['codigo', /(asin|isbn)/],
  ['tienda', /^(tienda|marketplace|store)$/],
  ['tipo', /^(tipo de regal[ií]as?|royalty type)$/],
  ['transaccion', /^(tipo de transacci[oó]n|transaction type)$/],
  ['netas', /(netas|net units|unidades vendidas netas)/],
  ['devueltas', /(devuel|refund|return)/],
  ['vendidas', /(vendidas|units sold)/],
  ['precio', /(precio de lista|precio medio|list price|average list|precio de venta)/],
  ['oferta', /(oferta|offer price)/],
  ['coste', /(coste|cost|entrega|delivery|impresi[oó]n|printing)/],
  ['regalias', /^(regal[ií]as|royalty|royalties)$/],
  ['moneda', /^(moneda|currency)$/],
  ['paginas', /(kenp|p[aá]ginas|pages read)/],
];
function mesNormal(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number' && v > 20000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 7); }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return `${m[3]}-${pad(+m[2])}`;
  const mm = MESES.findIndex(x => quitarTildes(s).includes(quitarTildes(x).slice(0, 3)));
  const en = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].findIndex(x => s.toLowerCase().includes(x));
  const y = (s.match(/\d{4}/) || [])[0];
  if (y && (mm >= 0 || en >= 0)) return `${y}-${pad((mm >= 0 ? mm : en) + 1)}`;
  return '';
}
function interpretarHoja(filas) {
  // Busca la fila de encabezados: la que tenga título y ASIN/ISBN
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const h = (filas[i] || []).map(x => quitarTildes(String(x || '')).trim());
    if (!h.some(x => /^(titulo|title)$/.test(x)) || !h.some(x => /(asin|isbn)/.test(x))) continue;
    const mapa = {}; const usadas = new Set();
    COLS_KDP.forEach(([k, re]) => { const j = h.findIndex((x, jj) => !usadas.has(jj) && re.test(quitarTildes(x))); if (j >= 0) { mapa[k] = j; usadas.add(j); } });
    const tipo = mapa.paginas !== undefined && mapa.regalias === undefined ? 'kenp' : mapa.regalias !== undefined ? 'ventas' : null;
    if (!tipo || mapa.mes === undefined) return null;
    const out = [];
    for (let r = i + 1; r < filas.length; r++) {
      const f = filas[r] || []; const g = (k) => mapa[k] !== undefined ? f[mapa[k]] : '';
      const titulo = String(g('titulo') || '').trim(); const mes = mesNormal(g('mes'));
      if (!titulo || !mes || /^total/i.test(titulo)) continue;
      const base = { id: uid(), mes, titulo, codigo: String(g('codigo') || '').trim(), tienda: String(g('tienda') || '').trim() };
      if (tipo === 'kenp') out.push({ ...base, paginas: n(g('paginas')) });
      else {
        const vend = n(g('vendidas')), dev = n(g('devueltas'));
        out.push({ ...base, tipo: String(g('tipo') || ''), transaccion: String(g('transaccion') || ''), vendidas: vend, devueltas: dev,
          netas: mapa.netas !== undefined ? n(g('netas')) : vend - dev, precio: n(g('precio')), oferta: n(g('oferta')), coste: n(g('coste')),
          regalias: n(g('regalias')), moneda: String(g('moneda') || 'EUR').trim().toUpperCase() || 'EUR' });
      }
    }
    return { tipo, filas: out };
  }
  return null;
}
async function subirInformes(archivos) {
  const nuevas = { ventas: [], kenp: [] }; const leidas = [];
  for (const a of archivos) {
    try {
      const hojas = await leerArchivoTabla(a);
      hojas.forEach(h => { const r = interpretarHoja(h.filas); if (r && r.filas.length) { nuevas[r.tipo].push(...r.filas); leidas.push(`${a.name}${hojas.length > 1 ? ' › ' + h.nombre : ''}: ${plural(r.filas.length, 'fila', 'filas')} de ${r.tipo === 'kenp' ? 'KENP' : 'ventas'}`); } });
    } catch (e) { aviso(`${a.name}: ${e.message}`); }
  }
  if (!nuevas.ventas.length && !nuevas.kenp.length) {
    modal(`<h3>No he encontrado ventas ni KENP</h3><p class="suave">En el archivo tiene que haber una tabla con columnas como «Título», «ASIN/ISBN», «Regalías» y «Moneda» (ventas) o «Páginas KENP leídas» (KENP). Descárgalo de KDP › Informes › <b>Regalías de meses anteriores</b> o desde el panel de informes, en Excel o CSV, sin tocarlo.</p><div class="pie"><button class="btn prim" data-cerrar>Entendido</button></div>`);
    return;
  }
  // Meses que ya existen: se sustituyen (así subir el mismo informe dos veces no duplica)
  const meses = (k) => [...new Set(nuevas[k].map(f => f.mes))].sort();
  const yaHay = (k) => meses(k).filter(m => D.kdp[k].some(f => f.mes === m));
  const repetidos = [...new Set([...yaHay('ventas'), ...yaHay('kenp')])].sort();
  const resumen = ['ventas', 'kenp'].filter(k => nuevas[k].length).map(k => `<li><b>${k === 'kenp' ? 'KENP' : 'Ventas'}</b>: ${plural(nuevas[k].length, 'fila', 'filas')} de ${meses(k).map(nombreMes).join(', ')}${k === 'ventas' ? ` · ${fmtE(nuevas.ventas.reduce((a, f) => a + eurVenta(f), 0))}` : ` · ${fmtN(nuevas.kenp.reduce((a, f) => a + n(f.paginas), 0))} páginas`}</li>`).join('');
  const sinLibro = [...nuevas.ventas, ...nuevas.kenp].filter(f => !libroDeFila(f));
  const monedas = [...new Set(nuevas.ventas.map(f => f.moneda))].filter(m => D.ajustes.cambios[m] === undefined);
  modal(`<h3>Informe de KDP</h3><ul class="lista-simple">${resumen}</ul>
    ${repetidos.length ? `<p class="nota">Ya tenías datos de <b>${repetidos.map(nombreMes).join(', ')}</b>. Los sustituyo por los de este informe para que no se dupliquen.</p>` : ''}
    ${sinLibro.length ? `<p class="suave">${plural(new Set(sinLibro.map(f => normCod(f.codigo) || f.titulo)).size, 'título no sé', 'títulos no sé')} de qué libro es. Después te los enseño para que lo elijas.</p>` : ''}
    ${monedas.length ? `<p class="suave">Monedas sin tipo de cambio: ${monedas.join(', ')}. Cuentan como euros hasta que lo pongas en Ajustes.</p>` : ''}
    <details class="tenue"><summary>Qué he leído</summary><ul>${leidas.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>
    <div class="pie"><button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="kd-ok">Guardar</button></div>`, {
    alAbrir: (m, cerrar) => {
      $('#kd-ok', m).onclick = () => {
        ['ventas', 'kenp'].forEach(k => { const ms = new Set(meses(k)); if (!ms.size) return; D.kdp[k] = D.kdp[k].filter(f => !ms.has(f.mes)).concat(nuevas[k]); });
        cerrar(); cambio();
        aviso('Informe de KDP guardado');
        if (sinLibro.length) { UI.kPest = 'sinlibro'; guardarUI(); pintar(); }
      };
    }
  });
}

// ---------- la sección ----------
VISTAS.kdp = (cont) => {
  const p = UI.kPest || 'resumen';
  const sinLibro = [...D.kdp.ventas, ...D.kdp.kenp].filter(f => !libroDeFila(f));
  cont.innerHTML = `<div class="pagina ancha kdp">
    ${cabecera('📈 Amazon KDP', `Ventas y páginas leídas. Último mes con datos: <b>${ultimoMesKdp() ? nombreMes(ultimoMesKdp()) : '—'}</b>.`, '<button class="btn prim" id="kd-subir">Subir informe de KDP</button>')}
    <div class="soltar-aqui" id="kd-soltar"><b>Arrastra aquí el informe de KDP</b> (Excel o CSV, tal cual lo descargas) o <button class="enlace-btn" id="kd-elegir">elígelo</button>.
      <small>KDP › Informes › Regalías de meses anteriores. Si subes un mes que ya tenías, se sustituye.</small></div>
    ${pestanas([['resumen', 'Por libro y mes'], ['ventas', `Ventas (${D.kdp.ventas.length})`], ['kenp', `KENP (${D.kdp.kenp.length})`], ...(sinLibro.length ? [['sinlibro', `⚠️ Sin libro (${sinLibro.length})`]] : [])], p === 'sinlibro' && !sinLibro.length ? 'resumen' : p, 'kPest')}
    <div id="kd-cuerpo"></div></div>`;
  enlazarPestanas(cont);
  const elegir = () => { const i = el('input', { type: 'file', accept: '.xlsx,.csv,.tsv,.txt', multiple: true }); i.onchange = () => subirInformes([...i.files]); i.click(); };
  $('#kd-subir', cont).onclick = elegir; $('#kd-elegir', cont).onclick = elegir;
  const z = $('#kd-soltar', cont);
  z.ondragover = (e) => { e.preventDefault(); z.classList.add('encima'); };
  z.ondragleave = () => z.classList.remove('encima');
  z.ondrop = (e) => { e.preventDefault(); z.classList.remove('encima'); subirInformes([...e.dataTransfer.files]); };
  const c = $('#kd-cuerpo', cont);
  if (p === 'ventas') kdpFilas(c, 'ventas'); else if (p === 'kenp') kdpFilas(c, 'kenp'); else if (p === 'sinlibro' && sinLibro.length) kdpSinLibro(c, sinLibro); else kdpResumen(c);
};

function kdpResumen(c) {
  const Y = anioUI(), que = UI.kQue || 'total';
  const meses = Array.from({ length: 12 }, (_, i) => `${Y}-${pad(i + 1)}`);
  const filas = new Map();
  const add = (l, mes, v) => { const k = l ? l.id : '_'; if (!filas.has(k)) filas.set(k, { l, m: {}, t: 0 }); const o = filas.get(k); o.m[mes] = (o.m[mes] || 0) + v; o.t += v; };
  if (que !== 'kenp' && que !== 'paginas' && que !== 'uds') D.kdp.ventas.forEach(f => anioDe(f.mes) === Y && add(libroDeFila(f), f.mes, eurVenta(f)));
  if (que === 'uds') D.kdp.ventas.forEach(f => anioDe(f.mes) === Y && add(libroDeFila(f), f.mes, n(f.netas)));
  if (que === 'kenp' || que === 'total') D.kdp.kenp.forEach(f => anioDe(f.mes) === Y && add(libroDeFila(f), f.mes, eurKenp(f)));
  if (que === 'paginas') D.kdp.kenp.forEach(f => anioDe(f.mes) === Y && add(libroDeFila(f), f.mes, n(f.paginas)));
  const lista = [...filas.values()].sort((a, b) => b.t - a.t);
  const fmt = que === 'uds' || que === 'paginas' ? (v) => v ? fmtN(v) : '' : (v) => v ? fmtE(v) : '';
  const totMes = meses.map(m => lista.reduce((a, o) => a + (o.m[m] || 0), 0));
  c.innerHTML = `<div class="barra-filtros">${selectorAnio()}<div class="segmentado">${[['total', 'Regalías + KENP (€)'], ['kdp', 'Regalías (€)'], ['kenp', 'KENP (€)'], ['uds', 'Unidades'], ['paginas', 'Páginas']].map(([k, t]) => `<button data-que="${k}" class="${k === que ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    ${tabla([{ t: 'Libro', v: o => o.l ? `<a href="#" data-libro="${o.l.id}">${esc(tituloLibro(o.l))}</a>` : '<span class="tenue">Sin libro</span>' },
      ...meses.map((m, i) => ({ t: MESES_C[i], cl: 'num', v: o => fmt(o.m[m]), pie: fmt(totMes[i]) })),
      { t: 'Total', cl: 'num total', v: o => fmt(o.t), pie: fmt(totMes.reduce((a, b) => a + b, 0)) }], lista, { pie: true, vacio: `No hay datos de KDP en ${Y}. Sube un informe.` })}
    <p class="tenue">Cada fila de KDP se asigna a su libro por el ASIN o ISBN. KENP a ${fmtN(n(D.ajustes.kenpTasa) * 1000, 2)} € cada 1.000 páginas.</p>`;
  enlazarAnio(c);
  $$('[data-que]', c).forEach(b => b.onclick = () => { UI.kQue = b.dataset.que; guardarUI(); pintar(); });
  $$('[data-libro]', c).forEach(a => a.onclick = (e) => { e.preventDefault(); irA('libros', { ui: { libro: a.dataset.libro } }); });
}

function kdpFilas(c, k) {
  const mesesDisp = [...new Set(D.kdp[k].map(f => f.mes))].sort().reverse();
  const mes = mesesDisp.includes(UI.kMes) ? UI.kMes : (mesesDisp[0] || '');
  const filas = D.kdp[k].filter(f => f.mes === mes).sort((a, b) => k === 'kenp' ? n(b.paginas) - n(a.paginas) : eurVenta(b) - eurVenta(a));
  const cols = k === 'kenp'
    ? [{ t: 'Libro', v: f => libroDeFila(f) ? esc(tituloLibro(libroDeFila(f))) : `<span class="rojo">${esc(f.titulo.slice(0, 50))}</span>` }, { t: 'Tienda', v: f => esc(f.tienda) }, { t: 'Páginas', cl: 'num', v: f => fmtN(f.paginas), pie: fmtN(filas.reduce((a, f) => a + n(f.paginas), 0)) }, { t: '€ (estimado)', cl: 'num', v: f => fmtE(eurKenp(f)), pie: fmtE(filas.reduce((a, f) => a + eurKenp(f), 0)) }]
    : [{ t: 'Libro', v: f => libroDeFila(f) ? esc(tituloLibro(libroDeFila(f))) : `<span class="rojo">${esc(f.titulo.slice(0, 50))}</span>` }, { t: 'Tienda', v: f => esc(f.tienda) }, { t: 'Tipo', v: f => esc([f.tipo, f.transaccion].filter(Boolean).join(' · ')) },
      { t: 'Netas', cl: 'num', v: f => fmtN(f.netas), pie: fmtN(filas.reduce((a, f) => a + n(f.netas), 0)) }, { t: 'Precio', cl: 'num', v: f => f.precio ? fmtN(f.precio, 2) + ' ' + f.moneda : '' },
      { t: 'Regalías', cl: 'num', v: f => fmtN(f.regalias, 2) + ' ' + f.moneda }, { t: 'En €', cl: 'num', v: f => fmtE(eurVenta(f)), pie: fmtE(filas.reduce((a, f) => a + eurVenta(f), 0)) }];
  c.innerHTML = `<div class="barra-filtros"><select id="kd-mes" aria-label="Mes">${mesesDisp.map(m => `<option value="${m}"${m === mes ? ' selected' : ''}>${nombreMes(m)}</option>`).join('')}</select>
      <span class="tenue">${plural(filas.length, 'fila', 'filas')}</span><span class="hueco"></span>${mes ? `<button class="btn peq peligro-suave" id="kd-borrar">Borrar ${nombreMes(mes)}</button>` : ''}</div>
    ${tabla(cols, filas, { pie: true, vacio: 'Aún no hay datos. Sube un informe de KDP.' })}`;
  if ($('#kd-mes', c)) $('#kd-mes', c).onchange = (e) => { UI.kMes = e.target.value; guardarUI(); pintar(); };
  if ($('#kd-borrar', c)) $('#kd-borrar', c).onclick = async () => {
    if (!(await preguntar(`¿Borrar ${k === 'kenp' ? 'el KENP' : 'las ventas'} de ${nombreMes(mes)}?`, 'Puedes volver a subir el informe cuando quieras.', 'Borrar', true))) return;
    const antes = D.kdp[k]; D.kdp[k] = D.kdp[k].filter(f => f.mes !== mes); cambio();
    aviso('Borrado', { t: 'Deshacer', fn: () => { D.kdp[k] = antes; cambio(); } });
  };
}

function kdpSinLibro(c, filas) {
  const grupos = new Map();
  filas.forEach(f => { const k = normCod(f.codigo) || 'T:' + normTit(f.titulo); if (!grupos.has(k)) grupos.set(k, { cod: f.codigo, titulo: f.titulo, n: 0, eur: 0 }); const g = grupos.get(k); g.n++; g.eur += f.paginas !== undefined ? eurKenp(f) : eurVenta(f); });
  const ops = [...D.libros].sort((a, b) => a.titulo.localeCompare(b.titulo)).map(l => `<option value="${l.id}">${esc(tituloLibro(l))}${l.fechaPub ? ' · ' + anioDe(l.fechaPub) : ''}</option>`).join('');
  c.innerHTML = `<p class="suave">Estas filas tienen un ASIN o ISBN que no está en ninguna ficha. Elige de qué libro son y lo apunto en su ficha («Otros códigos»), así los próximos informes se asignan solos.</p>
    <div class="sin-libro">${[...grupos.values()].map((g, i) => `<div class="tarjeta fila-asignar"><div><b>${esc(g.titulo.slice(0, 90))}</b><small>${esc(g.cod || 'sin código')} · ${plural(g.n, 'fila', 'filas')} · ${fmtE(g.eur)}</small></div>
      <select data-g="${i}"><option value="">¿Qué libro es?</option>${ops}</select></div>`).join('')}</div>`;
  const gs = [...grupos.values()];
  $$('[data-g]', c).forEach(s => s.onchange = () => {
    const g = gs[+s.dataset.g], l = libroPorId(s.value); if (!l) return;
    if (g.cod) { l.codigos = [...new Set([...(l.codigos || []), normCod(g.cod)])]; }
    else [...D.kdp.ventas, ...D.kdp.kenp].forEach(f => { if (!f.codigo && normTit(f.titulo) === normTit(g.titulo)) f.libro = l.id; });
    cambio(); aviso(`Asignado a «${l.titulo}»`);
  });
}
