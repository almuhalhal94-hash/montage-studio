// Narrated with `motion voice` (Spanish: ef_dora, em_alex, em_santa). The English version is what-is-access.scene.js.
// ¿Qué es Microsoft Access? Qué es y qué trae: tablas, relaciones, consultas, formularios,
// informes, macros/VBA y datos externos, con una base pequeña de clientes y pedidos (México, pesos).
const els = [];
const T = {};
const pitch = 44;

// A datasheet drawn as boxes: header row `${p}-h${c}`, cells `${p}-${r}-${c}`.
function table(p, x0, y0, cols, rows) {
  T[p] = { nr: rows.length, nc: cols.length };
  let x = x0;
  cols.forEach(([name, w], c) => {
    const cx = x + w / 2;
    els.push({ id: `${p}-h${c}`, type: 'box', x: cx, y: y0, w: w - 4, h: 40, label: name, size: 18, radius: 4, tone: 'muted' });
    rows.forEach((row, r) => els.push({ id: `${p}-${r}-${c}`, type: 'box', x: cx, y: y0 + (r + 1) * pitch, w: w - 4, h: 40, label: String(row[c]), size: 18, radius: 4 }));
    x += w;
  });
}
const row = (p, r) => Array.from({ length: T[p].nc }, (_, c) => `${p}-${r}-${c}`);
const col = (p, c, n = T[p].nr) => [`${p}-h${c}`, ...Array.from({ length: n }, (_, r) => `${p}-${r}-${c}`)];
const all = (p, n = T[p].nr) => Array.from({ length: T[p].nc }, (_, c) => col(p, c, n)).flat();

const navs = ['navT', 'navQ', 'navF', 'navR', 'navM'];
const ext = ['xls', 'shp', 'sql', 'lx', 'ls', 'lq', 'nLink'];
const cmp = ['cmpX', 'cmpA', 'cmpS'];

els.push(
  { id: 'hero', type: 'title', x: 440, y: 400, kicker: 'Microsoft Access', text: 'Una base de datos que cabe en un archivo', size: 72, maxw: 1000 },
  { id: 'heroSub', type: 'text', x: 440, y: 610, align: 'start', text: 'Parte de Microsoft 365  ·  solo Windows  ·  para equipos pequeños', size: 26, tone: 'dim' },

  // Panel de navegación: los objetos que viven dentro del .accdb
  { id: 'nav', type: 'zone', x: 195, y: 455, w: 250, h: 710, label: 'mi-negocio.accdb' },
  { id: 'navT', type: 'box', x: 195, y: 190, w: 200, h: 104, label: 'Tablas', icon: 'database' },
  { id: 'navQ', type: 'box', x: 195, y: 315, w: 200, h: 104, label: 'Consultas', icon: 'search' },
  { id: 'navF', type: 'box', x: 195, y: 440, w: 200, h: 104, label: 'Formularios', icon: 'laptop' },
  { id: 'navR', type: 'box', x: 195, y: 565, w: 200, h: 104, label: 'Informes', icon: 'file' },
  { id: 'navM', type: 'box', x: 195, y: 690, w: 200, h: 104, label: 'Macros y VBA', icon: 'zap' },
  { id: 'objT', type: 'title', x: 470, y: 420, kicker: 'Un archivo .accdb', text: 'Cada tipo de objeto es una característica', size: 52, maxw: 960 },

  { id: 'cliT', type: 'text', x: 1090, y: 200, align: 'start', text: 'Clientes', size: 26, weight: 700 },
  { id: 'pedT', type: 'text', x: 430, y: 200, align: 'start', text: 'Pedidos', size: 26, weight: 700 },
  { id: 'lblCampo', type: 'text', x: 1435, y: 205, text: 'campo ↓', size: 20, weight: 700, tone: 'accent' },
  { id: 'lblReg', type: 'text', x: 1078, y: 338, align: 'end', text: 'registro →', size: 20, weight: 700, tone: 'info' },
  { id: 'dsT', type: 'text', x: 1090, y: 520, align: 'start', text: 'Clientes · Vista Diseño', size: 22, weight: 700 },
  { id: 'key', type: 'icon', name: 'key', x: 1062, y: 614, size: 30, tone: 'accent' },
  { id: 'resT', type: 'text', x: 1090, y: 560, align: 'start', text: 'Resultado', size: 22, weight: 700 },
);

