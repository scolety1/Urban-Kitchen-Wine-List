var WINE_CSV_FIELDS_ = {
  'Bin': 'key',
  'Menu Name': 'name',
  'Type': 'type',
  'Varietal': 'varietal',
  'World': 'world',
  'Country': 'country',
  'Region': 'region',
  'Vintage': 'vintage',
  'Glass Price': 'glassPrice',
  'Bottle Price': 'bottlePrice',
  'Description': 'description',
  'Show on QR': 'showOnQr',
};

var WINE_WRITE_FIELDS_ = {
  name: 'Menu Name', type: 'Type', varietal: 'Varietal', world: 'World', country: 'Country',
  region: 'Region', vintage: 'Vintage', glassPrice: 'Glass Price', bottlePrice: 'Bottle Price',
  description: 'Description', showOnQr: 'Show on QR',
};

function parseManagerCsv_(text) {
  var rows = [], row = [], field = '', quoted = false;
  for (var index = 0; index < String(text).length; index += 1) {
    var char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"' && (quoted || field === '')) quoted = !quoted;
    else if (!quoted && char === ',') { row.push(field); field = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some(function(value) { return value !== ''; })) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function normalizeWineCsvRow_(headers, values) {
  var row = {};
  Object.keys(WINE_CSV_FIELDS_).forEach(function(header) {
    var index = headers.indexOf(header);
    if (index < 0) return;
    var key = WINE_CSV_FIELDS_[header];
    var value = values[index] === undefined ? '' : values[index];
    if (key === 'glassPrice' || key === 'bottlePrice') value = numberOrBlankManager_(value);
    else if (key === 'showOnQr') value = bool_(value);
    else value = managerText_(value);
    row[key] = value;
  });
  return row;
}

function comparableWine_(row) {
  return JSON.stringify({
    name: managerText_(row.name), bottlePrice: numberOrBlankManager_(row.bottlePrice),
    showOnQr: row.showOnQr === true,
  });
}

function reviewWineCsv_(csvText, currentRows) {
  var parsed = parseManagerCsv_(csvText);
  var headers = parsed.shift() || [];
  var rows = parsed.map(function(values) { return normalizeWineCsvRow_(headers, values); });
  var errors = [], byKey = {};
  rows.forEach(function(row, index) {
    var number = index + 2;
    if (!row.key) errors.push('CSV row ' + number + ': Bin is required.');
    if (!row.name) errors.push('CSV row ' + number + ': Menu Name is required.');
    if (row.bottlePrice === '' || Number(row.bottlePrice) < 0) errors.push('CSV row ' + number + ': Bottle Price is required.');
    if (row.key) {
      if (!byKey[row.key]) byKey[row.key] = [];
      byKey[row.key].push(number);
    }
  });
  Object.keys(byKey).forEach(function(key) {
    if (byKey[key].length > 1) errors.push('CSV rows ' + byKey[key].join(' and ') + ': duplicate Bin ' + key + '.');
  });
  var duplicateKeys = new Set(Object.keys(byKey).filter(function(key) { return byKey[key].length > 1; }));
  var invalidIndexes = new Set();
  rows.forEach(function(row, index) {
    if (!row.key || !row.name || row.bottlePrice === '' || Number(row.bottlePrice) < 0 || duplicateKeys.has(row.key)) invalidIndexes.add(index);
  });
  var currentByKey = Object.fromEntries((currentRows || []).map(function(row) { return [String(row.key), row]; }));
  var validRows = rows.filter(function(_, index) { return !invalidIndexes.has(index); });
  var added = 0, changed = 0, unchanged = 0;
  validRows.forEach(function(row) {
    var current = currentByKey[row.key];
    if (!current) added += 1;
    else if (comparableWine_(current) === comparableWine_(row)) unchanged += 1;
    else changed += 1;
  });
  var uploadedKeys = new Set(validRows.map(function(row) { return row.key; }));
  var hiddenKeys = (currentRows || []).filter(function(row) { return row.showOnQr && !uploadedKeys.has(String(row.key)); }).map(function(row) { return String(row.key); });
  var review = {
    rows: rows,
    hiddenKeys: hiddenKeys,
    errors: errors,
    counts: { uploaded: rows.length, added: added, changed: changed, unchanged: unchanged, hidden: hiddenKeys.length, invalid: invalidIndexes.size },
    highImpact: hiddenKeys.length > 0 && hiddenKeys.length === (currentRows || []).filter(function(row) { return row.showOnQr; }).length,
  };
  review.canPublish = review.errors.length === 0 && rows.length > 0;
  review.revision = stableHash_({ rows: rows, hiddenKeys: hiddenKeys, current: currentRows || [] });
  return review;
}

function buildWineWritePlan_(review) {
  if (!review || !review.canPublish) throw new Error('Wine review is not publishable.');
  return {
    upserts: review.rows.map(function(row) {
      if (!managerText_(row.key)) throw new Error('Wine Bin is required.');
      if (!managerText_(row.name)) throw new Error('Wine Menu Name is required.');
      if (row.showOnQr === true && !validNonnegativePrice_(row.bottlePrice)) throw new Error(row.name + ': a valid Bottle Price is required.');
      var values = {};
      Object.keys(WINE_WRITE_FIELDS_).forEach(function(key) {
        if (Object.prototype.hasOwnProperty.call(row, key)) values[WINE_WRITE_FIELDS_[key]] = row[key];
      });
      return { key: String(row.key), values: values };
    }),
    hides: (review.hiddenKeys || []).map(function(key) { return { key: String(key), values: { 'Show on QR': false } }; }),
  };
}

