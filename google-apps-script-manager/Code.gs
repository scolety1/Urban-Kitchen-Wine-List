var MANAGER_SPREADSHEET_ID_ = '1jPxMuvXcsvm1pu8np46FPl_MsnuplZYf9_RCqzrMAH0';
var MANAGER_SHEETS_ = {
  wine: { name: 'Wine', headerRow: 2, key: 'Bin' },
  whiskey: { name: 'Whiskey', headerRow: 4, key: 'Stable ID', fallbackKey: 'Menu Name' },
  spirits: { name: 'Other Beverages', headerRow: 4, key: 'Product' },
};

function scriptProperty_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function assertManager_() {
  var email = managerText_(Session.getActiveUser().getEmail()).toLowerCase();
  var allowed = managerText_(scriptProperty_('ALLOWED_MANAGER_EMAILS')).split(',').map(function(value) {
    return value.trim().toLowerCase();
  }).filter(Boolean);
  if (!email || allowed.indexOf(email) < 0) throw new Error('This Google account is not authorized for the Urban Kitchen Beverage Manager.');
  return email;
}

function doGet() {
  assertManager_();
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Urban Kitchen Beverage Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function includeManager_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function readManagerSheet_(menu) {
  var spec = MANAGER_SHEETS_[menu];
  if (!spec) throw new Error('Unsupported beverage workspace.');
  var range = "'" + spec.name.replace(/'/g, "''") + "'!A" + spec.headerRow + ':ZZ';
  var values = Sheets.Spreadsheets.Values.get(MANAGER_SPREADSHEET_ID_, range, { valueRenderOption: 'UNFORMATTED_VALUE' }).values || [];
  return { headers: values.shift() || [], rows: values };
}

function pullCurrentDraft_() {
  return projectManagerDraft_({
    wine: readManagerSheet_('wine'),
    whiskey: readManagerSheet_('whiskey'),
    spirits: readManagerSheet_('spirits'),
  });
}

function pullDraftForMenus_(menuNames) {
  var requested = Array.isArray(menuNames) && menuNames.length ? menuNames : ['wine', 'whiskey', 'spirits'];
  var sources = { wine: { headers: [], rows: [] }, whiskey: { headers: [], rows: [] }, spirits: { headers: [], rows: [] } };
  requested.forEach(function(menu) { sources[menu] = readManagerSheet_(menu); });
  var draft = projectManagerDraft_(sources);
  draft.pulledMenus = requested.slice();
  return draft;
}

function pullMenus(menuNames) {
  var email = assertManager_();
  var draft = pullDraftForMenus_(menuNames);
  draft.manager = { email: email };
  return draft;
}

function getManagerBootstrap() {
  return { manager: { email: assertManager_() }, menus: ['wine', 'whiskey', 'spirits'], schemaVersion: MANAGER_SCHEMA_VERSION_ };
}

function reviewCsv(menuName, csvText, draftRevision) {
  assertManager_();
  if (menuName !== 'wine') throw new Error('CSV import is currently supported for Wine.');
  var current = pullCurrentDraft_();
  if (current.menuRevisions.wine !== draftRevision && current.revision !== draftRevision) throw new Error('Google Sheets changed. Pull again before reviewing this CSV.');
  return reviewWineCsv_(csvText, current.wine);
}

function columnName_(number) {
  var result = '';
  while (number > 0) { number -= 1; result = String.fromCharCode(65 + number % 26) + result; number = Math.floor(number / 26); }
  return result;
}

function writePlanToSheet_(menu, entries) {
  if (!entries || !entries.length) return 0;
  var spec = MANAGER_SHEETS_[menu];
  var source = readManagerSheet_(menu);
  var headers = source.headers.slice();
  var required = [];
  entries.forEach(function(entry) { Object.keys(entry.values || {}).forEach(function(header) { if (headers.indexOf(header) < 0 && required.indexOf(header) < 0) required.push(header); }); });
  var data = [];
  required.forEach(function(header) {
    headers.push(header);
    data.push({ range: "'" + spec.name + "'!" + columnName_(headers.length) + spec.headerRow, values: [[header]] });
  });
  var rowByKey = {};
  source.rows.forEach(function(row, index) {
    var key = managerText_(valueAt_(source.headers, row, spec.key)) || managerText_(valueAt_(source.headers, row, spec.fallbackKey || ''));
    if (key) rowByKey[key] = spec.headerRow + 1 + index;
  });
  var appended = [];
  entries.forEach(function(entry) {
    var rowNumber = rowByKey[String(entry.key)];
    if (!rowNumber) {
      var row = headers.map(function(header) {
        if (header === spec.key) return entry.key;
        return Object.prototype.hasOwnProperty.call(entry.values, header) ? entry.values[header] : '';
      });
      appended.push(row);
      return;
    }
    Object.keys(entry.values || {}).forEach(function(header) {
      var column = headers.indexOf(header) + 1;
      data.push({ range: "'" + spec.name + "'!" + columnName_(column) + rowNumber, values: [[entry.values[header]]] });
    });
  });
  if (data.length) Sheets.Spreadsheets.Values.batchUpdate({ valueInputOption: 'RAW', data: data }, MANAGER_SPREADSHEET_ID_);
  if (appended.length) Sheets.Spreadsheets.Values.append({ values: appended }, MANAGER_SPREADSHEET_ID_, "'" + spec.name + "'!A:ZZ", { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
  return entries.length;
}

function whiskeyWritePlan_(rows) {
  var allowed = { name: 'Menu Name', category: 'Category', price: 'Standard (1.5 oz)', showOnQr: 'Show on QR', description: 'Description' };
  return (rows || []).map(function(row) {
    var values = {};
    Object.keys(allowed).forEach(function(key) { if (Object.prototype.hasOwnProperty.call(row, key)) values[allowed[key]] = row[key]; });
    if (!managerText_(row.key) || !managerText_(row.name) || (row.showOnQr === true && !validNonnegativePrice_(row.price))) throw new Error('Whiskey rows require a stable ID, name, and valid price.');
    return { key: String(row.key), values: values };
  });
}

function dispatchPublishWorkflow_() {
  var token = scriptProperty_('GITHUB_TOKEN');
  var owner = scriptProperty_('GITHUB_OWNER');
  var repo = scriptProperty_('GITHUB_REPO');
  var workflow = scriptProperty_('GITHUB_WORKFLOW');
  if (!token || !owner || !repo || !workflow) return {
    state: 'sheet-updated-workflow-not-started',
    message: 'Google Sheet is current, but the website publishing workflow was not started. Configure the private GitHub dispatch settings, then retry.',
  };
  var apiUrl = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/actions/workflows/' + encodeURIComponent(workflow) + '/dispatches';
  var response = UrlFetchApp.fetch(apiUrl, {
    method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main' }),
  });
  var status = response.getResponseCode();
  if (status !== 204) return {
    state: 'sheet-updated-workflow-not-started',
    message: 'Google Sheet was updated, but GitHub returned ' + status + '. Retry publishing without changing the Sheet.',
  };
  return {
    state: 'published',
    message: 'Google Sheet was updated and the tested website publishing workflow started.',
    workflowUrl: 'https://github.com/' + owner + '/' + repo + '/actions/workflows/' + workflow,
  };
}

function publishMenus(menuNames, draftRevision, changes, confirmation) {
  var email = assertManager_();
  if (confirmation !== 'PUBLISH') throw new Error('Publish confirmation is required.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var selected = Array.isArray(menuNames) ? menuNames : [];
    var current = selected.length ? pullDraftForMenus_(selected) : { revision: draftRevision };
    var currentRevision = selected.length === 1 ? current.menuRevisions[selected[0]] : current.revision;
    if (selected.length && currentRevision !== draftRevision) throw new Error('Google Sheets changed. Pull again before publishing.');
    var changed = changes || {};
    if (selected.indexOf('wine') >= 0) {
      var wineReview = { rows: changed.wine || [], hiddenKeys: changed.wineHiddenKeys || [], canPublish: true };
      var winePlan = buildWineWritePlan_(wineReview);
      writePlanToSheet_('wine', winePlan.upserts.concat(winePlan.hides));
    }
    if (selected.indexOf('whiskey') >= 0) writePlanToSheet_('whiskey', whiskeyWritePlan_(changed.whiskey || []));
    if (selected.indexOf('spirits') >= 0) writePlanToSheet_('spirits', buildSpiritWritePlan_(changed.spirits || []));
    var postWriteDraft = pullCurrentDraft_();
    var receipt = dispatchPublishWorkflow_();
    receipt.managerEmail = email;
    receipt.sheetRevision = postWriteDraft.revision;
    return receipt;
  } finally {
    lock.releaseLock();
  }
}

function saveDraft(menuName, changes, draftRevision) {
  assertManager_();
  var current = pullCurrentDraft_();
  if (current.revision !== draftRevision) throw new Error('Google Sheets changed. Pull again before saving.');
  if (menuName === 'spirits') (changes || []).forEach(function(row) {
    var errors = validateSpiritRow_(row); if (errors.length) throw new Error(errors.join(' '));
  });
  return { state: 'validated', menu: menuName, revision: draftRevision };
}

function retryPublishWorkflow(sheetRevision) {
  assertManager_();
  var current = pullCurrentDraft_();
  if (current.revision !== sheetRevision) throw new Error('Google Sheets changed. Pull again before retrying publication.');
  return dispatchPublishWorkflow_();
}

