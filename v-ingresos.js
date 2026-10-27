'use strict';
// =====================================================================
//  Centro de Control — Ingresos que no vienen de Amazon (facturas:
//  club de lectura, charlas…) y Venta directa (pedidos que vendes tú).
// =====================================================================

VISTAS.ingresos = (cont) => {
  const p = UI.iPest || 'extra';
  cont.innerHTML = `<div class="pagina ancha ingresos">${cabecera('💰 Ingresos', 'Lo que no viene de Amazon: tus facturas y los libros que vendes tú.', `${selectorAnio()}<button class="btn prim" id="in-nuevo">+ ${p === 'directa' ? 'Pedido' : 'Ingreso'}</button>`)}
    ${pestanas([['extra', '🧾 Facturas e ingresos extra'], ['directa', '📦 Venta directa']], p, 'iPest')}<div id="in-cuerpo"></div></div>`;
  enlazarPestanas(cont); enlazarAnio(cont);
  $('#in-nuevo', cont).onclick = () => p === 'directa' ? editarVenta({ fecha: hoy(), uds: 1, estado: 'Pendiente', formato: 'Papel' }, { nueva: true }) : editarIngreso({ fecha: hoy(), estado: 'Pendiente', irpfPct: D.ajustes.irpfIngresos, ivaPct: 0 }, { nueva: true });
  if (p === 'directa') ventasDirectas($('#in-cuerpo', cont)); else ingresosExtra($('#in-cuerpo', cont));
};

