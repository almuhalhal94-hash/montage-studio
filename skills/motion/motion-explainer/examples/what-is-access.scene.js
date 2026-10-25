// Narrated with `motion voice` (af_heart). The Spanish version is que-es-access.scene.js.
// What is Microsoft Access? What it is and its features: tables, relationships, queries, forms,
// reports, macros/VBA and external data, on a small customers-and-orders database.
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
  { id: 'hero', type: 'title', x: 440, y: 400, kicker: 'Microsoft Access', text: 'A database that fits in one file', size: 72, maxw: 1000 },
  { id: 'heroSub', type: 'text', x: 440, y: 610, align: 'start', text: 'Part of Microsoft 365  ·  Windows only  ·  for small teams', size: 26, tone: 'dim' },

  // Navigation pane: the objects that live inside the .accdb
  { id: 'nav', type: 'zone', x: 195, y: 455, w: 250, h: 710, label: 'my-business.accdb' },
  { id: 'navT', type: 'box', x: 195, y: 190, w: 200, h: 104, label: 'Tables', icon: 'database' },
  { id: 'navQ', type: 'box', x: 195, y: 315, w: 200, h: 104, label: 'Queries', icon: 'search' },
  { id: 'navF', type: 'box', x: 195, y: 440, w: 200, h: 104, label: 'Forms', icon: 'laptop' },
  { id: 'navR', type: 'box', x: 195, y: 565, w: 200, h: 104, label: 'Reports', icon: 'file' },
  { id: 'navM', type: 'box', x: 195, y: 690, w: 200, h: 104, label: 'Macros & VBA', icon: 'zap' },
  { id: 'objT', type: 'title', x: 470, y: 420, kicker: 'One .accdb file', text: 'Each kind of object is a feature', size: 52, maxw: 960 },

  { id: 'cliT', type: 'text', x: 1090, y: 200, align: 'start', text: 'Customers', size: 26, weight: 700 },
  { id: 'pedT', type: 'text', x: 430, y: 200, align: 'start', text: 'Orders', size: 26, weight: 700 },
  { id: 'lblCampo', type: 'text', x: 1435, y: 205, text: 'field ↓', size: 20, weight: 700, tone: 'accent' },
  { id: 'lblReg', type: 'text', x: 1078, y: 338, align: 'end', text: 'record →', size: 20, weight: 700, tone: 'info' },
  { id: 'dsT', type: 'text', x: 1090, y: 520, align: 'start', text: 'Customers · Design View', size: 22, weight: 700 },
  { id: 'key', type: 'icon', name: 'key', x: 1062, y: 614, size: 30, tone: 'accent' },
  { id: 'resT', type: 'text', x: 1090, y: 560, align: 'start', text: 'Result', size: 22, weight: 700 },
);

table('cli', 1090, 250, [['Id', 70], ['Name', 190], ['City', 170]],
  [[1, 'Ann Lee', 'Chicago'], [2, 'Luke Park', 'Austin'], [3, 'Mary Cruz', 'Seattle']]);
table('ds', 1090, 570, [['Field', 170], ['Data type', 240]],
  [['Id', 'AutoNumber'], ['Name', 'Short Text'], ['Joined', 'Date/Time'], ['Active', 'Yes/No']]);
// Row 5: first the rejected order (customer 9), then the one entered through the form.
table('ped', 430, 250, [['Id', 60], ['Date', 130], ['Total', 110], ['CustomerId', 140]],
  [[1, 'Feb 3', '$800', 1], [2, 'Feb 5', '$1,500', 3], [3, 'Feb 9', '$2,200', 1], [4, 'Feb 12', '$600', 2], [5, 'Feb 15', '$900', 9]]);
table('res', 1090, 610, [['Name', 190], ['Date', 120], ['Total', 110]],
  [['Mary Cruz', 'Feb 5', '$1,500'], ['Ann Lee', 'Feb 9', '$2,200']]);

