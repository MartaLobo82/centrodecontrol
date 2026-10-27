'use strict';
// =====================================================================
//  Centro de Control — Libros: Biblioteca, Ficha de novela y Royalties
//  por libro, juntos. La ficha muestra datos, enlaces y cuánto vende.
// =====================================================================

VISTAS.libros = (cont) => {
  if (UI.libro && libroPorId(UI.libro)) return fichaLibro(cont, libroPorId(UI.libro));
  UI.libro = '';
  const est = UI.bEstado || 'todos', idi = UI.bIdioma || 'todos', q = quitarTildes(UI.bBuscar || ''), orden = UI.bOrden || 'fecha';
  const Y = anioUI();
  const datos = porLibro(Y), total = porLibro(0);
  let lista = D.libros.filter(l => (est === 'todos' || (l.estado || '') === est) && (idi === 'todos' || (l.idioma || 'es') === idi)
    && (!q || quitarTildes([l.titulo, l.subtitulo, l.serie, ...(l.tropos || [])].join(' ')).includes(q)));
  const ing = (l) => (datos.get(l.id) || {}).ingresos || 0;
  lista.sort(orden === 'ventas' ? (a, b) => ing(b) - ing(a) : orden === 'titulo' ? (a, b) => a.titulo.localeCompare(b.titulo) : (a, b) => (b.fechaPub || '').localeCompare(a.fechaPub || ''));
  const estados = [...new Set(D.libros.map(l => l.estado).filter(Boolean))];

  cont.innerHTML = `<div class="pagina ancha libros">
    ${cabecera('📚 Libros', `${plural(D.libros.length, 'libro', 'libros')} · ${plural(D.libros.filter(l => l.estado === 'Activo').length, 'activo', 'activos')}. Toca uno para ver su ficha y lo que vende.`, `${selectorAnio()}<button class="btn prim" id="li-nuevo">+ Libro</button>`)}
    <div class="barra-filtros">
      <div class="segmentado">${[['todos', 'Todos'], ...estados.map(e => [e, e])].map(([k, t]) => `<button data-est="${esc(k)}" class="${k === est ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>
      <div class="segmentado">${[['todos', 'ES + EN'], ['es', 'Español'], ['en', 'Inglés']].map(([k, t]) => `<button data-idi="${k}" class="${k === idi ? 'on' : ''}">${t}</button>`).join('')}</div>
      <select id="li-orden" aria-label="Ordenar"><option value="fecha">Más recientes</option><option value="ventas"${orden === 'ventas' ? ' selected' : ''}>Más ingresos en ${Y}</option><option value="titulo"${orden === 'titulo' ? ' selected' : ''}>Por título</option></select>
      <input type="search" id="li-buscar" placeholder="Buscar título, serie, tropo…" value="${esc(UI.bBuscar || '')}">
    </div>
    <div class="estanteria">${lista.map(l => {
      const x = datos.get(l.id), tot = total.get(l.id);
      return `<button class="libro-card ${l.estado === 'Descatalogado' ? 'apagado' : ''}" data-libro="${l.id}">
        <div class="portada">${l.portada ? `<img src="${l.portada}" alt="Portada de ${esc(l.titulo)}" loading="lazy">` : `<span>${esc(l.titulo)}</span>`}${l.idioma === 'en' ? '<i class="idioma">EN</i>' : ''}</div>
        <b>${esc(l.titulo)}</b><small>${esc(l.serie || l.genero || '')}${l.fechaPub ? ` · ${anioDe(l.fechaPub)}` : ''}</small>
        <span class="lc-cifras">${x && x.ingresos ? `<strong>${fmtE0(x.ingresos)}</strong> en ${Y}` : `<span class="tenue">sin ventas en ${Y}</span>`}${tot && tot.ingresos && (!x || tot.ingresos !== x.ingresos) ? ` · ${fmtE0(tot.ingresos)} en total` : ''}</span>
        <span class="pill ${l.estado === 'Activo' ? '' : 'gris'}">${esc(l.estado || 'Sin estado')}</span></button>`;
    }).join('') || '<p class="vacio">Ningún libro con estos filtros</p>'}</div></div>`;

  enlazarAnio(cont);
  $$('[data-libro]', cont).forEach(b => b.onclick = () => { UI.libro = b.dataset.libro; guardarUI(); pintar(); $('#main .vista.on').scrollTop = 0; });
  $$('[data-est]', cont).forEach(b => b.onclick = () => { UI.bEstado = b.dataset.est; guardarUI(); pintar(); });
  $$('[data-idi]', cont).forEach(b => b.onclick = () => { UI.bIdioma = b.dataset.idi; guardarUI(); pintar(); });
  $('#li-orden', cont).onchange = (e) => { UI.bOrden = e.target.value; guardarUI(); pintar(); };
  const bq = $('#li-buscar', cont);
  bq.oninput = debounce(() => { UI.bBuscar = bq.value; guardarUI(); pintar(); const n2 = $('#li-buscar'); n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); }, 250);
  $('#li-nuevo', cont).onclick = () => editarLibro({ estado: 'Próximo', idioma: 'es' }, { nueva: true });
};

// ---------- ficha de un libro ----------
function fichaLibro(cont, l) {
  const Y = anioUI();
  const x = porLibro(Y).get(l.id) || { kdp: 0, kenp: 0, paginas: 0, uds: 0, directa: 0, extra: 0, gastos: 0, ingresos: 0, beneficio: 0, meses: {} };
  const tot = porLibro(0).get(l.id) || x;
  const ult = ultimoMesKdp(); const tr = tendencia(tot, ult);
  // Por mes (año elegido): regalías y KENP
  const meses = Array.from({ length: 12 }, (_, i) => `${Y}-${pad(i + 1)}`);
  const pm = {}; meses.forEach(m => pm[m] = { kdp: 0, kenp: 0, uds: 0, paginas: 0 });
  D.kdp.ventas.forEach(f => { if (pm[f.mes] && libroDeFila(f) === l) { pm[f.mes].kdp += eurVenta(f); pm[f.mes].uds += n(f.netas); } });
  D.kdp.kenp.forEach(f => { if (pm[f.mes] && libroDeFila(f) === l) { pm[f.mes].kenp += eurKenp(f); pm[f.mes].paginas += n(f.paginas); } });
  // Por tienda y formato
  const porTienda = {};
  D.kdp.ventas.forEach(f => { if (anioDe(f.mes) === Y && libroDeFila(f) === l) { const k = `${f.tienda || '?'} · ${/blanda|paperback|papel/i.test(f.transaccion || '') ? 'Papel' : /dura|hardcover/i.test(f.transaccion || '') ? 'Tapa dura' : 'eBook'}`; porTienda[k] = (porTienda[k] || 0) + eurVenta(f); } });
  const enlace = (u, t) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>` : '';
  const gastosL = D.gastos.filter(g => libroDeTexto(g.libro) === l);

  cont.innerHTML = `<div class="pagina ancha ficha-libro">
    <button class="btn peq volver" id="fl-volver">‹ Libros</button>
    <div class="fl-cab">
      <div class="fl-portada">${l.portada ? `<img src="${l.portada}" alt="Portada">` : `<span>${esc(l.titulo)}</span>`}<button class="btn peq" id="fl-portada">${l.portada ? 'Cambiar portada' : 'Añadir portada'}</button></div>
      <div class="fl-info">
        <div class="pills">${l.estado ? `<span class="pill">${esc(l.estado)}</span>` : ''}${l.idioma === 'en' ? '<span class="pill gris">Inglés</span>' : ''}${l.select ? `<span class="pill gris">KDP Select${l.renovSelect ? ' · renueva ' + fechaCorta(l.renovSelect) : ''}</span>` : ''}${l.estadoComercial ? `<span class="pill gris">${esc(l.estadoComercial)}</span>` : ''}</div>
        <h1>${esc(l.titulo)}</h1>${l.subtitulo ? `<p class="sub">${esc(l.subtitulo)}</p>` : ''}
        <p class="meta">${[l.serie, l.genero, l.fechaPub ? 'Publicado el ' + fechaCorta(l.fechaPub) + ' ' + anioDe(l.fechaPub) : '', l.reedicion && l.fechaReed ? 'reeditado ' + fechaCorta(l.fechaReed) + ' ' + anioDe(l.fechaReed) : ''].filter(Boolean).map(esc).join(' · ')}</p>
        ${(l.tropos || []).length ? `<div class="chips">${l.tropos.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
        ${l.frase ? `<blockquote>${esc(l.frase)}</blockquote>` : ''}
        <div class="acciones-pag"><button class="btn prim" id="fl-editar">Editar ficha</button>${enlace(l.afiliado, '🛒 Amazon')}${enlace(l.extracto, '📖 Extracto')}${enlace(l.opinion, '⭐ Dejar opinión')}</div>
      </div>
    </div>
    <div class="nav-cal" style="margin-top:18px">${selectorAnio().replace('<div class="nav-cal">', '').replace(/<\/div>$/, '')}<span class="tenue">· en total: ${fmtE0(tot.ingresos)}${tr.t !== 'sin datos' ? ` · último mes <span class="tend ${tr.c}">${tr.t}</span>` : ''}</span></div>
    <div class="cifras-grandes">
      ${cifra('Regalías KDP', fmtE(x.kdp), `${fmtN(x.uds)} unidades`)}
      ${cifra('KENP', fmtE(x.kenp), `${fmtN(x.paginas)} páginas`)}
      ${cifra('Venta directa', fmtE(x.directa), 'beneficio')}
      ${cifra('Gastos del libro', fmtE(x.gastos))}
      ${cifra('Beneficio', fmtE(x.beneficio), x.gastos ? `ROI ${fmtP(x.beneficio / x.gastos)}` : '', x.beneficio < 0 ? 'neg' : '')}
    </div>
    <div class="rejilla r2" style="margin-top:16px">
      <section class="tarjeta"><h2>Amazon por mes · ${Y}</h2>
        ${grafBarras(meses, SERIES_ING.slice(0, 2), (m, k) => pm[m][k], { alto: 180 })}
        <details class="ver-tabla"><summary>Ver en tabla</summary>${tabla([{ t: 'Mes', v: f => may(MESES[+f.m.slice(5) - 1]) }, { t: 'Uds', cl: 'num', v: f => fmtN(f.o.uds), pie: fmtN(x.uds) }, { t: 'Regalías', cl: 'num', v: f => fmtE(f.o.kdp), pie: fmtE(x.kdp) }, { t: 'Páginas', cl: 'num', v: f => fmtN(f.o.paginas), pie: fmtN(x.paginas) }, { t: 'KENP €', cl: 'num', v: f => fmtE(f.o.kenp), pie: fmtE(x.kenp) }], meses.map(m => ({ m, o: pm[m] })), { pie: true })}</details></section>
      <section class="tarjeta"><h2>Dónde se vende · ${Y}</h2>${Object.keys(porTienda).length ? grafHoriz(Object.entries(porTienda).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ t, v }))) : '<p class="vacio">Sin ventas de KDP este año</p>'}
        ${gastosL.length ? `<h2 style="margin-top:16px">Gastos del libro</h2>${tabla([{ t: 'Fecha', v: g => g.fecha ? fechaCorta(g.fecha) + ' ' + anioDe(g.fecha) : '' }, { t: 'Concepto', v: g => esc(g.concepto) }, { t: 'Total', cl: 'num', v: g => fmtE(gasto.total(g)) }], gastosL)}` : ''}</section>
    </div>
    <div class="rejilla r2" style="margin-top:16px">
      <section class="tarjeta"><h2>Sinopsis</h2><div class="texto-largo">${esc(l.sinopsis || 'Sin sinopsis').replace(/\n/g, '<br>')}</div></section>
      <section class="tarjeta"><h2>Amazon</h2>
        <dl class="datos">${[['ASIN', l.asin], ['ISBN Amazon', l.isbnAmazon], ['ISBN propio', l.isbnPropio], ['Depósito legal', l.deposito], ['Otros códigos', (l.codigos || []).join(', ')]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${(l.categorias || []).length ? `<h4>Categorías</h4><ul class="lista-simple">${l.categorias.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${(l.keywords || []).length ? `<h4>Palabras clave (${l.keywords.length})</h4><div class="chips">${l.keywords.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>${l.notasKw ? `<p class="tenue">${esc(l.notasKw)}</p>` : ''}` : ''}
        <h4>Enlaces</h4><div class="enlaces">${[['🎬 Booktrailer', l.booktrailer], ['🎧 Spotify', l.spotify], ['📌 Pinterest', l.pinterest], ['🗺️ Mapa', l.maps]].filter(([, u]) => u).map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`).join('') || '<span class="tenue">Ninguno</span>'}</div>
      </section>
    </div></div>`;

  enlazarAnio(cont); enlazarGraficos(cont);
  $('#fl-volver', cont).onclick = () => { UI.libro = ''; guardarUI(); pintar(); };
  $('#fl-editar', cont).onclick = () => editarLibro(l);
  $('#fl-portada', cont).onclick = () => elegirPortada(l);
}

function elegirPortada(l) {
  const i = el('input', { type: 'file', accept: 'image/*' });
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    try {
      const img = await createImageBitmap(f);
      const esc_ = Math.min(1, 540 / img.height, 360 / img.width);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * esc_); c.height = Math.round(img.height * esc_);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      l.portada = c.toDataURL('image/jpeg', .82); cambio(); aviso('Portada guardada');
    } catch (e) { aviso('No he podido leer esa imagen'); }
  };
  i.click();
}

function editarLibro(l, { nueva = false } = {}) {
  const L = D.listas;
  const obj = { ...l, tropos: (l.tropos || []).join('\n'), categorias: (l.categorias || []).join('\n'), keywords: (l.keywords || []).join('\n'), codigos: (l.codigos || []).join(', ') };
  const campos = [
    { k: 'titulo', t: 'Título', tipo: 'texto' },
    { k: 'subtitulo', t: 'Subtítulo', tipo: 'texto' },
    { k: 'estado', t: 'Estado', tipo: 'select', op: L.estadoLibro, ancho: 'tercio' },
    { k: 'idioma', t: 'Idioma', tipo: 'select', op: ['es', 'en'], vacio: false, ancho: 'tercio' },
    { k: 'estadoComercial', t: 'Estado comercial', tipo: 'select', op: L.estadoComercial, ancho: 'tercio' },
    { k: 'serie', t: 'Serie', tipo: 'lista', op: L.serie, ancho: 'medio' },
    { k: 'genero', t: 'Género', tipo: 'lista', op: L.genero, ancho: 'medio' },
    { k: 'fechaPub', t: 'Fecha de publicación', tipo: 'fecha', ancho: 'tercio' },
    { k: 'reedicion', t: 'Es reedición', tipo: 'check', ancho: 'tercio' },
    { k: 'fechaReed', t: 'Fecha reedición', tipo: 'fecha', ancho: 'tercio' },
    { k: 'frase', t: 'Frase', tipo: 'texto' },
    { k: 'sinopsis', t: 'Sinopsis', tipo: 'area', filas: 6 },
    { k: 'tropos', t: 'Tropos (uno por línea)', tipo: 'area', filas: 3 },
    { tipo: 'sep', t: 'Amazon' },
    { k: 'asin', t: 'ASIN', tipo: 'texto', ancho: 'tercio' },
    { k: 'isbnAmazon', t: 'ISBN Amazon', tipo: 'texto', ancho: 'tercio' },
    { k: 'isbnPropio', t: 'ISBN propio', tipo: 'texto', ancho: 'tercio' },
    { k: 'codigos', t: 'Otros códigos de KDP (separados por comas)', tipo: 'texto', ayuda: 'Para ediciones antiguas o en papel que salen en los informes con otro ASIN o ISBN.' },
    { k: 'deposito', t: 'Depósito legal', tipo: 'texto', ancho: 'medio' },
    { k: 'select', t: 'En KDP Select', tipo: 'check', ancho: 'tercio' },
    { k: 'renovSelect', t: 'Próxima renovación Select', tipo: 'fecha', ancho: 'medio' },
    { k: 'categorias', t: 'Categorías (una por línea)', tipo: 'area', filas: 3 },
    { k: 'keywords', t: 'Palabras clave (una por línea, máx. 7)', tipo: 'area', filas: 4 },
    { tipo: 'sep', t: 'Enlaces' },
    { k: 'afiliado', t: 'Enlace afiliado', tipo: 'texto', ancho: 'medio' },
    { k: 'extracto', t: 'Extracto gratuito', tipo: 'texto', ancho: 'medio' },
    { k: 'opinion', t: 'Dejar opinión', tipo: 'texto', ancho: 'medio' },
    { k: 'booktrailer', t: 'Booktrailer', tipo: 'texto', ancho: 'medio' },
    { k: 'spotify', t: 'Spotify', tipo: 'texto', ancho: 'medio' },
    { k: 'pinterest', t: 'Pinterest', tipo: 'texto', ancho: 'medio' },
    { k: 'maps', t: 'Mapa', tipo: 'texto' },
  ];
  const aLista = (s, sep = /\n/) => String(s || '').split(sep).map(x => x.trim()).filter(Boolean);
  ficha({
    titulo: nueva ? 'Nuevo libro' : 'Editar ficha', obj, campos, clase: 'ancha',
    onGuardar: (r) => {
      if (!r.titulo) { aviso('Escribe el título'); return false; }
      const fin = { ...l, ...r, id: l.id || uid(), tropos: aLista(r.tropos), categorias: aLista(r.categorias), keywords: aLista(r.keywords), codigos: aLista(r.codigos, /[,;\s]+/) };
      campos.forEach(c => { if (c.k && !(c.k in r) && !['tropos', 'categorias', 'keywords', 'codigos'].includes(c.k)) delete fin[c.k]; });
      if (fin.keywords.length > 7) aviso('Ojo: Amazon solo admite 7 palabras clave');
      if (nueva) D.libros.push(fin); else D.libros[D.libros.findIndex(x => x.id === l.id)] = fin;
      if (fin.serie && !D.listas.serie.includes(fin.serie)) D.listas.serie.push(fin.serie);
      cambio(); if (nueva) { UI.libro = fin.id; guardarUI(); }
    },
    onBorrar: nueva ? null : async () => {
      if (!(await preguntar(`¿Borrar «${l.titulo}»?`, 'Sus ventas de KDP se quedan, pero sin libro asignado.', 'Borrar', true))) return false;
      D.libros = D.libros.filter(x => x.id !== l.id); UI.libro = ''; guardarUI(); cambio(); return true;
    },
  });
}
