'use strict';
// =====================================================================
//  Centro de Control — Impuestos: estimación del IVA (303) y del pago
//  fraccionado del IRPF (130) de cada trimestre, el resumen para la
//  gestoría (para imprimir o guardar en PDF), el registro de lo que
//  pagas y el calendario fiscal.
// =====================================================================

VISTAS.impuestos = (cont) => {
  const H = hoy();
  const Y = UI.fAnio || aFecha(H).getFullYear();
  const T = UI.fTrim || (trimDe(H) === 1 ? 4 : trimDe(H) - 1);
  const f = fiscalTrimestre(Y, T);
  const pf = pagosFraccionados(Y)[T - 1];
  const pl = plazoTrimestre(Y, T);
  const A = D.ajustes;
  const p = UI.fPest || 'trimestre';
  const anual = [1, 2, 3, 4].map(t => fiscalTrimestre(Y, t));
  const sumA = (k) => anual.reduce((a, x) => a + x[k], 0);
  const pagos = D.impuestos.filter(i => anioDe(i.fecha) === Y).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const lineas = [
    ['Ingresos de Amazon (regalías)', f.kdp], ['Ingresos de Amazon (KENP, estimado)', f.kenp],
    ['Facturas e ingresos extra (base, sin IVA)', f.extraBase], ['Venta directa (sin IVA)', f.directaBase],
    ['<b>Total ingresos</b>', f.ingresos, 'tot'],
    ['Gastos deducibles (base, sin IVA)', -f.gastosBase], ['Costes de la venta directa', -f.costesVD],
    ['<b>Rendimiento neto del trimestre</b>', f.rendimiento, 'tot'],
  ];
  const resumen = `<div class="gestoria" id="gestoria">
      <div class="g-cab"><div><h3>Resumen para la gestoría</h3><p>${esc(A.nombreFiscal || '')}${A.nif ? ' · NIF ' + esc(A.nif) : ''}<br>${esc(A.actividad || '')}</p></div><div class="g-t"><b>${T}.º trimestre ${Y}</b><span>${fechaCorta(rangoTrimestre(Y, T)[0] + '-01')} – ${fechaCorta(rangoTrimestre(Y, T)[2] + '-' + pad(diasDelMes(rangoTrimestre(Y, T)[2])))}</span></div></div>
      <table class="tabla g-tabla">${lineas.map(([t, v, c]) => `<tr class="${c || ''}"><td>${t}</td><td class="num">${fmtE(v)}</td></tr>`).join('')}</table>
      <h4>IVA · modelo 303 (estimado)</h4>
      <table class="tabla g-tabla"><tr><td>IVA repercutido (facturas${n(A.ivaVentaDirecta) ? ' y venta directa' : ''})</td><td class="num">${fmtE(f.ivaRep + f.ivaRepVD)}</td></tr><tr><td>IVA soportado deducible (gastos)</td><td class="num">−${fmtE(f.ivaSop)}</td></tr><tr class="tot"><td><b>${f.iva303 >= 0 ? 'A ingresar' : 'A compensar'}</b></td><td class="num"><b>${fmtE(Math.abs(f.iva303))}</b></td></tr></table>
      <h4>IRPF · pago fraccionado (estimado)</h4>
      <table class="tabla g-tabla"><tr><td>Rendimiento acumulado del año (hasta este trimestre)</td><td class="num">${fmtE(pf.rendAcum)}</td></tr><tr><td>${fmtN(A.pctPagoFraccionado)} % del rendimiento acumulado</td><td class="num">${fmtE(pf.rendAcum * n(A.pctPagoFraccionado) / 100)}</td></tr><tr><td>Retenciones que te han hecho en el año</td><td class="num">−${fmtE(pf.retAcum)}</td></tr><tr><td>Pagos fraccionados de trimestres anteriores (estimados)</td><td class="num">−${fmtE(Math.max(0, pf.rendAcum * n(A.pctPagoFraccionado) / 100 - pf.retAcum - pf.pago))}</td></tr><tr class="tot"><td><b>A ingresar este trimestre</b></td><td class="num"><b>${fmtE(pf.pago)}</b></td></tr></table>
      <p class="g-nota">Estimación hecha con los datos del Centro de Control, no una declaración lista para presentar. Supuestos: estimación directa; los ingresos de Amazon no llevan IVA español; KENP calculado a ${fmtN(n(A.kenpTasa) * 1000, 2)} €/1.000 páginas; pago fraccionado al ${fmtN(A.pctPagoFraccionado)} %. Generado el ${fechaCorta(H)} ${anioDe(H)}.</p>
    </div>`;

  cont.innerHTML = `<div class="pagina ancha impuestos">${cabecera('🧾 Impuestos', 'Estimación de lo que toca pagar cada trimestre, el resumen para la gestoría y lo que ya has pagado.',
    `<div class="nav-cal"><button class="icono" data-mt="-1" aria-label="Trimestre anterior">‹</button><h2 class="titulo-cal">${T}.º trim. ${Y}</h2><button class="icono" data-mt="1" aria-label="Trimestre siguiente">›</button></div>`)}
    ${pestanas([['trimestre', 'Trimestre'], ['anio', `Año ${Y}`], ['pagos', `Pagos y presentaciones (${pagos.length})`], ['calendario', 'Calendario fiscal']], p, 'fPest')}
    <div id="im-cuerpo">${p === 'trimestre' ? `
      <div class="cifras-grandes">${cifra('IVA (303)', fmtE(f.iva303), f.iva303 < 0 ? 'a compensar' : 'a ingresar')}${cifra('IRPF (pago fraccionado)', fmtE(pf.pago), `${fmtN(A.pctPagoFraccionado)} % menos retenciones`)}${cifra('Rendimiento del trimestre', fmtE(f.rendimiento))}${cifra('Plazo', `${fechaCorta(pl.desde)} – ${fechaCorta(pl.hasta)}`, diasEntre(H, pl.hasta) < 0 ? 'ya pasó' : diasEntre(H, pl.desde) <= 0 ? `<b class="rojo">abierto: quedan ${plural(diasEntre(H, pl.hasta), 'día', 'días')}</b>` : `empieza en ${plural(diasEntre(H, pl.desde), 'día', 'días')}`)}</div>
      ${f.sinMarcar ? `<p class="nota">${plural(f.sinMarcar, 'gasto de este trimestre no está marcado', 'gastos de este trimestre no están marcados')} como deducible${f.sinMarcar > 1 ? 's' : ''} (${fmtE(f.gastosNoDed)}): no restan. <a href="#gastos">Revisar gastos</a></p>` : ''}
      ${D.ventas.some(v => !v.fecha) ? `<p class="nota">Hay pedidos de venta directa sin fecha: no cuentan aquí. <a href="#ingresos">Ponles fecha</a></p>` : ''}
      <div class="fila-btns"><button class="btn prim" id="im-imprimir">🖨️ Imprimir o guardar en PDF</button><button class="btn" id="im-copiar">Copiar como texto</button><button class="btn" id="im-apuntar">Apuntar lo pagado…</button></div>
      ${resumen}` : p === 'anio' ? `
      ${tabla([{ t: 'Trimestre', v: x => `${x._t}.º trimestre` }, { t: 'Ingresos', cl: 'num', v: x => fmtE(x.ingresos), pie: fmtE(sumA('ingresos')) }, { t: 'Gastos deducibles', cl: 'num', v: x => fmtE(x.gastosBase + x.costesVD), pie: fmtE(sumA('gastosBase') + sumA('costesVD')) }, { t: 'Rendimiento', cl: 'num', v: x => fmtE(x.rendimiento), pie: fmtE(sumA('rendimiento')) }, { t: 'IVA repercutido', cl: 'num', v: x => fmtE(x.ivaRep + x.ivaRepVD), pie: fmtE(sumA('ivaRep') + sumA('ivaRepVD')) }, { t: 'IVA soportado', cl: 'num', v: x => fmtE(x.ivaSop), pie: fmtE(sumA('ivaSop')) }, { t: 'IVA 303', cl: 'num', v: x => fmtE(x.iva303), pie: fmtE(sumA('iva303')) }, { t: 'Retenciones', cl: 'num', v: x => fmtE(x.retenciones), pie: fmtE(sumA('retenciones')) }, { t: 'Pago fracc.', cl: 'num', v: x => fmtE(x.pf), pie: fmtE(pagosFraccionados(Y).reduce((a, x) => a + x.pago, 0)) }],
        anual.map((x, i) => ({ ...x, pf: pagosFraccionados(Y)[i].pago, _t: i + 1 })), { pie: true })}
      <p class="tenue">En la declaración de la Renta se regulariza el año entero: rendimiento ${fmtE(sumA('rendimiento'))}, retenciones ${fmtE(sumA('retenciones'))}.</p>` : p === 'pagos' ? `
      <div class="fila-btns"><button class="btn prim" id="im-apuntar">+ Apuntar un pago o presentación</button></div>
      ${tabla([{ t: 'Fecha', v: i => fechaCorta(i.fecha) }, { t: 'Concepto', v: i => esc(i.concepto) }, { t: 'Importe', cl: 'num', v: i => fmtE(n(i.importe)), pie: fmtE(pagos.reduce((a, i) => a + n(i.importe), 0)) }, { t: 'Notas', v: i => esc(i.notas || '') }], pagos, { id: 'im-tabla', clickable: true, pie: true, vacio: `No has apuntado pagos en ${Y}.` })}` : calendarioFiscal()}
    </div></div>`;

  enlazarPestanas(cont);
  $$('[data-mt]', cont).forEach(b => b.onclick = () => { let t = T + Number(b.dataset.mt), y = Y; if (t < 1) { t = 4; y--; } if (t > 4) { t = 1; y++; } UI.fAnio = y; UI.fTrim = t; guardarUI(); pintar(); });
  if ($('#im-imprimir', cont)) $('#im-imprimir', cont).onclick = () => { document.body.classList.add('imprimir-gestoria'); window.print(); setTimeout(() => document.body.classList.remove('imprimir-gestoria'), 500); };
  if ($('#im-copiar', cont)) $('#im-copiar', cont).onclick = async () => { try { await navigator.clipboard.writeText($('#gestoria').innerText); aviso('Copiado: pégalo en un correo a tu gestoría'); } catch (e) { aviso('No he podido copiarlo'); } };
  $$('#im-apuntar', cont).forEach(b => b.onclick = () => editarPago({ fecha: hoy() }, { nueva: true, sugerido: f, pf: pf.pago }));
  enlazarTabla(cont, 'im-tabla', pagos, (i) => editarPago(i));
};