els.push(
  { id: 'nKey', type: 'note', x: 700, y: 640, w: 460, tone: 'accent', title: 'Primary key',
    text: 'Identifies each record and never repeats. Access creates the Id field (AutoNumber) for you.' },

  { id: 'rel', type: 'arrow', from: 'cli-h0', to: 'ped-h3', label: 'one to many', glow: true },
  { id: 'one', type: 'text', x: 1078, y: 226, text: '1', size: 22, weight: 700, tone: 'accent' },
  { id: 'many', type: 'text', x: 884, y: 226, text: '∞', size: 26, weight: 700, tone: 'accent' },
  { id: 'nRI', type: 'note', x: 650, y: 650, w: 480, tone: 'bad', title: 'Referential integrity',
    text: 'Access rejects the order for customer 9: that customer does not exist. No orphan orders.' },

  { id: 'qry', type: 'code', x: 640, y: 670, title: 'Query: Big orders', size: 18,
    lines: ['Field:      Name       Date      Total', 'Table:      Customers  Orders    Orders', 'Criteria:                        >1000', 'SQL:  SELECT … WHERE Total > 1000'] },
  { id: 'aq1', type: 'arrow', from: [650, 456], to: [610, 572] },
  { id: 'aq2', type: 'arrow', from: [1295, 410], to: [880, 572] },
  { id: 'aqr', type: 'arrow', from: 'qry', to: 'res-0-0', label: 'Run' },

  { id: 'form', type: 'frame', kind: 'window', x: 640, y: 710, w: 460, h: 220, title: 'Form: Orders', size: 20, typed: 0,
    lines: ['Date:        Feb 20', 'Total:       $950', 'CustomerId:  2  (Luke Park)', '◀   Record 5 of 5   ▶'] },
  { id: 'af', type: 'arrow', from: 'form', to: 'ped-4-1' },
  { id: 'nSave', type: 'note', x: 1295, y: 690, w: 400, tone: 'accent', title: 'No Save button',
    text: 'Access saves the record to the table when you move to the next one or close the form.' },

  { id: 'rep', type: 'frame', kind: 'window', x: 860, y: 690, w: 660, h: 230, title: 'Report: Sales by customer', size: 18, mono: true, typed: 0,
    lines: [['Customer', 'Orders', 'Total'], ['Ann Lee', '2', '$3,000'], ['Luke Park', '2', '$1,550'], ['Mary Cruz', '1', '$1,500'], ['Total', '5', '$6,050']]
      .map(([a, b, c]) => a.padEnd(14) + b.padStart(7) + c.padStart(12)) },
  { id: 'ar1', type: 'arrow', from: [650, 500], to: [700, 566] },
  { id: 'ar2', type: 'arrow', from: [1295, 410], to: [1040, 566] },
  { id: 'nPdf', type: 'note', x: 1370, y: 690, w: 300, tone: 'accent', title: 'Share',
    text: 'Print it, or export it to PDF in one click.' },

  { id: 'vba', type: 'code', x: 900, y: 330, w: 700, title: 'VBA module: Month end', size: 26,
    lines: ['Private Sub btnCloseMonth_Click()', '    DoCmd.OpenQuery "OrdersThisMonth"', '    DoCmd.OutputTo acOutputReport, _', '        "SalesByCustomer", acFormatPDF', 'End Sub'] },
  { id: 'btn', type: 'box', shape: 'pill', x: 760, y: 660, w: 320, h: 96, label: 'Close month', size: 28, icon: 'play', tone: 'accent' },
  { id: 'abtn', type: 'arrow', from: 'btn', to: 'vba', label: 'click' },
  { id: 'nMacro', type: 'note', x: 1290, y: 660, w: 420, size: 21, tone: 'accent', title: 'Macro or VBA',
    text: 'A macro is built by picking actions from a list. VBA is code, for what the list cannot do.' },

  { id: 'xls', type: 'box', x: 1330, y: 230, w: 300, h: 104, label: 'Excel', sub: 'spreadsheets', icon: 'file' },
  { id: 'shp', type: 'box', x: 1330, y: 400, w: 300, h: 104, label: 'SharePoint lists', sub: 'data in Microsoft 365', icon: 'cloud' },
  { id: 'sql', type: 'box', x: 1330, y: 570, w: 300, h: 104, label: 'SQL Server · ODBC', sub: 'server databases', icon: 'server' },
  { id: 'lx', type: 'arrow', from: 'xls', to: 'navT', label: 'import' },
  { id: 'ls', type: 'arrow', from: 'shp', to: 'navT', label: 'link' },
  { id: 'lq', type: 'arrow', from: 'sql', to: 'navT', label: 'link', labelAt: .35 },
  { id: 'nLink', type: 'note', x: 760, y: 720, w: 560, size: 20, tone: 'info', title: 'Import or link',
    text: 'Importing copies the data into the file. Linking reads it where it lives: change it in Excel or on the server and Access sees it.' },

  { id: 'cmpX', type: 'note', x: 560, y: 330, w: 360, size: 22, title: 'Excel',
    text: 'A list or calculations: one table, little data, one person.' },
  { id: 'cmpA', type: 'note', x: 950, y: 330, w: 360, size: 22, tone: 'accent', title: 'Access',
    text: 'Several related tables, forms and reports. A small team on Windows; files up to 2 GB.' },
  { id: 'cmpS', type: 'note', x: 1340, y: 330, w: 360, size: 22, tone: 'info', title: 'SQL Server or a web app',
    text: 'Many users at once, access from the web or a phone, lots of data.' },
  { id: 'end', type: 'title', x: 400, y: 680, kicker: 'In short', text: 'Related data, small team, Windows: Access.', size: 52, maxw: 1140 },
);