// ---------- facturas ----------
function ingresosExtra(c) {
  const Y = anioUI();
  const filas = D.ingresos.filter(i => anioDe(i.fecha) === Y || !i.fecha).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const s = (f) => filas.reduce((a, i) => a + f(i), 0);
  const pend = filas.filter(i => i.estado !== 'Cobrado');
  c.innerHTML = `<div class="cifras-grandes peq">${cifra('Facturado (sin IVA)', fmtE(s(i => n(i.bruto))))}${cifra('Retenciones IRPF', fmtE(s(ingreso.irpf)), 'te las descuentan al cobrar')}${cifra('IVA repercutido', fmtE(s(ingreso.iva)))}${cifra('Cobrado neto', fmtE(s(i => i.estado === 'Cobrado' ? ingreso.neto(i) : 0)), pend.length ? `${fmtE(pend.reduce((a, i) => a + ingreso.neto(i), 0))} pendiente` : 'todo cobrado')}</div>
    ${tabla([
      { t: 'Fecha', v: i => i.fecha ? `${fechaCorta(i.fecha)}` : '<span class="rojo">sin fecha</span>' },
      { t: 'Concepto', v: i => `<b>${esc(i.concepto)}</b>${i.cliente ? `<small class="bloque">${esc(i.cliente)}</small>` : ''}` },
      { t: 'Línea', v: i => esc(i.linea || '') },
      { t: 'Factura', v: i => esc(i.factura || '') },
      { t: 'Bruto', cl: 'num', v: i => fmtE(n(i.bruto)), pie: fmtE(s(i => n(i.bruto))) },
      { t: 'IRPF', cl: 'num', v: i => fmtE(ingreso.irpf(i)), pie: fmtE(s(ingreso.irpf)) },
      { t: 'IVA', cl: 'num', v: i => fmtE(ingreso.iva(i)), pie: fmtE(s(ingreso.iva)) },
      { t: 'Neto', cl: 'num', v: i => fmtE(ingreso.neto(i)), pie: fmtE(s(ingreso.neto)) },
      { t: 'Estado', v: i => `<button class="estado-btn ${i.estado === 'Cobrado' ? 'ok' : 'pend'}" data-cobrar="${i.id}">${esc(i.estado || 'Pendiente')}</button>` },
    ], filas, { id: 'in-tabla', clickable: true, pie: true, vacio: `No hay ingresos extra en ${Y}.` })}`;
  enlazarTabla(c, 'in-tabla', filas, (i) => editarIngreso(i));
  $$('[data-cobrar]', c).forEach(b => b.onclick = () => { const i = D.ingresos.find(x => x.id === b.dataset.cobrar); i.estado = i.estado === 'Cobrado' ? 'Pendiente' : 'Cobrado'; cambio(); });
}
function editarIngreso(i, { nueva = false } = {}) {
  const L = D.listas;
  const campos = [
    { k: 'concepto', t: 'Concepto', tipo: 'lista', op: [...new Set(D.ingresos.map(x => x.concepto).filter(Boolean))] },
    { k: 'fecha', t: 'Fecha de la factura', tipo: 'fecha', ancho: 'medio' },
    { k: 'factura', t: 'Factura nº', tipo: 'texto', ancho: 'medio', ph: siguienteFactura() },
    { k: 'cliente', t: 'Cliente / entidad', tipo: 'lista', op: [...new Set(D.ingresos.map(x => x.cliente).filter(Boolean))], ancho: 'medio' },
    { k: 'linea', t: 'Línea de negocio', tipo: 'lista', op: L.lineaIngreso, ancho: 'medio' },
    { k: 'bruto', t: 'Base de la factura (€, sin IVA)', tipo: 'num', ancho: 'tercio' },
    { k: 'irpfPct', t: 'Retención IRPF %', tipo: 'num', ancho: 'tercio' },
    { k: 'ivaPct', t: 'IVA %', tipo: 'num', ancho: 'tercio', ayuda: 'Normalmente 0 si la entidad es pública o está exenta; si no, 21.' },
    { k: 'estado', t: 'Estado', tipo: 'select', op: L.estadoCobro, vacio: false, ancho: 'medio' },
    { k: 'metodo', t: 'Método de cobro', tipo: 'select', op: L.metodo, ancho: 'medio' },
    { k: 'libro', t: 'Libro (si va con uno)', tipo: 'select', op: D.libros.map(l => l.titulo) },
    { k: 'notas', t: 'Notas', tipo: 'area', filas: 2 },
  ];
  ficha({
    titulo: nueva ? 'Nuevo ingreso' : 'Ingreso', obj: i, campos,
    onGuardar: (r) => {
      if (!r.concepto) { aviso('Escribe el concepto'); return false; }
      const fin = { ...r, id: i.id || uid(), bruto: n(r.bruto), irpfPct: n(r.irpfPct), ivaPct: n(r.ivaPct) };
      if (!fin.factura && nueva) fin.factura = siguienteFactura();
      if (nueva) D.ingresos.push(fin); else D.ingresos[D.ingresos.findIndex(x => x.id === i.id)] = fin;
      cambio();
    },
    onBorrar: nueva ? null : async () => { borrarConDeshacer('ingresos', i.id, 'Ingreso borrado'); return true; },
    extras: nueva ? [] : [{ t: 'Duplicar', fn: (r, cerrar) => { cerrar(); editarIngreso({ ...r, id: null, fecha: hoy(), factura: '', estado: 'Pendiente' }, { nueva: true }); } }],
  });
}
// Siguiente número de factura con el formato «n/AA»
function siguienteFactura() {
  const aa = String(new Date().getFullYear()).slice(2);
  const nums = D.ingresos.map(i => String(i.factura || '').match(/^(\d+)\/(\d{2})$/)).filter(m => m && m[2] === aa).map(m => +m[1]);
  return `${(nums.length ? Math.max(...nums) : 0) + 1}/${aa}`;
}

