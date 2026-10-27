'use strict';
// =====================================================================
//  Centro de Control — cómo son los datos y todos los cálculos que en
//  el Excel hacían las fórmulas (regalías, KENP, beneficio, caja, IVA…).
// =====================================================================

const FUENTES = [
  ['kdp', 'Regalías KDP', 'var(--s1)'], ['kenp', 'KENP (páginas leídas)', 'var(--s2)'],
  ['extra', 'Ingresos extra', 'var(--s3)'], ['directa', 'Venta directa', 'var(--s4)'],
];

function datosVacios() {
  return {
    app: 'centro', version: 1,
    libros: [], kdp: { ventas: [], kenp: [] }, ingresos: [], ventas: [], gastos: [], impuestos: [],
    informe: {},
    listas: listasPorDefecto(),
    ajustes: {
      objetivo: 30000, saldoInicial: 0, kenpTasa: 0.0042, kenpTasas: {},
      cambios: { EUR: 1, USD: 0.8662, GBP: 1.1715, JPY: 0.0054, CAD: 0.622, AUD: 0.6125, MXN: 0.0508, BRL: 0.168, INR: 0.0091, SEK: 0.0909, PLN: 0.2323 },
      fechaCambios: '', nombreFiscal: '', nif: '', actividad: 'Autora - venta de libros (digital/papel) y derechos de autor',
      irpfIngresos: 15, ivaGastos: 21, ivaVentaDirecta: 0, pctPagoFraccionado: 20, mesesCobroKdp: 2,
      copiaDias: 7, tema: 'auto',
    },
  };
}
function listasPorDefecto() {
  return {
    estadoLibro: ['Activo', 'Próximo', 'Promoción', 'Pausado', 'Descatalogado'],
    genero: ['Romántica contemporánea', 'Comedia romántica', 'Chick-Lit', 'FeelGood', 'Erótica'],
    serie: [], universo: [], estadoComercial: ['Potenciar', 'Mantener', 'Reactivar', 'Pausar'], prioridad: ['Alta', 'Media', 'Baja'],
    lineaIngreso: ['Club de lectura', 'Charlas', 'Editorial', 'Derechos', 'Otros'],
    estadoCobro: ['Cobrado', 'Pendiente', 'Parcial', 'Devuelto'],
    formato: ['eBook', 'Papel', 'Tapa dura', 'Edición especial', 'Audiolibro'],
    estadoVenta: ['Pendiente', 'Pagado', 'Preparando', 'Enviado', 'Entregado', 'Cancelado'],
    seguimiento: ['Sin enviar', 'En tránsito', 'Recibido', 'Incidencia'],
    catGasto: ['Publicidad', 'Marketing', 'Suscripciones', 'Producción libro', 'Corrección', 'Portada', 'Material promocional', 'Packaging', 'Envíos', 'Comisiones', 'Eventos', 'Formación', 'Oficina', 'Equipos', 'Viajes', 'Gestión', 'Impuestos', 'Otros'],
    subcatGasto: [], conceptoGasto: [],
    metodo: ['Tarjeta', 'Transferencia', 'PayPal', 'Bizum', 'Efectivo', 'Cuenta'],
    conceptoImpuesto: ['IVA trimestral - Modelo 303', 'IRPF pago fraccionado trimestral - Modelo 130', 'Resumen anual IVA - Modelo 390', 'Declaración de la Renta anual - IRPF', 'Cuota de autónomos (RETA) - mensual', 'Otro'],
  };
}
function completar(d) {
  const b = datosVacios();
  Object.keys(b).forEach(k => { if (d[k] === undefined) d[k] = b[k]; });
  ['ventas', 'kenp'].forEach(k => { if (!d.kdp[k]) d.kdp[k] = []; });
  Object.keys(b.ajustes).forEach(k => { if (d.ajustes[k] === undefined) d.ajustes[k] = b.ajustes[k]; });
  Object.keys(b.listas).forEach(k => { if (!d.listas[k] || !d.listas[k].length) d.listas[k] = b.listas[k]; });
  // Series y universos salen de los propios libros
  d.listas.serie = [...new Set([...d.listas.serie, ...d.libros.map(l => l.serie).filter(Boolean)])];
  d.libros.forEach(l => { ['tropos', 'categorias', 'keywords', 'codigos'].forEach(k => { if (!Array.isArray(l[k])) l[k] = l[k] ? [l[k]] : []; }); });
  return d;
}

