'use strict';
// =====================================================================
//  Centro de Control — Informe del año (antes Informe anual y
//  Evolución) y la caja mes a mes (antes Tesorería).
// =====================================================================

VISTAS.informe = (cont) => {
  const p = UI.infPest || 'anio';
  cont.innerHTML = `<div class="pagina ancha informe">${cabecera('📅 Informe', 'El año de un vistazo, comparado con el anterior, y el dinero que entra y sale cada mes.', selectorAnio())}
    ${pestanas([['anio', 'El año'], ['comparar', 'Comparar con el año anterior'], ['caja', 'Caja mes a mes'], ['reflexion', 'Mi año como autora']], p, 'infPest')}<div id="if-cuerpo"></div></div>`;
  enlazarPestanas(cont); enlazarAnio(cont);
  const c = $('#if-cuerpo', cont);
  ({ comparar: infComparar, caja: infCaja, reflexion: infReflexion }[p] || infAnio)(c);
  enlazarGraficos(c);
};

function infAnio(c) {
  const Y = anioUI(), R = resumenAnio(Y), M = porMes();
  const meses = Array.from({ length: 12 }, (_, i) => `${Y}-${pad(i + 1)}`);
  const libros = [...porLibro(Y).values()].filter(x => x.libro && x.ingresos).sort((a, b) => b.ingresos - a.ingresos);
  const publicados = D.libros.filter(l => anioDe(l.fechaPub) === Y || anioDe(l.fechaReed) === Y);
  const top = libros[0];
  c.innerHTML = `<div class="cifras-grandes">${cifra('Ingresos', fmtE0(R.ingresos))}${cifra('Gastos', fmtE0(R.gastosTot))}${cifra('Beneficio', fmtE0(R.beneficio), R.ingresos ? 'margen ' + fmtP(R.beneficio / R.ingresos) : '', R.beneficio < 0 ? 'neg' : '')}${cifra('Objetivo', fmtP(n(D.ajustes.objetivo) ? R.ingresos / n(D.ajustes.objetivo) : 0), 'de ' + fmtE0(D.ajustes.objetivo))}</div>
    <div class="cifras-grandes peq">${cifra('Libros publicados o reeditados', fmtN(publicados.length), publicados.map(l => esc(tituloLibro(l))).join(', ') || '—')}${cifra('Libro que más ha ingresado', top ? esc(tituloLibro(top.libro)) : '—', top ? fmtE0(top.ingresos) : '')}${cifra('Unidades vendidas en Amazon', fmtN(R.uds))}${cifra('Páginas KENP leídas', fmtN(R.paginas))}</div>
    <div class="rejilla r2">
      <section class="tarjeta"><h2>Ingresos por mes</h2>${grafBarras(meses, SERIES_ING, (m, k) => (M[m] || {})[k] || 0)}</section>
      <section class="tarjeta"><h2>Beneficio por mes</h2>${grafBarras(meses, [{ k: 'b', nombre: 'Beneficio', color: 'var(--acento)' }], (m) => { const o = M[m]; return o ? totalIngresos(o) - totalGastos(o) : 0; })}
        ${meses.some(m => M[m] && totalIngresos(M[m]) - totalGastos(M[m]) < 0) ? '<p class="tenue">Los meses con pérdidas salen a 0 en el gráfico; mira la tabla.</p>' : ''}</section>
      <section class="tarjeta"><h2>De dónde viene el dinero</h2>${grafHoriz(SERIES_ING.map(s => ({ t: s.nombre, v: R[s.k], color: s.color })))}</section>
      <section class="tarjeta"><h2>Ingresos por libro</h2>${libros.length ? grafHoriz(libros.slice(0, 12).map(x => ({ t: tituloLibro(x.libro), v: x.ingresos }))) : '<p class="vacio">Sin ventas</p>'}</section>
    </div>
    <section class="tarjeta" style="margin-top:16px"><h2>Mes a mes</h2>${tabla([
      { t: 'Mes', v: f => may(MESES[+f.m.slice(5) - 1]) },
      ...SERIES_ING.map(s => ({ t: s.nombre, cl: 'num', v: f => fmtE(f.o[s.k]), pie: fmtE(R[s.k]) })),
      { t: 'Ingresos', cl: 'num', v: f => fmtE(totalIngresos(f.o)), pie: fmtE(R.ingresos) },
      { t: 'Gastos', cl: 'num', v: f => fmtE(totalGastos(f.o)), pie: fmtE(R.gastosTot) },
      { t: 'Beneficio', cl: 'num', v: f => fmtE(totalIngresos(f.o) - totalGastos(f.o)), pie: fmtE(R.beneficio) },
      { t: 'Objetivo del mes', cl: 'num', v: f => fmtE(n(D.ajustes.objetivo) / 12) },
    ], meses.map(m => ({ m, o: M[m] || { kdp: 0, kenp: 0, extra: 0, directa: 0, gastos: 0, costesVD: 0 } })), { pie: true })}</section>`;
}