table('cli', 1090, 250, [['Id', 70], ['Nombre', 190], ['Ciudad', 170]],
  [[1, 'Ana López', 'CDMX'], [2, 'Luis Pérez', 'Monterrey'], [3, 'Marta Ruiz', 'Guadalajara']]);
table('ds', 1090, 570, [['Campo', 170], ['Tipo de datos', 240]],
  [['Id', 'Autonumeración'], ['Nombre', 'Texto corto'], ['Alta', 'Fecha y hora'], ['Activo', 'Sí/No']]);
// Fila 5: primero el pedido rechazado (cliente 9), luego el que entra por el formulario.
table('ped', 430, 250, [['Id', 60], ['Fecha', 130], ['Total', 110], ['ClienteId', 140]],
  [[1, '03/02', '$800', 1], [2, '05/02', '$1,500', 3], [3, '09/02', '$2,200', 1], [4, '12/02', '$600', 2], [5, '15/02', '$900', 9]]);
table('res', 1090, 610, [['Nombre', 190], ['Fecha', 120], ['Total', 110]],
  [['Marta Ruiz', '05/02', '$1,500'], ['Ana López', '09/02', '$2,200']]);

els.push(
  { id: 'nKey', type: 'note', x: 700, y: 640, w: 460, tone: 'accent', title: 'Clave principal',
    text: 'Identifica cada registro y nunca se repite. Access crea el campo Id (Autonumeración) por ti.' },

  { id: 'rel', type: 'arrow', from: 'cli-h0', to: 'ped-h3', label: 'uno a varios', glow: true },
  { id: 'one', type: 'text', x: 1078, y: 226, text: '1', size: 22, weight: 700, tone: 'accent' },
  { id: 'many', type: 'text', x: 884, y: 226, text: '∞', size: 26, weight: 700, tone: 'accent' },
  { id: 'nRI', type: 'note', x: 650, y: 650, w: 480, tone: 'bad', title: 'Integridad referencial',
    text: 'Access rechaza el pedido del cliente 9: ese cliente no existe. Así no quedan pedidos huérfanos.' },

  { id: 'qry', type: 'code', x: 640, y: 670, title: 'Consulta: Pedidos grandes', size: 18,
    lines: ['Campo:      Nombre     Fecha     Total', 'Tabla:      Clientes   Pedidos   Pedidos', 'Criterios:                       >1000', 'SQL:  SELECT … WHERE Total > 1000'] },
  { id: 'aq1', type: 'arrow', from: [650, 456], to: [610, 572] },
  { id: 'aq2', type: 'arrow', from: [1295, 410], to: [880, 572] },
  { id: 'aqr', type: 'arrow', from: 'qry', to: 'res-0-0', label: 'Ejecutar' },

  { id: 'form', type: 'frame', kind: 'window', x: 640, y: 710, w: 460, h: 220, title: 'Formulario: Pedidos', size: 20, typed: 0,
    lines: ['Fecha:       20/02', 'Total:       $950', 'ClienteId:   2  (Luis Pérez)', '◀   Registro 5 de 5   ▶'] },
  { id: 'af', type: 'arrow', from: 'form', to: 'ped-4-1' },
  { id: 'nSave', type: 'note', x: 1295, y: 690, w: 400, tone: 'accent', title: 'Sin botón Guardar',
    text: 'Access guarda el registro en la tabla al pasar al siguiente o al cerrar el formulario.' },

  { id: 'rep', type: 'frame', kind: 'window', x: 860, y: 690, w: 660, h: 230, title: 'Informe: Ventas por cliente', size: 18, mono: true, typed: 0,
    lines: [['Cliente', 'Pedidos', 'Total'], ['Ana López', '2', '$3,000'], ['Luis Pérez', '2', '$1,550'], ['Marta Ruiz', '1', '$1,500'], ['Total', '5', '$6,050']]
      .map(([a, b, c]) => a.padEnd(14) + b.padStart(7) + c.padStart(12)) },
  { id: 'ar1', type: 'arrow', from: [650, 500], to: [700, 566] },
  { id: 'ar2', type: 'arrow', from: [1295, 410], to: [1040, 566] },
  { id: 'nPdf', type: 'note', x: 1370, y: 690, w: 300, tone: 'accent', title: 'Compartir',
    text: 'Se imprime o se exporta a PDF en un clic.' },

  { id: 'vba', type: 'code', x: 900, y: 330, w: 700, title: 'Módulo VBA: Cierre de mes', size: 26,
    lines: ['Private Sub btnCerrarMes_Click()', '    DoCmd.OpenQuery "PedidosDelMes"', '    DoCmd.OutputTo acOutputReport, _', '        "VentasPorCliente", acFormatPDF', 'End Sub'] },
  { id: 'btn', type: 'box', shape: 'pill', x: 760, y: 660, w: 320, h: 96, label: 'Cerrar mes', size: 28, icon: 'play', tone: 'accent' },
  { id: 'abtn', type: 'arrow', from: 'btn', to: 'vba', label: 'clic' },
  { id: 'nMacro', type: 'note', x: 1290, y: 660, w: 420, size: 21, tone: 'accent', title: 'Macro o VBA',
    text: 'Una macro se arma eligiendo acciones de una lista. VBA es código, para lo que la lista no alcanza.' },

  { id: 'xls', type: 'box', x: 1330, y: 230, w: 300, h: 104, label: 'Excel', sub: 'hojas de cálculo', icon: 'file' },
  { id: 'shp', type: 'box', x: 1330, y: 400, w: 300, h: 104, label: 'Listas de SharePoint', sub: 'datos en Microsoft 365', icon: 'cloud' },
  { id: 'sql', type: 'box', x: 1330, y: 570, w: 300, h: 104, label: 'SQL Server · ODBC', sub: 'bases de datos de servidor', icon: 'server' },
  { id: 'lx', type: 'arrow', from: 'xls', to: 'navT', label: 'importar' },
  { id: 'ls', type: 'arrow', from: 'shp', to: 'navT', label: 'vincular' },
  { id: 'lq', type: 'arrow', from: 'sql', to: 'navT', label: 'vincular', labelAt: .35 },
  { id: 'nLink', type: 'note', x: 760, y: 720, w: 560, size: 20, tone: 'info', title: 'Importar o vincular',
    text: 'Importar copia los datos al archivo. Vincular los lee donde están: si cambian en Excel o en el servidor, Access ve el cambio.' },

  { id: 'cmpX', type: 'note', x: 560, y: 330, w: 360, size: 22, title: 'Excel',
    text: 'Una lista o cálculos: una tabla, pocos datos, una persona.' },
  { id: 'cmpA', type: 'note', x: 950, y: 330, w: 360, size: 22, tone: 'accent', title: 'Access',
    text: 'Varias tablas relacionadas, formularios e informes. Equipo pequeño en Windows; archivo de hasta 2 GB.' },
  { id: 'cmpS', type: 'note', x: 1340, y: 330, w: 360, size: 22, tone: 'info', title: 'SQL Server o app web',
    text: 'Muchos usuarios a la vez, acceso desde web o celular, mucho volumen.' },
  { id: 'end', type: 'title', x: 400, y: 680, kicker: 'En resumen', text: 'Datos relacionados, equipo pequeño, Windows: Access.', size: 52, maxw: 1140 },
);

