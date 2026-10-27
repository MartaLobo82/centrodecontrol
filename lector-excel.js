'use strict';
// =====================================================================
//  Centro de Control — lee archivos Excel (.xlsx) y CSV en el propio
//  navegador, sin librerías: descomprime el .xlsx (es un .zip) y lee
//  sus hojas. Devuelve [{ nombre, filas: [[celda, …], …] }].
// =====================================================================

async function leerArchivoTabla(archivo) {
  const nombre = archivo.name || '';
  if (/\.(csv|tsv|txt)$/i.test(nombre)) return [{ nombre: nombre.replace(/\.[^.]+$/, ''), filas: leerCSV(await archivo.text()) }];
  const buf = new Uint8Array(await archivo.arrayBuffer());
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('No es un archivo Excel (.xlsx). Si es .xls antiguo, ábrelo y guárdalo como .xlsx.');
  return leerXlsx(buf);
}

// ---------- CSV ----------
function leerCSV(txt) {
  txt = txt.replace(/^\uFEFF/, '');
  const prim = txt.split(/\r?\n/)[0] || '';
  const sep = (prim.match(/\t/g) || []).length > (prim.match(/;/g) || []).length ? '\t' : (prim.match(/;/g) || []).length > (prim.match(/,/g) || []).length ? ';' : ',';
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) { if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') comillas = false; else campo += c; continue; }
    if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.map(f => f.map(v => { const t = v.trim(); return /^-?\d+([.,]\d+)?$/.test(t) && !/^0\d/.test(t) ? Number(t.replace(',', '.')) : t; }));
}

// ---------- ZIP ----------
async function inflar(datos) {
  const ds = new DecompressionStream('deflate-raw');
  const s = new Blob([datos]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function archivosZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('El archivo .xlsx está dañado');
  const total = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const dec = new TextDecoder();
  const out = {};
  for (let k = 0; k < total; k++) {
    const metodo = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true);
    const ln = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nombre = dec.decode(buf.subarray(p + 46, p + 46 + ln));
    p += 46 + ln + lx + lc;
    const lnl = dv.getUint16(local + 26, true), lxl = dv.getUint16(local + 28, true);
    const ini = local + 30 + lnl + lxl;
    out[nombre] = { metodo, datos: buf.subarray(ini, ini + comp) };
  }
  return {
    nombres: Object.keys(out),
    async texto(n) { const f = out[n]; if (!f) return null; const b = f.metodo === 8 ? await inflar(f.datos) : f.datos; return dec.decode(b); },
  };
}

// ---------- XLSX ----------
async function leerXlsx(buf) {
  const z = await archivosZip(buf);
  const xml = (t) => new DOMParser().parseFromString(t, 'application/xml');
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const por = (doc, tag) => [...doc.getElementsByTagNameNS(ns, tag)];
  // Textos compartidos
  const ss = [];
  const tss = await z.texto('xl/sharedStrings.xml');
  if (tss) por(xml(tss), 'si').forEach(si => ss.push(por(si, 't').map(t => t.textContent).join('')));
  // Formatos de fecha
  const fechas = new Set();
  const tst = await z.texto('xl/styles.xml');
  if (tst) {
    const st = xml(tst);
    const propios = {};
    por(st, 'numFmt').forEach(f => { propios[f.getAttribute('numFmtId')] = f.getAttribute('formatCode'); });
    const xfs = por(st, 'cellXfs')[0];
    if (xfs) por(xfs, 'xf').forEach((xf, i) => {
      const id = +xf.getAttribute('numFmtId');
      const cod = propios[id] || '';
      if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /(^|[^"\\])[dmy]{1,4}/i.test(cod.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, ''))) fechas.add(i);
    });
  }
  // Hojas y su orden
  const wb = xml(await z.texto('xl/workbook.xml'));
  const rels = xml(await z.texto('xl/_rels/workbook.xml.rels'));
  const destino = {};
  [...rels.getElementsByTagName('Relationship')].forEach(r => { destino[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const hojas = [];
  for (const h of por(wb, 'sheet')) {
    const rid = h.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || h.getAttribute('r:id');
    let ruta = destino[rid] || ''; ruta = ruta.startsWith('/') ? ruta.slice(1) : 'xl/' + ruta.replace(/^\.\//, '');
    const t = await z.texto(ruta); if (!t) continue;
    const doc = xml(t);
    const filas = [];
    por(doc, 'row').forEach(row => {
      const ri = +row.getAttribute('r') - 1;
      const fila = filas[ri] = [];
      por(row, 'c').forEach(c => {
        const ref = c.getAttribute('r') || '';
        const col = ref.replace(/\d+/g, '').split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        const tipo = c.getAttribute('t'), s = +c.getAttribute('s');
        const v = (por(c, 'v')[0] || {}).textContent;
        let val = '';
        if (tipo === 's') val = ss[+v] ?? '';
        else if (tipo === 'inlineStr') val = por(c, 't').map(x => x.textContent).join('');
        else if (tipo === 'str' || tipo === 'e') val = v ?? '';
        else if (tipo === 'b') val = v === '1';
        else if (v !== undefined && v !== null && v !== '') {
          val = Number(v);
          if (fechas.has(s) && val > 20000 && val < 80000) { const d = new Date(Math.round((val - 25569) * 86400000)); val = d.toISOString().slice(0, 10); }
        }
        fila[col] = val;
      });
    });
    hojas.push({ nombre: h.getAttribute('name'), filas: [...filas].map(f => f ? [...f].map(x => x ?? '') : []) });
  }
  return hojas;
}