// ---------- números ----------
const n = (v) => (typeof v === 'number' && isFinite(v)) ? v : (parseFloat(String(v ?? '').replace(',', '.')) || 0);
const r2 = (v) => Math.round(v * 100) / 100;
const fmtE = (v, dec = 2) => (v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtE0 = (v) => fmtE(v, 0);
const fmtN = (v, dec = 0) => (v || 0).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtP = (v, dec = 0) => isFinite(v) ? (v * 100).toLocaleString('es-ES', { maximumFractionDigits: dec }) + ' %' : '—';
const anioDe = (f) => f ? Number(String(f).slice(0, 4)) : 0;
const trimDe = (f) => Math.ceil(Number(String(f).slice(5, 7)) / 3);

// ---------- libros y códigos (ASIN / ISBN) ----------
const normCod = (c) => String(c || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
const normTit = (t) => quitarTildes(String(t || '').split(':')[0]).replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ').trim();
let _mapa = null, _mapaFirma = '';
function mapaCodigos() {
  const firma = D.libros.map(l => l.id + (l.asin || '') + (l.isbnAmazon || '') + (l.isbnPropio || '') + (l.codigos || []).join() + (l.estado || '')).join('|');
  if (_mapa && firma === _mapaFirma) return _mapa;
  _mapa = new Map(); _mapaFirma = firma;
  // Si dos libros comparten código (p. ej. una reedición), gana el que no está descatalogado
  const orden = [...D.libros].sort((a, b) => (a.estado === 'Descatalogado') - (b.estado === 'Descatalogado'));
  orden.reverse().forEach(l => [l.asin, l.isbnAmazon, l.isbnPropio, ...(l.codigos || [])].forEach(c => { if (normCod(c)) _mapa.set(normCod(c), l); }));
  return _mapa;
}
// Libro de una fila de KDP: por código; si no, por título exacto (antes de los dos puntos)
function libroDeFila(f) {
  if (f.libro) { const l = D.libros.find(x => x.id === f.libro); if (l) return l; }
  const l = mapaCodigos().get(normCod(f.codigo));
  if (l) return l;
  const t = normTit(f.titulo);
  const cands = D.libros.filter(x => normTit(x.titulo) === t);
  if (cands.length === 1) return cands[0];
  return null;
}
const libroPorId = (id) => D.libros.find(l => l.id === id);
// En ingresos, ventas y gastos el libro se guarda por título (como en el Excel) o por id
function libroDeTexto(v) {
  if (!v) return null;
  return D.libros.find(l => l.id === v) || D.libros.find(l => l.titulo === v) || null;
}
const tituloLibro = (l) => l ? l.titulo + (l.idioma === 'en' ? ' (EN)' : '') + (D.libros.filter(x => x.titulo === l.titulo && x.idioma === l.idioma).length > 1 ? ` · ${anioDe(l.fechaPub) || ''}` : '') : '';

// ---------- importes de cada cosa ----------
const tipoCambio = (m) => n(D.ajustes.cambios[m || 'EUR'] ?? 1) || 1;
const eurVenta = (f) => n(f.regalias) * tipoCambio(f.moneda);
const tasaKenp = (mes) => n((D.ajustes.kenpTasas || {})[mes]) || n(D.ajustes.kenpTasa);
const eurKenp = (f) => n(f.paginas) * tasaKenp(f.mes);
const ingreso = {
  iva: (i) => n(i.bruto) * n(i.ivaPct) / 100,
  irpf: (i) => n(i.bruto) * n(i.irpfPct) / 100,
  neto: (i) => n(i.bruto) * (1 + n(i.ivaPct) / 100 - n(i.irpfPct) / 100),
};
const venta = {
  // Lo que paga la lectora (libros + envío)
  cobrado: (v) => n(v.uds || 1) * n(v.pvp) + n(v.envioCobrado),
  // Sin el IVA de los libros, si lo cobras
  base: (v) => venta.cobrado(v) / (1 + n(D.ajustes.ivaVentaDirecta) / 100),
  ivaRep: (v) => venta.cobrado(v) - venta.base(v),
  costes: (v) => n(v.uds || 1) * n(v.costeUd) + n(v.costeEnvio) + n(v.regalos),
  beneficio: (v) => venta.base(v) - venta.costes(v),
};
const gasto = {
  iva: (g) => n(g.base) * n(g.ivaPct) / 100,
  total: (g) => n(g.base) * (1 + n(g.ivaPct) / 100),
};

// ---------- todo junto, por mes ----------
// Devuelve { 'AAAA-MM': {kdp, kenp, extra, directa, gastos, costesVD, uds, paginas} }
function porMes() {
  const M = {};
  const m = (k) => M[k] || (M[k] = { kdp: 0, kenp: 0, extra: 0, directa: 0, gastos: 0, costesVD: 0, uds: 0, paginas: 0 });
  D.kdp.ventas.forEach(f => { if (!f.mes) return; const o = m(f.mes); o.kdp += eurVenta(f); o.uds += n(f.netas); });
  D.kdp.kenp.forEach(f => { if (!f.mes) return; const o = m(f.mes); o.kenp += eurKenp(f); o.paginas += n(f.paginas); });
  D.ingresos.forEach(i => { if (!i.fecha) return; m(mesDe(i.fecha)).extra += n(i.bruto); });
  D.ventas.forEach(v => { if (!v.fecha || v.estado === 'Cancelado') return; const o = m(mesDe(v.fecha)); o.directa += venta.base(v); o.costesVD += venta.costes(v); });
  D.gastos.forEach(g => { if (!g.fecha) return; m(mesDe(g.fecha)).gastos += gasto.total(g); });
  return M;
}
const totalIngresos = (o) => o.kdp + o.kenp + o.extra + o.directa;
const totalGastos = (o) => o.gastos + o.costesVD;
function resumenAnio(Y, hastaMes = 12) {
  const M = porMes();
  const t = { kdp: 0, kenp: 0, extra: 0, directa: 0, gastos: 0, costesVD: 0, uds: 0, paginas: 0 };
  for (let i = 1; i <= hastaMes; i++) { const o = M[`${Y}-${pad(i)}`]; if (o) Object.keys(t).forEach(k => t[k] += o[k]); }
  t.ingresos = totalIngresos(t); t.gastosTot = totalGastos(t); t.beneficio = t.ingresos - t.gastosTot;
  return t;
}
const aniosConDatos = () => {
  const s = new Set([new Date().getFullYear()]);
  D.kdp.ventas.forEach(f => f.mes && s.add(anioDe(f.mes))); D.kdp.kenp.forEach(f => f.mes && s.add(anioDe(f.mes)));
  [...D.ingresos, ...D.gastos, ...D.ventas].forEach(x => x.fecha && s.add(anioDe(x.fecha)));
  return [...s].filter(Boolean).sort();
};

// ---------- por libro ----------
function porLibro(Y) {
  const out = new Map();
  const o = (l) => { const k = l ? l.id : '_'; if (!out.has(k)) out.set(k, { libro: l, kdp: 0, kenp: 0, paginas: 0, uds: 0, directa: 0, extra: 0, gastos: 0, meses: {} }); return out.get(k); };
  const enAnio = (mes) => !Y || anioDe(mes) === Y;
  D.kdp.ventas.forEach(f => { if (!enAnio(f.mes)) return; const x = o(libroDeFila(f)); const e = eurVenta(f); x.kdp += e; x.uds += n(f.netas); x.meses[f.mes] = (x.meses[f.mes] || 0) + e; });
  D.kdp.kenp.forEach(f => { if (!enAnio(f.mes)) return; const x = o(libroDeFila(f)); const e = eurKenp(f); x.kenp += e; x.paginas += n(f.paginas); x.meses[f.mes] = (x.meses[f.mes] || 0) + e; });
  D.ventas.forEach(v => { if (v.estado === 'Cancelado' || (Y && v.fecha && anioDe(v.fecha) !== Y) || (Y && !v.fecha)) return; const l = libroDeTexto(v.libro); if (l) o(l).directa += venta.beneficio(v); });
  D.ingresos.forEach(i => { if (Y && anioDe(i.fecha) !== Y) return; const l = libroDeTexto(i.libro); if (l) o(l).extra += n(i.bruto); });
  D.gastos.forEach(g => { if (Y && anioDe(g.fecha) !== Y) return; const l = libroDeTexto(g.libro); if (l) o(l).gastos += gasto.total(g); });
  out.forEach(x => { x.ingresos = x.kdp + x.kenp + x.directa + x.extra; x.beneficio = x.ingresos - x.gastos; });
  return out;
}
// Tendencia: el último mes con datos de KDP contra el anterior
function ultimoMesKdp() {
  const ms = [...D.kdp.ventas.map(f => f.mes), ...D.kdp.kenp.map(f => f.mes)].filter(Boolean).sort();
  return ms[ms.length - 1] || '';
}
function tendencia(x, mes) {
  if (!mes) return { t: 'sin datos', c: '' };
  const a = x.meses[mes] || 0, b = x.meses[sumarMeses(mes, -1)] || 0;
  if (!a && !b) return { t: 'sin datos', c: '' };
  if (!b) return { t: 'nuevo', c: 'sube' };
  if (a > b * 1.1) return { t: 'subiendo', c: 'sube' };
  if (a < b * .9) return { t: 'bajando', c: 'baja' };
  return { t: 'estable', c: '' };
}

// ---------- tesorería ----------
// KDP paga unos dos meses después del mes de la venta; el resto, cuando lo marques cobrado/pagado
function caja(Y) {
  const lag = Math.round(n(D.ajustes.mesesCobroKdp) || 2);
  const meses = {};
  const m = (k) => meses[k] || (meses[k] = { kdp: 0, extra: 0, directa: 0, pagado: 0 });
  D.kdp.ventas.forEach(f => f.mes && (m(sumarMeses(f.mes, lag)).kdp += eurVenta(f)));
  D.kdp.kenp.forEach(f => f.mes && (m(sumarMeses(f.mes, lag)).kdp += eurKenp(f)));
  D.ingresos.forEach(i => { if (i.fecha && i.estado === 'Cobrado') m(mesDe(i.fecha)).extra += ingreso.neto(i); });
  D.ventas.forEach(v => { if (v.fecha && v.estado !== 'Cancelado') m(mesDe(v.fecha)).directa += venta.cobrado(v) - venta.costes(v); });
  D.gastos.forEach(g => { if (g.fecha && g.pagado) m(mesDe(g.fecha)).pagado += gasto.total(g); });
  const H = mesDe(hoy());
  let acum = n(D.ajustes.saldoInicial);
  // Lo de años anteriores entra como saldo de arranque
  Object.keys(meses).filter(k => anioDe(k) < Y).forEach(k => { const o = meses[k]; acum += o.kdp + o.extra + o.directa - o.pagado; });
  const filas = [];
  for (let i = 1; i <= 12; i++) {
    const k = `${Y}-${pad(i)}`; const o = meses[k] || { kdp: 0, extra: 0, directa: 0, pagado: 0 };
    const neto = o.kdp + o.extra + o.directa - o.pagado; acum += neto;
    filas.push({ mes: k, ...o, cobrado: o.kdp + o.extra + o.directa, neto, acum, futuro: k > H });
  }
  const pendKdp = Object.entries(meses).filter(([k]) => k > H).reduce((a, [, o]) => a + o.kdp, 0);
  const pendExtra = D.ingresos.filter(i => i.estado !== 'Cobrado' && i.estado !== 'Devuelto').reduce((a, i) => a + ingreso.neto(i), 0);
  const pendPago = D.gastos.filter(g => !g.pagado).reduce((a, g) => a + gasto.total(g), 0);
  return { filas, pendKdp, pendExtra, pendPago, cajaHoy: filas.filter(f => !f.futuro).slice(-1)[0]?.acum ?? acum };
}

// ---------- impuestos (estimación) ----------
// Plazos de presentación del 303/130 de cada trimestre
function plazoTrimestre(Y, T) {
  if (T === 4) return { desde: `${Y + 1}-01-01`, hasta: `${Y + 1}-01-30` };
  const mes = T * 3 + 1;
  return { desde: `${Y}-${pad(mes)}-01`, hasta: `${Y}-${pad(mes)}-20` };
}
function rangoTrimestre(Y, T) { const ini = `${Y}-${pad(T * 3 - 2)}`; return [ini, sumarMeses(ini, 1), sumarMeses(ini, 2)]; }
function fiscalTrimestre(Y, T) {
  const meses = rangoTrimestre(Y, T);
  const en = (f) => f && meses.includes(mesDe(f));
  const r = { kdp: 0, kenp: 0, extraBase: 0, ivaRep: 0, retenciones: 0, directaBase: 0, ivaRepVD: 0, gastosBase: 0, ivaSop: 0, gastosNoDed: 0, costesVD: 0, sinMarcar: 0 };
  D.kdp.ventas.forEach(f => { if (meses.includes(f.mes)) r.kdp += eurVenta(f); });
  D.kdp.kenp.forEach(f => { if (meses.includes(f.mes)) r.kenp += eurKenp(f); });
  D.ingresos.forEach(i => { if (!en(i.fecha)) return; r.extraBase += n(i.bruto); r.ivaRep += ingreso.iva(i); r.retenciones += ingreso.irpf(i); });
  D.ventas.forEach(v => { if (!en(v.fecha) || v.estado === 'Cancelado') return; r.directaBase += venta.base(v); r.ivaRepVD += venta.ivaRep(v); r.costesVD += venta.costes(v); });
  D.gastos.forEach(g => { if (!en(g.fecha)) return; if (g.deducible) { r.gastosBase += n(g.base); r.ivaSop += gasto.iva(g); } else if (n(g.base)) { r.gastosNoDed += gasto.total(g); r.sinMarcar++; } });
  r.ingresos = r.kdp + r.kenp + r.extraBase + r.directaBase;
  r.rendimiento = r.ingresos - r.gastosBase - r.costesVD;
  r.iva303 = r.ivaRep + r.ivaRepVD - r.ivaSop;
  return r;
}
// Pago fraccionado acumulado: % del rendimiento del año hasta ese trimestre − retenciones − lo ya pagado
function pagosFraccionados(Y) {
  const pct = n(D.ajustes.pctPagoFraccionado) / 100;
  let rend = 0, ret = 0, pagado = 0; const out = [];
  for (let T = 1; T <= 4; T++) {
    const f = fiscalTrimestre(Y, T); rend += f.rendimiento; ret += f.retenciones;
    const pago = Math.max(0, rend * pct - ret - pagado); pagado += pago;
    out.push({ T, rendAcum: rend, retAcum: ret, pago });
  }
  return out;
}

// ---------- importar el archivo convertido del Excel ----------
function importarDatos(j, modo) {
  const nuevo = j.datos || {};
  if (modo === 'sustituir') {
    const aj = D ? D.ajustes : datosVacios().ajustes;
    D = completar({ ...datosVacios(), ...nuevo, kdp: nuevo.kdp || { ventas: [], kenp: [] }, listas: { ...listasPorDefecto(), ...(nuevo.listas || {}) },
      ajustes: { ...aj, ...(nuevo.ajustes || {}), tema: aj.tema, colores: aj.colores } });
  } else {
    ['libros', 'ingresos', 'ventas', 'gastos', 'impuestos'].forEach(k => { const ids = new Set(D[k].map(o => o.id)); (nuevo[k] || []).forEach(o => { if (!ids.has(o.id)) D[k].push(o); }); });
    ['ventas', 'kenp'].forEach(k => { const ids = new Set(D.kdp[k].map(o => o.id)); ((nuevo.kdp || {})[k] || []).forEach(o => { if (!ids.has(o.id)) D.kdp[k].push(o); }); });
    if (nuevo.listas) Object.entries(nuevo.listas).forEach(([k, v]) => { if (Array.isArray(v)) D.listas[k] = [...new Set([...(D.listas[k] || []), ...v])]; });
    if (nuevo.ajustes) Object.entries(nuevo.ajustes).forEach(([k, v]) => { if (D.ajustes[k] === undefined || D.ajustes[k] === '' ) D.ajustes[k] = v; });
  }
  completar(D); cambio();
}