Motion.scene({
  title: '¿Qué es Microsoft Access?',
  subtitle: 'Qué es y qué trae: **tablas**, **relaciones**, **consultas**, **formularios**, **informes**, **macros** y **datos externos**',
  eyebrow: 'Bases de datos',
  lang: 'es',
  elements: els,
  steps: [
    { title: '¿Qué es Access?',
      say: 'Microsoft Access es un programa de **bases de datos**. Guarda tus datos y las herramientas para usarlos en un solo archivo. Viene en varios planes de Microsoft 365 y funciona solo en Windows.',
      do: [{ show: 'hero' }, { show: 'heroSub', fx: 'up' }] },

    { title: 'Un archivo, cinco tipos de objetos',
      say: 'Todo vive en un archivo **.accdb**. Su panel muestra cinco tipos de objetos: **tablas**, **consultas**, **formularios**, **informes** y **macros**. Cada uno es una característica de Access.',
      do: [{ hide: ['hero', 'heroSub'] }, { show: 'nav' }, { show: navs, stagger: .15 }, { show: 'objT' },
           { set: 'navT', sub: 'guardan' }, { set: 'navQ', sub: 'preguntan', with: true }, { set: 'navF', sub: 'capturan', with: true },
           { set: 'navR', sub: 'presentan', with: true }, { set: 'navM', sub: 'automatizan', with: true }] },

    { title: 'Tablas: donde viven los datos',
      say: 'Las **tablas** guardan los datos en filas y columnas, como Excel, pero cada campo tiene un **tipo**: texto, número, fecha, moneda o sí/no. La **clave principal** identifica cada registro.',
      do: [{ hide: 'objT' }, { set: navs, sub: '', with: true }, { set: 'navT', tone: 'accent', sub: 'Clientes' },
           { show: 'cliT' }, { show: all('cli'), stagger: .03 },
           { highlight: col('cli', 2), tone: 'accent' }, { show: 'lblCampo', with: true },
           { highlight: row('cli', 1), tone: 'info' }, { show: 'lblReg', with: true },
           { show: 'dsT' }, { show: all('ds'), stagger: .03 }, { show: 'key', fx: 'bounce' },
           { unhighlight: '*' }, { highlight: [...row('ds', 0), ...col('cli', 0)], tone: 'accent' }, { show: 'nKey' }] },

    { title: 'Relaciones: cada dato una sola vez',
      say: 'Las **relaciones** conectan tablas. Pedidos guarda solo el número del cliente, no su nombre. Con **integridad referencial**, Access rechaza pedidos de clientes que no existen.',
      do: [{ hide: ['lblCampo', 'lblReg', 'dsT', ...all('ds'), 'key', 'nKey'] }, { unhighlight: '*', with: true },
           { show: 'pedT' }, { show: all('ped', 4), stagger: .02 }, { set: 'navT', sub: 'Clientes · Pedidos' },
           { show: 'rel' }, { show: ['one', 'many'] }, { flow: 'rel', label: 'cliente 3' },
           { highlight: ['cli-2-0', 'cli-2-1', 'ped-1-3'], tone: 'accent' },
           { set: 'ped-4-3', tone: 'bad', dur: .01 }, { show: row('ped', 4), fx: 'left', stagger: .05 },
           { pulse: 'ped-4-3', tone: 'bad' }, { show: 'nRI' }] },

    { title: 'Consultas: preguntas a tus datos',
      say: 'Las **consultas** responden preguntas: ¿qué pedidos pasan de mil pesos? Las diseñas arrastrando campos o escribes **SQL**. El resultado se calcula al momento, con los datos de hoy.',
      do: [{ hide: [...row('ped', 4), 'nRI'] }, { unhighlight: '*', with: true }, { set: 'navT', tone: 'plain', with: true },
           { show: 'qry' }, { show: ['aq1', 'aq2'] }, { flow: 'aq1' }, { flow: 'aq2', with: true }, { line: 'qry', n: 3 },
           { show: 'aqr' }, { flow: 'aqr' }, { show: 'resT' }, { show: all('res'), stagger: .04 }, { line: 'qry', n: 4 },
           { highlight: ['ped-1-2', 'ped-2-2'], tone: 'ok' }, { set: 'navQ', sub: 'Pedidos grandes', tone: 'accent' }] },

    { title: 'Formularios: pantallas para capturar',
      say: 'Los **formularios** son pantallas para capturar y editar un registro a la vez, sin tocar la tabla. No hay botón Guardar: Access guarda al pasar al siguiente registro.',
      do: [{ hide: ['qry', 'aq1', 'aq2', 'aqr', 'resT', ...all('res')] }, { unhighlight: '*', with: true }, { set: 'navQ', tone: 'plain', with: true },
           { show: 'form' }, { set: 'form', typed: 1, dur: 2.5, ease: 'linear' },
           { set: 'ped-4-1', label: '20/02', dur: .01 }, { set: 'ped-4-2', label: '$950', dur: .01, with: true },
           { set: 'ped-4-3', label: '2', tone: 'plain', dur: .01, with: true },
           { show: 'af' }, { flow: 'af', label: 'registro 5' }, { show: row('ped', 4), fx: 'left', stagger: .05 },
           { highlight: row('ped', 4), tone: 'ok' }, { set: 'navF', sub: 'Pedidos', tone: 'accent' }, { show: 'nSave' }] },

    { title: 'Informes: para imprimir y compartir',
      say: 'Los **informes** agrupan y suman para presentar: ventas por cliente, con su total. Se imprimen o se exportan a **PDF** para compartirlos.',
      do: [{ hide: ['form', 'af', 'nSave'] }, { unhighlight: '*', with: true }, { set: 'navF', tone: 'plain', with: true },
           { show: 'rep' }, { show: ['ar1', 'ar2'] }, { flow: 'ar1' }, { flow: 'ar2', with: true },
           { set: 'rep', typed: 1, dur: 2.5, ease: 'linear' }, { set: 'navR', sub: 'Ventas por cliente', tone: 'accent' }, { show: 'nPdf' }] },

    { title: 'Macros y VBA: automatiza',
      say: 'Las **macros** y el código **VBA** automatizan tareas. Por ejemplo, un botón que ejecuta la consulta del mes y guarda el informe en PDF: diez clics se vuelven uno.',
      do: [{ hide: ['rep', 'ar1', 'ar2', 'nPdf', 'pedT', ...all('ped'), 'cliT', ...all('cli'), 'rel', 'one', 'many'] },
           { set: 'navR', tone: 'plain', with: true }, { show: 'btn', fx: 'zoom' }, { show: 'vba' },
           { show: 'abtn' }, { flow: 'abtn', label: 'clic' }, { line: 'vba', n: 2 }, { line: 'vba', n: 3 },
           { set: 'navM', sub: 'Cierre de mes', tone: 'accent' }, { set: 'navR', tone: 'ok', with: true }, { show: 'nMacro' }] },

    { title: 'Datos externos: Excel, SharePoint, SQL Server',
      say: 'Access se conecta con otros datos. Puedes **importar** o **vincular** hojas de Excel, listas de SharePoint y bases como **SQL Server**. Un vínculo lee los datos donde están, sin copiarlos.',
      do: [{ hide: ['btn', 'vba', 'abtn', 'nMacro'] }, { set: ['navM', 'navR'], tone: 'plain', with: true },
           { show: ['xls', 'shp', 'sql'], stagger: .15 }, { show: ['lx', 'ls', 'lq'], stagger: .12 },
           { flow: 'lx', label: 'copia' }, { flow: 'ls', with: true }, { flow: 'lq', with: true },
           { set: 'navT', sub: 'locales y vinculadas', tone: 'accent' }, { show: 'nLink' }] },

    { title: '¿Cuándo usar Access?',
      say: 'Usa Access cuando tus datos tienen **varias tablas relacionadas** y los usa un equipo pequeño en Windows. Para una lista simple basta Excel; para muchos usuarios o una app web, un servidor.',
      do: [{ hide: ext }, { set: 'navT', tone: 'plain', sub: '', with: true },
           { show: cmp, stagger: .2 }, { highlight: 'cmpA', tone: 'accent' },
           { set: 'navT', sub: 'guardan' }, { set: 'navQ', sub: 'preguntan', with: true }, { set: 'navF', sub: 'capturan', with: true },
           { set: 'navR', sub: 'presentan', with: true }, { set: 'navM', sub: 'automatizan', with: true },
           { pulse: navs, tone: 'accent' }, { show: 'end' }] },
  ],
});