function editarPago(i, { nueva = false, sugerido, pf } = {}) {
  const campos = [
    { k: 'concepto', t: 'Concepto', tipo: 'lista', op: D.listas.conceptoImpuesto },
    { k: 'fecha', t: 'Fecha', tipo: 'fecha', ancho: 'medio' },
    { k: 'importe', t: 'Importe pagado (€)', tipo: 'num', ancho: 'medio', ayuda: sugerido ? `Estimado este trimestre: IVA ${fmtE(Math.max(0, sugerido.iva303))} · IRPF ${fmtE(pf || 0)}` : '' },
    { k: 'notas', t: 'Notas', tipo: 'area', filas: 2 },
  ];
  ficha({
    titulo: nueva ? 'Apuntar pago o presentación' : 'Pago', obj: i, campos,
    onGuardar: (r) => {
      if (!r.concepto) { aviso('Escribe el concepto'); return false; }
      const fin = { ...r, id: i.id || uid(), importe: n(r.importe) };
      if (nueva) D.impuestos.push(fin); else D.impuestos[D.impuestos.findIndex(x => x.id === i.id)] = fin;
      cambio();
    },
    onBorrar: nueva ? null : async () => { borrarConDeshacer('impuestos', i.id, 'Pago borrado'); return true; },
  });
}