function infComparar(c) {
  const Y = anioUI(), M = porMes();
  const ben = (m) => { const o = M[m]; return o ? totalIngresos(o) - totalGastos(o) : 0; };
  const ing = (m) => M[m] ? totalIngresos(M[m]) : 0;
  const filas = Array.from({ length: 12 }, (_, i) => ({ i, a: `${Y}-${pad(i + 1)}`, b: `${Y - 1}-${pad(i + 1)}` }));
  const hayAnt = filas.some(f => M[f.b]);
  const tot = (fn, k) => filas.reduce((a, f) => a + fn(f[k]), 0);
  c.innerHTML = `${hayAnt ? '' : `<p class="nota">No hay datos de ${Y - 1}: la comparación saldrá cuando los tengas.</p>`}
    <section class="tarjeta"><h2>Ingresos: ${Y} y ${Y - 1}</h2><div class="leyenda-g"><span><i style="background:var(--s1)"></i>${Y}</span><span><i style="background:var(--s2)"></i>${Y - 1}</span></div>
      ${grafComparar(filas, ing, Y)}</section>
    <section class="tarjeta" style="margin-top:16px">${tabla([
      { t: 'Mes', v: f => may(MESES[f.i]) },
      { t: `Ingresos ${Y}`, cl: 'num', v: f => fmtE(ing(f.a)), pie: fmtE(tot(ing, 'a')) },
      { t: `Ingresos ${Y - 1}`, cl: 'num', v: f => fmtE(ing(f.b)), pie: fmtE(tot(ing, 'b')) },
      { t: `Beneficio ${Y}`, cl: 'num', v: f => fmtE(ben(f.a)), pie: fmtE(tot(ben, 'a')) },
      { t: `Beneficio ${Y - 1}`, cl: 'num', v: f => fmtE(ben(f.b)), pie: fmtE(tot(ben, 'b')) },
      { t: 'Variación beneficio', cl: 'num', v: f => { const a = ben(f.a), b = ben(f.b); return b ? `<span class="${a >= b ? 'sube' : 'baja'}">${a >= b ? '▲' : '▼'} ${fmtP(Math.abs(a - b) / Math.abs(b))}</span>` : '—'; } },
    ], filas, { pie: true })}</section>`;
}
// Barras agrupadas: dos años lado a lado
function grafComparar(filas, fn, Y) {
  const W = 640, H = 220, iz = 46, ab = 22, ar = 8, an = (W - iz - 4) / 12, bw = Math.min(14, an * .32);
  const max = Math.max(1, ...filas.flatMap(f => [fn(f.a), fn(f.b)]));
  const paso = Math.pow(10, Math.floor(Math.log10(max))), tope = Math.ceil(max / paso) * paso;
  const y = (v) => ar + (H - ar - ab) * (1 - v / tope);
  const rej = [0, .5, 1].map(f => `<line x1="${iz}" x2="${W}" y1="${y(tope * f)}" y2="${y(tope * f)}" class="g-rejilla"/><text x="${iz - 6}" y="${y(tope * f) + 4}" class="g-eje" text-anchor="end">${fmtN(tope * f)}</text>`).join('');
  const barras = filas.map(f => { const x = iz + f.i * an + an / 2; const a = fn(f.a), b = fn(f.b);
    return `<g class="g-barra" data-tip="${may(MESES[f.i])}|${Y}: ${fmtE(a)}|${Y - 1}: ${fmtE(b)}"><rect x="${iz + f.i * an}" y="${ar}" width="${an}" height="${H - ar - ab}" fill="transparent"/>
      <rect x="${x - bw - 1}" y="${y(b)}" width="${bw}" height="${Math.max(0, y(0) - y(b))}" rx="3" fill="var(--s2)"/><rect x="${x + 1}" y="${y(a)}" width="${bw}" height="${Math.max(0, y(0) - y(a))}" rx="3" fill="var(--s1)"/>
      <text x="${x}" y="${H - 6}" class="g-eje" text-anchor="middle">${MESES_C[f.i]}</text></g>`; }).join('');
  return `<div class="grafico"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos de ${Y} y ${Y - 1} por mes">${rej}${barras}</svg><div class="g-tip" hidden></div></div>`;
}

