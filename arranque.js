'use strict';
// =====================================================================
//  Centro de Control — arranque: carga tus datos, menú (también el de
//  abajo en el móvil), atajos, copia automática y modo sin conexión.
// =====================================================================

const VERSION_APP = '1.1';

(async function arrancar() {
  try { D = await Store.get('datos'); } catch (e) { console.error(e); }
  const primeraVez = !D;
  D = completar(D || datosVacios());
  aplicarTema();

  // Menú lateral (y de abajo en el móvil)
  const rail = $('#rail');
  $$('#rail button[data-vista]').forEach(b => b.onclick = () => { cerrarMas(); if (b.dataset.vista === 'libros') UI.libro = ''; irA(b.dataset.vista); });
  const PRINCIPALES = ['inicio', 'libros', 'kdp', 'gastos'];
  $$('#rail button[data-vista]').forEach(b => { if (!PRINCIPALES.includes(b.dataset.vista)) b.classList.add('secundario'); });
  const mas = el('div', { class: 'btn-mas', role: 'button', tabindex: '0', html: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>Más' });
  rail.append(mas);
  const hoja = el('div', { class: 'hoja-mas' });
  $$('#rail button.secundario').forEach(b => { const c = b.cloneNode(true); c.classList.remove('secundario', 'abajo'); c.onclick = () => { cerrarMas(); irA(c.dataset.vista); }; hoja.append(c); });
  const fondo = el('div', { class: 'velo-movil' }); document.body.append(fondo, hoja);
  const cerrarMas = () => { hoja.classList.remove('on'); fondo.classList.remove('on'); };
  mas.onclick = (e) => { e.stopPropagation(); const on = !hoja.classList.contains('on'); hoja.classList.toggle('on', on); fondo.classList.toggle('on', on); };
  fondo.onclick = cerrarMas;
  new MutationObserver(() => {
    const v = (rail.querySelector('button.secundario.on') || {}).dataset;
    mas.classList.toggle('on', !!v);
    $$('button', hoja).forEach(b => b.classList.toggle('on', !!v && b.dataset.vista === v.vista));
  }).observe(rail, { subtree: true, attributes: true, attributeFilter: ['class'] });

  // Botón flotante: lo que se añade en cada sección
  $('#fab').onclick = () => {
    if (vistaActual === 'libros') return editarLibro({ estado: 'Próximo', idioma: 'es' }, { nueva: true });
    if (vistaActual === 'kdp') return $('#kd-subir') && $('#kd-subir').click();
    if (vistaActual === 'ingresos' && UI.iPest === 'directa') return editarVenta({ fecha: hoy(), uds: 1, estado: 'Pendiente', formato: 'Papel' }, { nueva: true });
    if (vistaActual === 'ingresos') return editarIngreso({ fecha: hoy(), estado: 'Pendiente', irpfPct: D.ajustes.irpfIngresos, ivaPct: 0 }, { nueva: true });
    if (vistaActual === 'impuestos') return editarPago({ fecha: hoy() }, { nueva: true });
    editarGasto({ fecha: hoy(), ivaPct: D.ajustes.ivaGastos, deducible: true, pagado: true }, { nueva: true });
  };
  const fabTitulo = () => { const t = { libros: 'Nuevo libro', kdp: 'Subir informe de KDP', ingresos: UI.iPest === 'directa' ? 'Nuevo pedido' : 'Nuevo ingreso', impuestos: 'Apuntar pago' }[vistaActual] || 'Nuevo gasto'; $('#fab').title = t; $('#fab').setAttribute('aria-label', t); };
  new MutationObserver(fabTitulo).observe(rail, { subtree: true, attributes: true, attributeFilter: ['class'] });

  // Enlaces internos (#gastos, #libros…)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a && VISTAS[a.getAttribute('href').slice(1)]) { e.preventDefault(); irA(a.getAttribute('href').slice(1)); }
  });
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VISTAS[v] && v !== vistaActual) irA(v); });

  // Atajos de teclado (no mientras escribes)
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || $('.velo')) return;
    if (e.key === 'n') { e.preventDefault(); $('#fab').click(); }
    else if (e.key === 'h') irA('inicio');
    else if (e.key === 'g') irA('gastos');
    else if (e.key === 'l') { UI.libro = ''; irA('libros'); }
  });

  // Al volver a la app otro día, se repinta para que «hoy» sea hoy
  let diaPintado = hoy();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && hoy() !== diaPintado) { diaPintado = hoy(); pintar(); } });

  const inicial = location.hash.slice(1);
  irA(VISTAS[inicial] ? inicial : (UI.vista || 'inicio'));
  if (primeraVez) { await guardarYa(); bienvenida(); }

  // Copia automática
  const dias = D.ajustes.copiaDias ?? 7;
  if (!primeraVez && dias > 0 && (D.libros.length || D.gastos.length) && Date.now() - (D.ajustes.ultimaCopia || 0) > dias * 86400000) {
    setTimeout(() => { hacerCopia('automática'); aviso('He guardado tu copia de seguridad en Descargas'); }, 5000);
  }

  if (typeof arrancarGoogle === 'function') arrancarGoogle();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

function bienvenida() {
  modal(`<div class="bienvenida"><div class="logo-grande">C</div><h3>Tu Centro de Control, ahora como app</h3>
    <p class="suave">Libros, ventas de Amazon (subiendo el informe tal cual), ingresos, venta directa, gastos, impuestos y el informe del año. Funciona sin conexión y se instala en el móvil.</p>
    <p class="suave">Si tienes un archivo <b>centro-importar.json</b> con tus datos de Excel, cárgalo; si no, empieza en blanco: crea tus libros y sube tu primer informe de KDP.</p></div>
    <div class="pie" style="flex-wrap:wrap"><button class="btn" data-cerrar>Empezar en blanco</button><button class="btn prim" id="bv-imp">Cargar mis datos del Excel</button></div>`, {
    alAbrir: (m, cerrar) => {
      $('#bv-imp', m).onclick = () => { cerrar(); elegirArchivo((j) => { if (!j || j.app !== 'centro' || !j.datos) return aviso('Ese archivo no es del Centro de Control'); importarDatos(j, 'sustituir'); aplicarTema(); aviso('¡Listo! Ya tienes aquí tus datos del Excel'); irA('inicio'); }); };
    }
  });
}