// ---------- venta directa ----------
function ventasDirectas(c) {
  const Y = anioUI(), ver = UI.vVer || (D.ventas.some(v => !v.fecha) && !D.ventas.some(v => anioDe(v.fecha) === Y) ? 'sinfecha' : 'anio');
  let filas = D.ventas.filter(v => ver === 'sinfecha' ? !v.fecha : ver === 'todas' ? true : anioDe(v.fecha) === Y);
  filas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || n(b.pedido) - n(a.pedido));
  const sinF = D.ventas.filter(v => !v.fecha).length;
  const vivas = filas.filter(v => v.estado !== 'Cancelado');
  const s = (f) => vivas.reduce((a, v) => a + f(v), 0);
  // Por libro y formato
  const grupos = {};
  vivas.forEach(v => { const k = `${v.libro} · ${v.formato || ''}`; const g = grupos[k] || (grupos[k] = { uds: 0, ing: 0, ben: 0 }); g.uds += n(v.uds || 1); g.ing += venta.cobrado(v); g.ben += venta.beneficio(v); });
  c.innerHTML = `<div class="barra-filtros"><div class="segmentado">${[['anio', `Año ${Y}`], ['sinfecha', `Sin fecha (${sinF})`], ['todas', 'Todos']].map(([k, t]) => `<button data-ver="${k}" class="${k === ver ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${sinF ? `<button class="btn peq" id="vd-fechar">Poner fecha a los ${sinF} sin fecha…</button>` : ''}</div>
    ${sinF && ver !== 'sinfecha' ? `<p class="nota">Hay ${plural(sinF, 'pedido sin fecha', 'pedidos sin fecha')}: no cuentan en ningún mes, ni en la caja ni en los impuestos. Ponles fecha (aunque sea aproximada, el día de la preventa).</p>` : ''}
    <div class="cifras-grandes peq">${cifra('Pedidos', fmtN(vivas.length), `${fmtN(s(v => n(v.uds || 1)))} libros`)}${cifra('Cobrado', fmtE(s(venta.cobrado)), 'libros + envíos')}${cifra('Costes', fmtE(s(venta.costes)), 'libros, envíos y regalos')}${cifra('Beneficio', fmtE(s(venta.beneficio)))}</div>
    ${Object.keys(grupos).length > 1 ? `<section class="tarjeta" style="margin-bottom:14px"><h2>Por libro</h2>${tabla([{ t: 'Libro', v: ([k]) => esc(k) }, { t: 'Libros', cl: 'num', v: ([, g]) => fmtN(g.uds) }, { t: 'Cobrado', cl: 'num', v: ([, g]) => fmtE(g.ing) }, { t: 'Beneficio', cl: 'num', v: ([, g]) => fmtE(g.ben) }], Object.entries(grupos))}</section>` : ''}
    ${tabla([
      { t: 'Nº', v: v => esc(v.pedido || '') },
      { t: 'Fecha', v: v => v.fecha ? fechaCorta(v.fecha) + ' ' + anioDe(v.fecha) : '<span class="tenue">—</span>' },
      { t: 'Cliente', v: v => esc(v.cliente || '') },
      { t: 'Libro', v: v => `${esc(v.libro || '')}<small class="bloque">${esc(v.formato || '')}</small>` },
      { t: 'Uds', cl: 'num', v: v => fmtN(n(v.uds || 1)) },
      { t: 'Cobrado', cl: 'num', v: v => fmtE(venta.cobrado(v)), pie: fmtE(s(venta.cobrado)) },
      { t: 'Costes', cl: 'num', v: v => fmtE(venta.costes(v)), pie: fmtE(s(venta.costes)) },
      { t: 'Beneficio', cl: 'num', v: v => fmtE(venta.beneficio(v)), pie: fmtE(s(venta.beneficio)) },
      { t: 'Estado', v: v => `${esc(v.estado || '')}${v.seguimiento ? `<small class="bloque">${esc(v.seguimiento)}</small>` : ''}` },
    ], filas.map(v => ({ ...v, _cl: v.estado === 'Cancelado' ? 'anulada' : '' })), { id: 'vd-tabla', clickable: true, pie: true, vacio: 'No hay pedidos aquí.' })}`;
  $$('[data-ver]', c).forEach(b => b.onclick = () => { UI.vVer = b.dataset.ver; guardarUI(); pintar(); });
  enlazarTabla(c, 'vd-tabla', filas, (v) => editarVenta(D.ventas.find(x => x.id === v.id)));
  if ($('#vd-fechar', c)) $('#vd-fechar', c).onclick = async () => {
    const f = await new Promise(res => { let r = null; modal(`<h3>Fecha para los pedidos sin fecha</h3><p class="suave">Se la pongo a los ${sinF}. Luego puedes cambiar cualquiera a mano.</p><label class="campo"><span>Fecha</span><input type="date" id="vf-f" value="${hoy()}"></label><div class="pie"><button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="vf-ok">Poner fecha</button></div>`, { alAbrir: (m, cerrar) => { $('#vf-ok', m).onclick = () => { r = $('#vf-f', m).value; cerrar(); }; }, alCerrar: () => res(r) }); });
    if (!f) return;
    D.ventas.forEach(v => { if (!v.fecha) v.fecha = f; }); cambio(); aviso('Fechas puestas');
  };
}
function editarVenta(v, { nueva = false } = {}) {
  const L = D.listas;
  const campos = [
    { k: 'cliente', t: 'Cliente', tipo: 'texto', ancho: 'medio' },
    { k: 'fecha', t: 'Fecha', tipo: 'fecha', ancho: 'medio' },
    { k: 'libro', t: 'Libro', tipo: 'lista', op: [...new Set(D.libros.map(l => l.titulo))], ancho: 'medio' },
    { k: 'formato', t: 'Formato / edición', tipo: 'lista', op: [...new Set([...L.formato, ...D.ventas.map(x => x.formato).filter(Boolean)])], ancho: 'medio' },
    { k: 'uds', t: 'Unidades', tipo: 'num', ancho: 'tercio' },
    { k: 'pvp', t: 'PVP por unidad (€)', tipo: 'num', ancho: 'tercio' },
    { k: 'envioCobrado', t: 'Envío cobrado (€)', tipo: 'num', ancho: 'tercio' },
    { k: 'costeUd', t: 'Coste por unidad (€)', tipo: 'num', ancho: 'tercio' },
    { k: 'costeEnvio', t: 'Coste del envío (€)', tipo: 'num', ancho: 'tercio' },
    { k: 'regalos', t: 'Regalos y embalaje (€)', tipo: 'num', ancho: 'tercio' },
    { k: 'estado', t: 'Estado', tipo: 'select', op: L.estadoVenta, ancho: 'medio' },
    { k: 'seguimiento', t: 'Envío', tipo: 'select', op: L.seguimiento, ancho: 'medio' },
    { k: 'pedido', t: 'Nº de pedido', tipo: 'texto', ancho: 'medio' },
    { k: 'notas', t: 'Notas', tipo: 'area', filas: 2 },
  ];
  // Un pedido nuevo copia precios y costes del último del mismo libro
  const ult = [...D.ventas].reverse()[0];
  const obj = nueva && ult ? { libro: ult.libro, formato: ult.formato, pvp: ult.pvp, costeUd: ult.costeUd, costeEnvio: ult.costeEnvio, regalos: ult.regalos, envioCobrado: 0, pedido: String(Math.max(0, ...D.ventas.map(x => n(x.pedido))) + 1), ...v } : v;
  ficha({
    titulo: nueva ? 'Nuevo pedido' : `Pedido ${v.pedido || ''}`, obj, campos,
    onGuardar: (r) => {
      if (!r.libro) { aviso('Elige el libro'); return false; }
      const fin = { ...r, id: v.id || uid() };
      ['uds', 'pvp', 'envioCobrado', 'costeUd', 'costeEnvio', 'regalos'].forEach(k => fin[k] = n(fin[k]));
      if (!fin.uds) fin.uds = 1;
      if (nueva) D.ventas.push(fin); else D.ventas[D.ventas.findIndex(x => x.id === v.id)] = fin;
      cambio();
    },
    onBorrar: nueva ? null : async () => { borrarConDeshacer('ventas', v.id, 'Pedido borrado'); return true; },
  });
}
