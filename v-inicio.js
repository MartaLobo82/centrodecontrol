'use strict';
// =====================================================================
//  Centro de Control — Inicio: lo que antes estaba repartido entre
//  Inicio, Dashboard, Tesorería y Evolución del Excel.
// =====================================================================

VISTAS.inicio = (cont) => {
  const H = hoy(), Y = anioUI();
  const esteAnio = Y === aFecha(H).getFullYear();
  const hasta = esteAnio ? aFecha(H).getMonth() + 1 : 12;
  const R = resumenAnio(Y);
  const M = porMes();
  const meses = Array.from({ length: 12 }, (_, i) => `${Y}-${pad(i + 1)}`);
  const objetivo = n(D.ajustes.objetivo);
  const pctObj = objetivo ? R.ingresos / objetivo : 0;
  const ritmo = esteAnio ? (diasEntre(`${Y}-01-01`, H) + 1) / (diasEntre(`${Y}-01-01`, `${Y}-12-31`) + 1) : 1;
  const C = caja(Y);
  const ultKdp = ultimoMesKdp();
  const libros = [...porLibro(Y).values()].filter(x => x.libro).sort((a, b) => b.ingresos - a.ingresos);

  // ---- avisos ----
  const avisos = [];
  const mesPasado = sumarMeses(mesDe(H), -1);
  if (!ultKdp || ultKdp < sumarMeses(mesDe(H), -1)) avisos.push({ c: 'ambar', t: `📈 Falta el informe de KDP de <b>${nombreMes(ultKdp ? sumarMeses(ultKdp, 1) : mesPasado)}</b>. Amazon lo publica hacia el día 15 del mes siguiente.`, ir: 'kdp' });
  const sinLibro = [...D.kdp.ventas, ...D.kdp.kenp].filter(f => !libroDeFila(f)).length;
  if (sinLibro) avisos.push({ c: 'ambar', t: `📚 ${plural(sinLibro, 'fila de KDP no sabe', 'filas de KDP no saben')} de qué libro es.`, ir: 'kdp', ui: { kPest: 'sinlibro' } });
  const vdSinFecha = D.ventas.filter(v => !v.fecha && v.estado !== 'Cancelado').length;
  if (vdSinFecha) avisos.push({ c: 'ambar', t: `📦 ${plural(vdSinFecha, 'pedido de venta directa no tiene', 'pedidos de venta directa no tienen')} fecha: no cuentan en ningún mes ni en los impuestos.`, ir: 'ingresos', ui: { iPest: 'directa' } });
  const noDed = D.gastos.filter(g => anioDe(g.fecha) === Y && !g.deducible && n(g.base)).length;
  if (noDed) avisos.push({ c: '', t: `🧾 ${plural(noDed, 'gasto sin marcar como deducible', 'gastos sin marcar como deducibles')}: no restan en los impuestos.`, ir: 'gastos' });
  const noPag = D.gastos.filter(g => !g.pagado && n(g.base)).length;
  if (noPag) avisos.push({ c: '', t: `💸 ${plural(noPag, 'gasto sin marcar como pagado', 'gastos sin marcar como pagados')}.`, ir: 'gastos' });
  if (C.pendExtra > 0) avisos.push({ c: '', t: `💰 Pendiente de cobrar (ingresos extra): <b>${fmtE(C.pendExtra)}</b>`, ir: 'ingresos' });
  D.libros.forEach(l => { if (l.select && l.renovSelect) { const d = diasEntre(H, l.renovSelect); if (d >= 0 && d <= 14) avisos.push({ c: d <= 3 ? 'rojo' : 'ambar', t: `🔁 KDP Select de <b>${esc(l.titulo)}</b> se renueva ${d === 0 ? 'hoy' : `en ${plural(d, 'día', 'días')}`}.`, ir: 'libros' }); } });
  // Próxima presentación trimestral
  const T = trimDe(H), Yt = aFecha(H).getFullYear();
  let pl = null;
  for (const [y, t] of [T === 1 ? [Yt - 1, 4] : [Yt, T - 1], [Yt, T]]) { const p = plazoTrimestre(y, t); if (p.hasta >= H) { pl = { y, t, ...p }; break; } }
  if (pl) { const d = diasEntre(H, pl.desde), dh = diasEntre(H, pl.hasta); avisos.push({ c: d <= 0 ? 'rojo' : d <= 15 ? 'ambar' : '', t: `🗓️ IVA e IRPF del ${pl.t}.º trimestre ${pl.y}: ${d <= 0 ? `<b>plazo abierto, acaba en ${plural(dh, 'día', 'días')}</b>` : `se presenta del ${fechaCorta(pl.desde)} al ${fechaCorta(pl.hasta)} (en ${plural(d, 'día', 'días')})`}`, ir: 'impuestos', ui: { fAnio: pl.y, fTrim: pl.t } }); }

  cont.innerHTML = `<div class="pagina ancha inicio">
    ${cabecera('Centro de Control', `Tu negocio, tus libros. ${esteAnio ? 'Datos de ' + Y + ' hasta hoy.' : 'Año ' + Y + '.'}`, selectorAnio())}
    <div class="cifras-grandes">
      ${cifra('Ingresos', fmtE0(R.ingresos), `${fmtE0(R.kdp + R.kenp)} de Amazon`)}
      ${cifra('Gastos', fmtE0(R.gastosTot), R.costesVD ? `con ${fmtE0(R.costesVD)} de venta directa` : '')}
      ${cifra('Beneficio', fmtE0(R.beneficio), R.ingresos ? `margen ${fmtP(R.beneficio / R.ingresos)}` : '', R.beneficio < 0 ? 'neg' : '')}
      <div class="cifra objetivo"><span class="ct">Objetivo anual</span><b>${fmtP(pctObj)}</b><div class="barra-obj"><i style="width:${Math.min(100, pctObj * 100)}%"></i>${esteAnio ? `<em style="left:${ritmo * 100}%" title="Lo que tocaría a estas alturas del año"></em>` : ''}</div>
        <small>${fmtE0(R.ingresos)} de ${fmtE0(objetivo)}${esteAnio ? ` · ${pctObj >= ritmo ? '🟢 a buen ritmo' : '🔴 por detrás del ritmo'}` : ''}</small></div>
    </div>
    ${avisos.length ? `<div class="avisos-in">${avisos.map((a, i) => `<button class="aviso-in ${a.c}" data-av="${i}">${a.t}</button>`).join('')}</div>` : ''}
    <div class="rejilla-in">
      <div class="col">
        <section class="tarjeta"><div class="t-cab"><h2>Ingresos por mes</h2><span class="tenue">${fmtN(R.uds)} uds · ${fmtN(R.paginas)} págs. KENP</span></div>
          ${grafBarras(meses, SERIES_ING, (m, k) => (M[m] || {})[k] || 0)}
          <details class="ver-tabla"><summary>Ver en tabla</summary>${tabla([
            { t: 'Mes', v: f => may(MESES[+f.m.slice(5) - 1]) },
            ...SERIES_ING.map(s => ({ t: s.nombre, cl: 'num', v: f => fmtE(f.o[s.k]), pie: fmtE(R[s.k]) })),
            { t: 'Gastos', cl: 'num', v: f => fmtE(totalGastos(f.o)), pie: fmtE(R.gastosTot) },
            { t: 'Beneficio', cl: 'num', v: f => fmtE(totalIngresos(f.o) - totalGastos(f.o)), pie: fmtE(R.beneficio) },
          ], meses.map(m => ({ m, o: M[m] || { kdp: 0, kenp: 0, extra: 0, directa: 0, gastos: 0, costesVD: 0 } })), { pie: true })}</details>
        </section>
        <section class="tarjeta"><div class="t-cab"><h2>De dónde viene el dinero</h2></div>
          ${grafHoriz(SERIES_ING.map(s => ({ t: s.nombre, v: R[s.k], color: s.color })))}
          <p class="tenue nota-kenp">KENP se calcula a ${fmtN(n(D.ajustes.kenpTasa) * 1000, 2)} € cada 1.000 páginas (cámbialo en Ajustes). Ingresos extra sin IVA ni retención. Venta directa sin IVA.</p></section>
      </div>
      <div class="col">
        <section class="tarjeta"><div class="t-cab"><h2>Caja</h2><a href="#" data-ir="caja" class="enlace">Por meses</a></div>
          <div class="caja">
            <div><span>Dinero que debería haber entrado (neto)</span><b>${fmtE(C.cajaHoy)}</b></div>
            <div><span>Amazon pendiente de pagarte</span><b>${fmtE(C.pendKdp)}</b></div>
            <div><span>Ingresos extra sin cobrar</span><b>${fmtE(C.pendExtra)}</b></div>
            <div><span>Gastos sin pagar</span><b>${fmtE(C.pendPago)}</b></div>
          </div>
          <p class="tenue" style="font-size:12px;margin:8px 0 0">Amazon paga unos ${D.ajustes.mesesCobroKdp} meses después del mes de la venta.</p></section>
        <section class="tarjeta"><div class="t-cab"><h2>Tus libros en ${Y}</h2><a href="#libros" class="enlace">Todos</a></div>
          ${libros.length ? `<ul class="top-libros">${libros.slice(0, 6).map(x => { const tr = tendencia(x, ultKdp); return `<li data-libro="${x.libro.id}">${x.libro.portada ? `<img src="${x.libro.portada}" alt="">` : `<span class="sin-portada">${esc(x.libro.titulo[0])}</span>`}<div><b>${esc(tituloLibro(x.libro))}</b><small>${fmtN(x.uds)} uds · ${fmtN(x.paginas)} págs.${tr.t !== 'sin datos' ? ` · <span class="tend ${tr.c}">${tr.t}</span>` : ''}</small></div><strong>${fmtE0(x.ingresos)}</strong></li>`; }).join('')}</ul>` : '<p class="vacio">Sin ventas este año</p>'}</section>
        <section class="tarjeta"><div class="t-cab"><h2>Último mes con datos de KDP</h2><span class="tenue">${ultKdp ? nombreMes(ultKdp) : '—'}</span></div>
          ${ultKdp ? (() => { const o = M[ultKdp] || {}; const ant = M[sumarMeses(ultKdp, -1)] || {}; const a = (o.kdp || 0) + (o.kenp || 0), b = (ant.kdp || 0) + (ant.kenp || 0);
            return `<div class="cifras-peq">${cifra('Amazon', fmtE(a), b ? `${a >= b ? '▲' : '▼'} ${fmtP(Math.abs(a - b) / b)} vs. mes anterior` : '')}${cifra('Unidades', fmtN(o.uds || 0))}${cifra('Páginas KENP', fmtN(o.paginas || 0))}</div>`; })() : '<p class="vacio">Sube tu primer informe de KDP</p>'}
          <button class="btn peq" data-ir="kdp" style="margin-top:10px">📈 Subir informe de KDP</button></section>
      </div>
    </div></div>`;

  enlazarAnio(cont); enlazarGraficos(cont);
  $$('[data-av]', cont).forEach(b => b.onclick = () => { const a = avisos[+b.dataset.av]; irA(a.ir, { ui: a.ui }); });
  $$('[data-ir]', cont).forEach(b => b.onclick = (e) => { e.preventDefault(); if (b.dataset.ir === 'caja') irA('informe', { ui: { infPest: 'caja' } }); else irA(b.dataset.ir); });
  $$('[data-libro]', cont).forEach(li => li.onclick = () => irA('libros', { ui: { libro: li.dataset.libro } }));
};
