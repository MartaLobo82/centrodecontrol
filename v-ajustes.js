'use strict';
// =====================================================================
//  Centro de Control — Ajustes: datos fiscales, objetivo, cómo se
//  calculan las cosas, tipos de cambio, listas, color, Google, copias.
// =====================================================================

const LISTAS_EDITABLES = [
  ['Libros', [['estadoLibro', 'Estados de un libro'], ['genero', 'Géneros'], ['serie', 'Series'], ['estadoComercial', 'Estado comercial']]],
  ['Ingresos y ventas', [['lineaIngreso', 'Líneas de negocio'], ['estadoCobro', 'Estados de cobro'], ['formato', 'Formatos'], ['estadoVenta', 'Estados de un pedido'], ['seguimiento', 'Seguimiento del envío'], ['metodo', 'Métodos de pago']]],
  ['Gastos e impuestos', [['catGasto', 'Categorías de gasto'], ['subcatGasto', 'Subcategorías'], ['conceptoGasto', 'Conceptos habituales'], ['conceptoImpuesto', 'Conceptos de impuestos']]],
];

VISTAS.ajustes = (cont) => {
  const A = D.ajustes;
  const num = (k, t, ayuda = '', paso = 'any') => `<label class="campo medio"><span>${t}</span><input type="number" step="${paso}" data-aj="${k}" value="${esc(A[k] ?? '')}">${ayuda ? `<small>${ayuda}</small>` : ''}</label>`;
  const txt = (k, t) => `<label class="campo"><span>${t}</span><input data-aj="${k}" value="${esc(A[k] ?? '')}"></label>`;
  const ac = coloresDe().acento || COLOR_ACENTO;
  cont.innerHTML = `<div class="pagina ajustes">${cabecera('⚙️ Ajustes', '')}
    <div class="rejilla r2">
      <section class="tarjeta"><h2>Tus datos (para la gestoría)</h2>${txt('nombreFiscal', 'Nombre')}${txt('nif', 'NIF')}${txt('actividad', 'Actividad')}</section>
      <section class="tarjeta"><h2>Objetivo y caja</h2><div class="form">${num('objetivo', 'Objetivo de ingresos al año (€)', '', '100')}${num('saldoInicial', 'Saldo inicial de la cuenta (€)', 'Para que la caja empiece en lo que tenías.')}</div></section>
      <section class="tarjeta"><h2>Cómo se calcula</h2><div class="form">
        ${num('kenpTasa', 'Euros por página KENP', `${fmtN(n(A.kenpTasa) * 1000, 2)} € cada 1.000 páginas. Amazon lo cambia cada mes; ponlo al día de vez en cuando.`, '0.0001')}
        ${num('mesesCobroKdp', 'Meses que tarda Amazon en pagar', '', '1')}
        ${num('irpfIngresos', 'Retención IRPF habitual en tus facturas (%)', '', '1')}
        ${num('ivaGastos', 'IVA habitual de los gastos (%)', '', '1')}
        ${num('ivaVentaDirecta', 'IVA de los libros que vendes tú (%)', 'Si lo cobras (normalmente 4 %), el PVP se entiende con IVA incluido. Si no, déjalo en 0.', '1')}
        ${num('pctPagoFraccionado', 'Pago fraccionado del IRPF (%)', 'Lo habitual en régimen común es 20 %. En Álava confírmalo con tu gestoría.', '1')}</div></section>
      <section class="tarjeta"><h2>Tipos de cambio a euros</h2><p class="suave" style="margin-top:0">Para pasar a euros las regalías en otras monedas. ${A.fechaCambios ? 'Última revisión: ' + esc(A.fechaCambios) + '.' : ''}</p>
        <div class="cambios">${Object.entries(A.cambios).map(([m, v]) => `<label class="cambio-fila"><b>${esc(m)}</b><input type="number" step="0.0001" data-cambio="${esc(m)}" value="${v}"></label>`).join('')}</div>
        <button class="btn peq" id="aj-moneda">+ Moneda</button></section>
      <section class="tarjeta"><h2>Aspecto</h2>
        <label class="campo"><span>Tema</span><select id="aj-tema"><option value="auto">Como el sistema</option><option value="claro"${A.tema === 'claro' ? ' selected' : ''}>Claro</option><option value="noche"${A.tema === 'noche' ? ' selected' : ''}>Oscuro</option></select></label>
        <h4>Color principal</h4><div class="colores-pre">${[['Lavanda', COLOR_ACENTO], ...PALETAS.filter(p => p[1] !== '#7462a3')].map(([nm, c]) => `<button data-pre="${c}" class="${c.toLowerCase() === ac.toLowerCase() ? 'on' : ''}" style="--m:${c}"><i></i>${nm}</button>`).join('')}
          <label class="color-fila" style="border:0;padding:0;gap:6px"><input type="color" id="col-acento" value="${ac}" aria-label="Otro color"><span class="suave">Otro…</span></label></div></section>
      ${typeof tarjetaGoogle === 'function' ? tarjetaGoogle() : ''}
      <section class="tarjeta"><h2>Copias de seguridad</h2>
        <p class="suave" style="margin-top:0">Tus datos viven en este navegador. Guarda una copia de vez en cuando (y conecta Google para tenerlos también en el móvil).</p>
        <div class="fila-btns"><button class="btn prim" id="aj-copia">Descargar copia ahora</button><button class="btn" id="aj-rest">Restaurar una copia…</button></div>
        <label class="campo"><span>Copia automática a Descargas</span><select id="aj-auto">${[[0, 'Nunca'], [1, 'Cada día'], [7, 'Cada semana'], [30, 'Cada mes']].map(([v, t]) => `<option value="${v}"${(A.copiaDias ?? 7) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
        <p class="tenue">${A.ultimaCopia ? 'Última copia: ' + new Date(A.ultimaCopia).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'Aún no has hecho ninguna copia.'}</p></section>
      <section class="tarjeta"><h2>Traer datos del Excel</h2><p class="suave" style="margin-top:0">Carga <b>centro-importar.json</b>, el archivo que te preparó Claude con tu Centro de Control de Excel.</p><button class="btn" id="aj-imp">Importar archivo…</button></section>
    </div>
    <section class="tarjeta" style="margin-top:18px"><h2>Listas de los desplegables</h2><p class="suave" style="margin-top:0">Lo que era la pestaña Config. Una opción por línea.</p>
      ${LISTAS_EDITABLES.map(([g, ls]) => `<h4 class="sep-form">${g}</h4><div class="listas">${ls.map(([k, t]) => `<label class="campo"><span>${t}</span><textarea data-lista="${k}" rows="${Math.min(9, Math.max(3, (D.listas[k] || []).length + 1))}">${esc((D.listas[k] || []).join('\n'))}</textarea></label>`).join('')}</div>`).join('')}</section>
    <section class="tarjeta peligro-zona"><h2>Empezar de cero</h2><p class="suave" style="margin-top:0">Borra todos los datos de este aparato (antes te descargo una copia).</p><button class="btn peligro" id="aj-borrar">Borrar todo</button></section>
    <p class="tenue pie-app">Centro de Control · versión ${VERSION_APP}</p></div>`;

  $$('[data-aj]', cont).forEach(i => i.onchange = () => { A[i.dataset.aj] = i.type === 'number' ? n(i.value) : i.value.trim(); cambio(false); });
  $$('[data-cambio]', cont).forEach(i => i.onchange = () => { A.cambios[i.dataset.cambio] = n(i.value); A.fechaCambios = fechaCorta(hoy()) + ' ' + anioDe(hoy()); cambio(false); });
  $('#aj-moneda', cont).onclick = async () => { const m = await pedirTexto('Nueva moneda', '', 'Código de 3 letras (p. ej. CHF)'); if (m) { A.cambios[m.toUpperCase().slice(0, 3)] = 1; cambio(); } };
  $('#aj-tema', cont).onchange = (e) => { A.tema = e.target.value; aplicarTema(); cambio(false); };
  const ponerAcento = (v) => { A.colores = { ...(A.colores || {}), acento: v }; aplicarTema(); $$('[data-pre]', cont).forEach(b => b.classList.toggle('on', b.dataset.pre.toLowerCase() === v.toLowerCase())); guardarPronto(); };
  $$('[data-pre]', cont).forEach(b => b.onclick = () => { $('#col-acento', cont).value = b.dataset.pre; ponerAcento(b.dataset.pre); });
  $('#col-acento', cont).oninput = (e) => ponerAcento(e.target.value);
  $('#aj-auto', cont).onchange = (e) => { A.copiaDias = +e.target.value; cambio(false); };
  $('#aj-copia', cont).onclick = () => hacerCopia();
  $('#aj-rest', cont).onclick = () => elegirArchivo(async (j) => {
    if (!j || j.app !== 'centro' || !j.datos) return aviso('Ese archivo no es del Centro de Control');
    if (j.tipo === 'importar-excel') return importarConPregunta(j);
    if (!(await preguntar('¿Restaurar esta copia?', `Es del ${new Date(j.fecha).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}. Sustituye todo lo que hay ahora (antes te descargo una copia).`, 'Restaurar'))) return;
    await hacerCopia('antes de restaurar'); D = completar(j.datos); aplicarTema(); cambio(); aviso('Copia restaurada');
  });
  $('#aj-imp', cont).onclick = () => elegirArchivo((j) => { if (!j || j.app !== 'centro' || !j.datos) return aviso('Ese archivo no es del Centro de Control'); importarConPregunta(j); });
  $$('[data-lista]', cont).forEach(t => t.onchange = () => { const v = t.value.split('\n').map(s => s.trim()).filter(Boolean); D.listas[t.dataset.lista] = v; cambio(false); });
  $('#aj-borrar', cont).onclick = async () => {
    if (!(await preguntar('¿Borrar todo?', 'Se borran todos tus libros, ventas, gastos… de este aparato. Antes te descargo una copia.', 'Borrar todo', true))) return;
    await hacerCopia('antes de borrar'); const aj = D.ajustes; D = datosVacios(); D.ajustes = aj; cambio(); aviso('Todo borrado. Tienes la copia en Descargas.');
  };
  if (typeof enlazarGoogle === 'function') enlazarGoogle(cont);
};

function importarConPregunta(j) {
  const d = j.datos || {}; const k = d.kdp || {};
  const c = (x) => (x || []).length;
  modal(`<h3>Importar del Excel</h3>
    <p class="suave">El archivo trae ${plural(c(d.libros), 'libro', 'libros')}, ${plural(c(k.ventas), 'fila', 'filas')} de ventas de KDP, ${plural(c(k.kenp), 'fila', 'filas')} de KENP, ${plural(c(d.ingresos), 'ingreso', 'ingresos')}, ${plural(c(d.ventas), 'pedido', 'pedidos')} de venta directa y ${plural(c(d.gastos), 'gasto', 'gastos')}.</p>
    <div class="opciones-imp">
      <label><input type="radio" name="imp" value="juntar"${D.libros.length ? ' checked' : ''}> <b>Juntar</b> con lo que ya tengo <small>Añade lo que falte; lo que ya tienes no se toca. Importar dos veces no duplica.</small></label>
      <label><input type="radio" name="imp" value="sustituir"${D.libros.length ? '' : ' checked'}> <b>Sustituir</b> todo <small>Te descargo antes una copia de lo actual.</small></label></div>
    <div class="pie"><button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="im-ok">Importar</button></div>`, {
    alAbrir: (m, cerrar) => {
      $('#im-ok', m).onclick = async () => {
        const modo = $('input[name=imp]:checked', m).value; cerrar();
        if (modo === 'sustituir' && (D.libros.length || D.gastos.length)) await hacerCopia('antes de importar');
        importarDatos(j, modo); aplicarTema(); aviso('Datos del Excel importados'); irA('inicio');
      };
    }
  });
}
async function hacerCopia(motivo) {
  const d = new Date();
  const nombre = `Centro de Control · Copia ${aStr(d)} ${pad(d.getHours())}h${pad(d.getMinutes())}${motivo ? ' (' + motivo + ')' : ''}.json`;
  await guardarYa();
  descargar(new Blob([JSON.stringify({ app: 'centro', tipo: 'copia', version: 1, fecha: d.toISOString(), datos: D })], { type: 'application/json' }), nombre);
  D.ajustes.ultimaCopia = Date.now(); guardarPronto();
  if (!motivo) aviso('Copia guardada en Descargas');
}