function calendarioFiscal() {
  const filas = [
    ['IVA · modelo 303', 'Trimestral', '1-20 de abril, julio y octubre; 1-30 de enero (4.º trimestre)'],
    ['IVA · resumen anual, modelo 390', 'Anual', '1-30 de enero (informativo, no es un pago)'],
    ['IRPF · pago fraccionado', 'Trimestral', 'Mismas fechas que el 303'],
    ['Declaración de la Renta', 'Anual', 'Primavera; se regulariza lo pagado a cuenta'],
    ['Cuota de autónomos (RETA)', 'Mensual', 'Se cobra sola si está domiciliada'],
    ['Operaciones intracomunitarias · modelo 349', 'Si aplica', 'Solo si facturas a empresas de la UE con NIF-IVA'],
    ['Retenciones de Amazon', '—', 'Amazon descuenta su parte antes de pagarte; no presentas modelo por esto'],
  ];
  return `${tabla([{ t: 'Impuesto o modelo', v: f => esc(f[0]) }, { t: '¿Cada cuánto?', v: f => esc(f[1]) }, { t: 'Cuándo se presenta', v: f => esc(f[2]) }], filas)}
    <p class="nota">Si tributas en Álava (hacienda foral), los modelos, plazos y el porcentaje del pago fraccionado pueden ser distintos a los del Estado. Confírmalos con tu gestoría y, si hace falta, cambia el porcentaje en Ajustes.</p>`;
}