Motion.scene({
  title: 'What is Microsoft Access?',
  subtitle: 'What it is and its features: **tables**, **relationships**, **queries**, **forms**, **reports**, **macros** and **external data**',
  eyebrow: 'Databases',
  lang: 'en',
  elements: els,
  steps: [
    { title: 'What is Access?',
      say: 'Microsoft Access is a **database** program. It keeps your data, and the tools to use it, in a single file. It comes with several Microsoft 365 plans and runs only on Windows.',
      do: [{ show: 'hero' }, { show: 'heroSub', fx: 'up' }] },

    { title: 'One file, five kinds of objects',
      say: 'Everything lives in one **.accdb** file. Its navigation pane shows five kinds of objects: **tables**, **queries**, **forms**, **reports** and **macros**. Each one is a feature of Access.',
      do: [{ hide: ['hero', 'heroSub'] }, { show: 'nav' }, { show: navs, stagger: .15 }, { show: 'objT' },
           { set: 'navT', sub: 'store' }, { set: 'navQ', sub: 'ask', with: true }, { set: 'navF', sub: 'enter', with: true },
           { set: 'navR', sub: 'present', with: true }, { set: 'navM', sub: 'automate', with: true }] },

    { title: 'Tables: where the data lives',
      say: '**Tables** hold the data in rows and columns, like Excel, but every field has a **type**: text, number, date, currency or yes/no. The **primary key** identifies each record.',
      do: [{ hide: 'objT' }, { set: navs, sub: '', with: true }, { set: 'navT', tone: 'accent', sub: 'Customers' },
           { show: 'cliT' }, { show: all('cli'), stagger: .03 },
           { highlight: col('cli', 2), tone: 'accent' }, { show: 'lblCampo', with: true },
           { highlight: row('cli', 1), tone: 'info' }, { show: 'lblReg', with: true },
           { show: 'dsT' }, { show: all('ds'), stagger: .03 }, { show: 'key', fx: 'bounce' },
           { unhighlight: '*' }, { highlight: [...row('ds', 0), ...col('cli', 0)], tone: 'accent' }, { show: 'nKey' }] },

    { title: 'Relationships: each fact once',
      say: '**Relationships** connect tables. Orders stores only the customer number, not the name. With **referential integrity**, Access rejects orders for customers that do not exist.',
      do: [{ hide: ['lblCampo', 'lblReg', 'dsT', ...all('ds'), 'key', 'nKey'] }, { unhighlight: '*', with: true },
           { show: 'pedT' }, { show: all('ped', 4), stagger: .02 }, { set: 'navT', sub: 'Customers · Orders' },
           { show: 'rel' }, { show: ['one', 'many'] }, { flow: 'rel', label: 'customer 3' },
           { highlight: ['cli-2-0', 'cli-2-1', 'ped-1-3'], tone: 'accent' },
           { set: 'ped-4-3', tone: 'bad', dur: .01 }, { show: row('ped', 4), fx: 'left', stagger: .05 },
           { pulse: 'ped-4-3', tone: 'bad' }, { show: 'nRI' }] },

    { title: 'Queries: questions for your data',
      say: '**Queries** answer questions: which orders are over a thousand dollars? You design them by dragging fields, or write **SQL**. The result is computed on the spot, from current data.',
      do: [{ hide: [...row('ped', 4), 'nRI'] }, { unhighlight: '*', with: true }, { set: 'navT', tone: 'plain', with: true },
           { show: 'qry' }, { show: ['aq1', 'aq2'] }, { flow: 'aq1' }, { flow: 'aq2', with: true }, { line: 'qry', n: 3 },
           { show: 'aqr' }, { flow: 'aqr' }, { show: 'resT' }, { show: all('res'), stagger: .04 }, { line: 'qry', n: 4 },
           { highlight: ['ped-1-2', 'ped-2-2'], tone: 'ok' }, { set: 'navQ', sub: 'Big orders', tone: 'accent' }] },

    { title: 'Forms: screens for data entry',
      say: '**Forms** are screens to enter and edit one record at a time, without touching the table. There is no Save button: Access saves when you move to the next record.',
      do: [{ hide: ['qry', 'aq1', 'aq2', 'aqr', 'resT', ...all('res')] }, { unhighlight: '*', with: true }, { set: 'navQ', tone: 'plain', with: true },
           { show: 'form' }, { set: 'form', typed: 1, dur: 2.5, ease: 'linear' },
           { set: 'ped-4-1', label: 'Feb 20', dur: .01 }, { set: 'ped-4-2', label: '$950', dur: .01, with: true },
           { set: 'ped-4-3', label: '2', tone: 'plain', dur: .01, with: true },
           { show: 'af' }, { flow: 'af', label: 'record 5' }, { show: row('ped', 4), fx: 'left', stagger: .05 },
           { highlight: row('ped', 4), tone: 'ok' }, { set: 'navF', sub: 'Orders', tone: 'accent' }, { show: 'nSave' }] },

    { title: 'Reports: to print and share',
      say: '**Reports** group and total your data for presenting: sales by customer, with a grand total. Print them, or export them to **PDF** to share.',
      do: [{ hide: ['form', 'af', 'nSave'] }, { unhighlight: '*', with: true }, { set: 'navF', tone: 'plain', with: true },
           { show: 'rep' }, { show: ['ar1', 'ar2'] }, { flow: 'ar1' }, { flow: 'ar2', with: true },
           { set: 'rep', typed: 1, dur: 2.5, ease: 'linear' }, { set: 'navR', sub: 'Sales by customer', tone: 'accent' }, { show: 'nPdf' }] },

    { title: 'Macros and VBA: automate',
      say: '**Macros** and **VBA** code automate tasks. For example, one button that runs the monthly query and saves the report as a PDF: ten clicks become one.',
      do: [{ hide: ['rep', 'ar1', 'ar2', 'nPdf', 'pedT', ...all('ped'), 'cliT', ...all('cli'), 'rel', 'one', 'many'] },
           { set: 'navR', tone: 'plain', with: true }, { show: 'btn', fx: 'zoom' }, { show: 'vba' },
           { show: 'abtn' }, { flow: 'abtn', label: 'click' }, { line: 'vba', n: 2 }, { line: 'vba', n: 3 },
           { set: 'navM', sub: 'Month end', tone: 'accent' }, { set: 'navR', tone: 'ok', with: true }, { show: 'nMacro' }] },

    { title: 'External data: Excel, SharePoint, SQL Server',
      say: 'Access connects to other data. You can **import** or **link** Excel sheets, SharePoint lists and databases like **SQL Server**. A link reads the data where it lives, without copying it.',
      do: [{ hide: ['btn', 'vba', 'abtn', 'nMacro'] }, { set: ['navM', 'navR'], tone: 'plain', with: true },
           { show: ['xls', 'shp', 'sql'], stagger: .15 }, { show: ['lx', 'ls', 'lq'], stagger: .12 },
           { flow: 'lx', label: 'copy' }, { flow: 'ls', with: true }, { flow: 'lq', with: true },
           { set: 'navT', sub: 'local and linked', tone: 'accent' }, { show: 'nLink' }] },

    { title: 'When to use Access?',
      say: 'Use Access when your data has **several related tables** and a small team uses it on Windows. For a simple list, Excel is enough; for many users or a web app, use a server.',
      do: [{ hide: ext }, { set: 'navT', tone: 'plain', sub: '', with: true },
           { show: cmp, stagger: .2 }, { highlight: 'cmpA', tone: 'accent' },
           { set: 'navT', sub: 'store' }, { set: 'navQ', sub: 'ask', with: true }, { set: 'navF', sub: 'enter', with: true },
           { set: 'navR', sub: 'present', with: true }, { set: 'navM', sub: 'automate', with: true },
           { pulse: navs, tone: 'accent' }, { show: 'end' }] },
  ],
});