function infCaja(c) {
  const Y = anioUI(), C = caja(Y);
  c.innerHTML = `<div class="cifras-grandes peq">${cifra('Caja a día de hoy', fmtE(C.cajaHoy), 'saldo inicial + cobrado − pagado')}${cifra('Amazon te debe', fmtE(C.pendKdp))}${cifra('Facturas sin cobrar', fmtE(C.pendExtra))}${cifra('Gastos sin pagar', fmtE(C.pendPago))}</div>
    ${tabla([
      { t: 'Mes', v: f => may(MESES[+f.mes.slice(5) - 1]) + (f.futuro ? ' <small class="tenue">(previsto)</small>' : '') },
      { t: 'Cobro de Amazon', cl: 'num', v: f => fmtE(f.kdp), pie: fmtE(C.filas.reduce((a, f) => a + f.kdp, 0)) },
      { t: 'Facturas cobradas', cl: 'num', v: f => fmtE(f.extra), pie: fmtE(C.filas.reduce((a, f) => a + f.extra, 0)) },
      { t: 'Venta directa (neto)', cl: 'num', v: f => fmtE(f.directa), pie: fmtE(C.filas.reduce((a, f) => a + f.directa, 0)) },
      { t: 'Gastos pagados', cl: 'num', v: f => fmtE(-f.pagado), pie: fmtE(-C.filas.reduce((a, f) => a + f.pagado, 0)) },
      { t: 'Neto del mes', cl: 'num', v: f => fmtE(f.neto), pie: fmtE(C.filas.reduce((a, f) => a + f.neto, 0)) },
      { t: 'Acumulado', cl: 'num total', v: f => fmtE(f.acum) },
    ], C.filas.map(f => ({ ...f, _cl: f.futuro ? 'futuro' : '' })), { pie: true })}
    <p class="tenue">Amazon paga cada mes lo vendido ${D.ajustes.mesesCobroKdp} meses antes. Las facturas cuentan cuando las marcas como cobradas, y los gastos cuando los marcas como pagados. El saldo inicial se pone en Ajustes.</p>`;
}

function infReflexion(c) {
  const Y = anioUI(); const R = D.informe[Y] || {};
  const preguntas = [['publique', 'Este año publiqué…'], ['orgullo', 'Lo que más orgullosa me hace…'], ['dificil', 'Lo más difícil fue…'], ['repetiria', 'Lo volvería a hacer porque…'],
    ['sorpresa', 'La mayor sorpresa fue…'], ['ayuda', 'La persona que más me ayudó…'], ['lectora', 'La lectora que nunca olvidaré…'], ['momento', 'Mi momento favorito…'], ['diezanios', 'Lo que quiero recordar cuando lea esto dentro de diez años…']];
  c.innerHTML = `<p class="suave">Para cerrar el año. Se guarda solo mientras escribes.</p><div class="reflexion">${preguntas.map(([k, t]) => `<label class="campo"><span>${t}</span><textarea data-r="${k}" rows="3">${esc(R[k] || '')}</textarea></label>`).join('')}</div>`;
  $$('[data-r]', c).forEach(t => t.oninput = debounce(() => { const o = D.informe[Y] || (D.informe[Y] = {}); o[t.dataset.r] = t.value; cambio(false); }, 500));
}
