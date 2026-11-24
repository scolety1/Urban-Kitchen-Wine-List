var MANAGER_SCHEMA_VERSION_ = 1;

function valueAt_(headers, row, name) {
  var index = headers.indexOf(name);
  return index < 0 ? '' : row[index];
}

function bool_(value) {
  return value === true || String(value).trim().toUpperCase() === 'TRUE';
}

function numberOrBlankManager_(value) {
  if (value === '' || value === null || value === undefined) return '';
  var number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function managerText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function stableHash_(value) {
  var text = typeof value === 'string' ? value : JSON.stringify(value);
  var hash = 2166136261;
  for (var index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function projectWineRows_(source) {
  return (source.rows || []).filter(function(row) {
    return managerText_(valueAt_(source.headers, row, 'Bin')) || managerText_(valueAt_(source.headers, row, 'Menu Name'));
  }).map(function(row) {
    return {
      key: managerText_(valueAt_(source.headers, row, 'Bin')),
      name: managerText_(valueAt_(source.headers, row, 'Menu Name')),
      bottlePrice: numberOrBlankManager_(valueAt_(source.headers, row, 'Bottle Price')),
      showOnQr: bool_(valueAt_(source.headers, row, 'Show on QR')),
      source: { par: numberOrBlankManager_(valueAt_(source.headers, row, 'Par')) },
    };
  });
}

function projectWhiskeyRows_(source) {
  return (source.rows || []).filter(function(row) {
    return managerText_(valueAt_(source.headers, row, 'Menu Name'));
  }).map(function(row) {
    var name = managerText_(valueAt_(source.headers, row, 'Menu Name'));
    return {
      key: managerText_(valueAt_(source.headers, row, 'Stable ID')) || name,
      name: name,
      category: managerText_(valueAt_(source.headers, row, 'Category')) || 'Whiskey',
      price: numberOrBlankManager_(valueAt_(source.headers, row, 'Standard (1.5 oz)')),
      showOnQr: bool_(valueAt_(source.headers, row, 'Show on QR')),
      source: { onHand: numberOrBlankManager_(valueAt_(source.headers, row, 'On Hand')) },
    };
  });
}

function projectSpiritRows_(source) {
  return (source.rows || []).filter(function(row) {
    return managerText_(valueAt_(source.headers, row, 'Product'));
  }).map(function(row) {
    var name = managerText_(valueAt_(source.headers, row, 'Product'));
    var inventoryCategory = managerText_(valueAt_(source.headers, row, 'Category'));
    var family = managerText_(valueAt_(source.headers, row, 'Spirit Family'));
    return {
      key: name,
      name: managerText_(valueAt_(source.headers, row, 'Guest Name')) || name,
      inventoryCategory: inventoryCategory,
      spiritFamily: family,
      suggestedFamily: family || suggestSpiritFamily_(name, inventoryCategory),
      style: managerText_(valueAt_(source.headers, row, 'Style / Expression')),
      region: managerText_(valueAt_(source.headers, row, 'Country / Region')),
      pourSize: managerText_(valueAt_(source.headers, row, 'Standard Pour Size')),
      pourPrice: numberOrBlankManager_(valueAt_(source.headers, row, 'Standard Pour Price')),
      doublePrice: numberOrBlankManager_(valueAt_(source.headers, row, 'Double Price')),
      description: managerText_(valueAt_(source.headers, row, 'Description')),
      featuredShot: bool_(valueAt_(source.headers, row, 'Featured Shot')),
      shotPrice: numberOrBlankManager_(valueAt_(source.headers, row, 'Shot Price')),
      shotNote: managerText_(valueAt_(source.headers, row, 'Shot Note')),
      showOnQr: bool_(valueAt_(source.headers, row, 'Show on QR')),
      out: bool_(valueAt_(source.headers, row, 'Out')),
      source: {
        par: numberOrBlankManager_(valueAt_(source.headers, row, 'Par (source)')),
        location: managerText_(valueAt_(source.headers, row, 'Bin / location')),
      },
    };
  });
}

function projectManagerDraft_(sources) {
  var draft = {
    schemaVersion: MANAGER_SCHEMA_VERSION_,
    wine: projectWineRows_(sources.wine || { headers: [], rows: [] }),
    whiskey: projectWhiskeyRows_(sources.whiskey || { headers: [], rows: [] }),
    spirits: projectSpiritRows_(sources.spirits || { headers: [], rows: [] }),
  };
  draft.revision = stableHash_(draft);
  return draft;
}

