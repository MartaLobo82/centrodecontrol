'use strict';
// =====================================================================
//  Centro de Control — Gastos: cada gasto del negocio, con su IVA, si
//  está pagado y si es deducible (lo que cuenta para los impuestos).
// =====================================================================

VISTAS.gastos = (cont) => {
  const Y = anioUI(), cat = UI.gCat || '', q = quitarTildes(UI.gBuscar || '');
  let filas = D.gastos.filter(g => (anioDe(g.fecha) === Y || !g.fecha) && (!cat || g.cat === cat) && (!q || quitarTildes([g.concepto, g.proveedor, g.subcat, g.notas].join(' ')).includes(q)));
  filas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const s = (f) => filas.reduce((a, g) => a + f(g), 0);
  const porCat = {};
  D.gastos.filter(g => anioDe(g.fecha) === Y).forEach(g => { porCat[g.cat || 'Sin categoría'] = (porCat[g.cat || 'Sin categoría'] || 0) + gasto.total(g); });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const vacios = filas.filter(g => !n(g.base)).length;

  cont.innerHTML = `<div class="pagina ancha gastos">${cabecera('💸 Gastos', 'Cada gasto del negocio. Marca si está pagado y si es deducible: solo los deducibles restan en los impuestos.', `${selectorAnio()}<button class="btn prim" id="ga-nuevo">+ Gasto</button>`)}
    <div class="cifras-grandes peq">${cifra('Total', fmtE(s(gasto.total)), `${plural(filas.length, 'gasto', 'gastos')}`)}${cifra('Base', fmtE(s(g => n(g.base))))}${cifra('IVA soportado', fmtE(s(gasto.iva)), 'de los deducibles: ' + fmtE(s(g => g.deducible ? gasto.iva(g) : 0)))}${cifra('Sin pagar', fmtE(s(g => g.pagado ? 0 : gasto.total(g))))}</div>
    ${cats.length ? `<section class="tarjeta" style="margin:14px 0"><h2>Por categoría · ${Y}</h2>${grafHoriz(cats.map(([t, v]) => ({ t, v })))}</section>` : ''}
    <div class="barra-filtros"><select id="ga-cat" aria-label="Categoría"><option value="">Todas las categorías</option>${[...new Set([...D.listas.catGasto, ...D.gastos.map(g => g.cat).filter(Boolean)])].map(c => `<option${c === cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <input type="search" id="ga-buscar" placeholder="Buscar…" value="${esc(UI.gBuscar || '')}"><span class="hueco"></span>
      <button class="btn peq" id="ga-mes">Repetir los mensuales de este mes…</button></div>
    ${vacios ? `<p class="nota">${plural(vacios, 'gasto no tiene', 'gastos no tienen')} importe (por ejemplo, suscripciones a 0 €). Si no los pagas, puedes borrarlos.</p>` : ''}
    ${tabla([
      { t: 'Fecha', v: g => g.fecha ? fechaCorta(g.fecha) : '<span class="rojo">sin fecha</span>' },
      { t: 'Concepto', v: g => `<b>${esc(g.concepto)}</b><small class="bloque">${esc([g.cat, g.subcat, g.proveedor].filter(Boolean).join(' · '))}</small>` },
      { t: 'Libro', v: g => esc(g.libro || '') },
      { t: 'Base', cl: 'num', v: g => fmtE(n(g.base)), pie: fmtE(s(g => n(g.base))) },
      { t: 'IVA', cl: 'num', v: g => fmtE(gasto.iva(g)), pie: fmtE(s(gasto.iva)) },
      { t: 'Total', cl: 'num', v: g => fmtE(gasto.total(g)), pie: fmtE(s(gasto.total)) },
      { t: 'Pagado', v: g => `<button class="estado-btn ${g.pagado ? 'ok' : 'pend'}" data-tog="pagado" data-id="${g.id}">${g.pagado ? 'Pagado' : 'Sin pagar'}</button>` },
      { t: 'Deducible', v: g => `<button class="estado-btn ${g.deducible ? 'ok' : 'gris'}" data-tog="deducible" data-id="${g.id}">${g.deducible ? 'Sí' : 'No'}</button>` },
    ], filas, { id: 'ga-tabla', clickable: true, pie: true, vacio: `No hay gastos en ${Y}.` })}</div>`;

  enlazarAnio(cont);
  enlazarTabla(cont, 'ga-tabla', filas, (g) => editarGasto(g));
  $$('[data-tog]', cont).forEach(b => b.onclick = () => { const g = D.gastos.find(x => x.id === b.dataset.id); g[b.dataset.tog] = !g[b.dataset.tog]; cambio(); });
  $('#ga-cat', cont).onchange = (e) => { UI.gCat = e.target.value; guardarUI(); pintar(); };
  const bq = $('#ga-buscar', cont);
  bq.oninput = debounce(() => { UI.gBuscar = bq.value; guardarUI(); pintar(); const n2 = $('#ga-buscar'); n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); }, 250);
  $('#ga-nuevo', cont).onclick = () => editarGasto({ fecha: hoy(), ivaPct: D.ajustes.ivaGastos, deducible: true, pagado: true }, { nueva: true });
  $('#ga-mes', cont).onclick = () => repetirMensuales();
};

function editarGasto(g, { nueva = false } = {}) {
  const L = D.listas;
  const campos = [
    { k: 'concepto', t: 'Concepto', tipo: 'lista', op: [...new Set([...L.conceptoGasto, ...D.gastos.map(x => x.concepto).filter(Boolean)])] },
    { k: 'fecha', t: 'Fecha', tipo: 'fecha', ancho: 'medio' },
    { k: 'proveedor', t: 'Proveedor', tipo: 'lista', op: [...new Set(D.gastos.map(x => x.proveedor).filter(Boolean))], ancho: 'medio' },
    { k: 'cat', t: 'Categoría', tipo: 'lista', op: L.catGasto, ancho: 'medio' },
    { k: 'subcat', t: 'Subcategoría', tipo: 'lista', op: L.subcatGasto, ancho: 'medio' },
    { k: 'base', t: 'Base (€, sin IVA)', tipo: 'num', ancho: 'tercio' },
    { k: 'ivaPct', t: 'IVA %', tipo: 'select', op: ['21', '10', '4', '0'], vacio: false, ancho: 'tercio' },
    { k: 'total', t: 'O el total con IVA (€)', tipo: 'num', ancho: 'tercio', ayuda: 'Si solo sabes el total, escríbelo aquí y calculo la base.' },
    { k: 'pagado', t: 'Pagado', tipo: 'check', ancho: 'tercio' },
    { k: 'deducible', t: 'Deducible', tipo: 'check', ancho: 'tercio' },
    { k: 'metodo', t: 'Método', tipo: 'select', op: L.metodo, ancho: 'tercio' },
    { k: 'libro', t: 'Libro o proyecto', tipo: 'lista', op: [...new Set(D.libros.map(l => l.titulo))] },
    { k: 'notas', t: 'Notas', tipo: 'area', filas: 2 },
  ];
  const obj = { ...g, ivaPct: String(g.ivaPct ?? 21), total: '' };
  ficha({
    titulo: nueva ? 'Nuevo gasto' : 'Gasto', obj, campos,
    onGuardar: (r) => {
      if (!r.concepto) { aviso('Escribe el concepto'); return false; }
      const fin = { ...r, id: g.id || uid(), ivaPct: n(r.ivaPct), pagado: !!r.pagado, deducible: !!r.deducible };
      if (r.total !== undefined && r.total !== '' && !n(r.base)) fin.base = r2(n(r.total) / (1 + fin.ivaPct / 100));
      fin.base = n(fin.base); delete fin.total;
      if (nueva) D.gastos.push(fin); else D.gastos[D.gastos.findIndex(x => x.id === g.id)] = fin;
      cambio();
    },
    onBorrar: nueva ? null : async () => { borrarConDeshacer('gastos', g.id, 'Gasto borrado'); return true; },
    extras: nueva ? [] : [{ t: 'Repetir el mes siguiente', fn: (r, cerrar) => { cerrar(); const base = g.fecha || hoy(); const m2 = sumarMeses(mesDe(base), 1); D.gastos.push({ ...g, id: uid(), fecha: `${m2}-${pad(Math.min(+base.slice(8), diasDelMes(m2)))}`, pagado: false }); cambio(); aviso('Copiado al mes siguiente'); } }],
  });
  // Al elegir un concepto ya usado, rellena categoría, proveedor e IVA como la última vez
  setTimeout(() => {
    const i = $('[data-k="concepto"]'); if (!i || !nueva) return;
    i.addEventListener('change', () => {
      const prev = [...D.gastos].reverse().find(x => x.concepto === i.value.trim()); if (!prev) return;
      [['cat', prev.cat], ['subcat', prev.subcat], ['proveedor', prev.proveedor], ['base', prev.base], ['metodo', prev.metodo]].forEach(([k, v]) => { const c = $(`[data-k="${k}"]`); if (c && !c.value && v != null) c.value = v; });
      const iv = $('[data-k="ivaPct"]'); if (iv && prev.ivaPct != null) iv.value = String(prev.ivaPct);
    });
  }, 50);
}

// Copia al mes actual los gastos que se repiten cada mes (los del mes pasado con «mensual» en el concepto o las notas)
function repetirMensuales() {
  const este = mesDe(hoy()), ant = sumarMeses(este, -1);
  const cands = D.gastos.filter(g => mesDe(g.fecha || '') === ant && /mensual/i.test((g.concepto || '') + ' ' + (g.notas || '')) && !D.gastos.some(x => mesDe(x.fecha || '') === este && x.concepto === g.concepto));
  if (!cands.length) { aviso(`No hay gastos «mensual» de ${nombreMes(ant)} por copiar`); return; }
  modal(`<h3>Repetir gastos mensuales</h3><p class="suave">Copio a ${nombreMes(este)} estos gastos de ${nombreMes(ant)}:</p>
    <div class="opciones-imp">${cands.map((g, i) => `<label><input type="checkbox" data-c="${i}" checked> <b>${esc(g.concepto)}</b><small>${fmtE(gasto.total(g))}</small></label>`).join('')}</div>
    <div class="pie"><button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="rm-ok">Copiar</button></div>`, {
    alAbrir: (m, cerrar) => { $('#rm-ok', m).onclick = () => { $$('[data-c]:checked', m).forEach(c => { const g = cands[+c.dataset.c]; D.gastos.push({ ...g, id: uid(), fecha: este + g.fecha.slice(7), pagado: false }); }); cerrar(); cambio(); aviso('Gastos copiados'); }; }
  });
}
