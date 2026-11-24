var SPIRIT_FAMILIES_ = ['Tequila & Mezcal', 'Gin', 'Vodka', 'Rum', 'Brandy & Cognac', 'Other Spirits'];

function suggestSpiritFamily_(name, inventoryCategory) {
  var category = managerText_(inventoryCategory).toLowerCase();
  var text = managerText_(name).toUpperCase();
  if (!text || /BEER|BITTERS|LIQUEUR|APERITIF|NON-ALCOHOLIC/.test(category)) return null;
  if (/MIX|SYRUP|ORGEAT|ZING ZANG|VERMOUTH|AMARO|APERITIVO|FERNET|CAMPARI|APEROL|CHART|SAMBUCA|LIMONCELLO|COINTREAU|GRAND MARNIER|CHAMBORD|FRANGELICO|ST\. GERMAIN|TUACA|DRAMBUIE|DISARONNO|PERNOD|SUZE|LUXARDO|CREME|CRÈME|GIFFARD|BRIOTTET|MALIBU/.test(text)) return null;
  if (/TEQUILA|MEZCAL|CASAMIGOS|PATRON|PATRÓN|DON JULIO|MILAGRO|MILARGO|EL JIMADOR|ASTRAL|DEL MAGUEY/.test(text)) return 'Tequila & Mezcal';
  if (/\bGIN\b|BEEFEATER|BOMBAY|BOTANIST|HENDRICK|MONKEY 47|ROKU|TANQUERAY|EMPRESS|OLD TOM|DRUMSHANBO/.test(text)) return 'Gin';
  if (/\bVODKA\b|TITOS|TITO'S|BELVEDERE|CHOPIN|GREY GOOSE|KETEL|REYKA|MEILI|OLAFSON|IMPERIA|ABSOLUT/.test(text)) return 'Vodka';
  if (/\bRUM\b|BACARDI|CAPTAIN MORGAN|DIPLOMATICO|DON Q|GOSLINGS|MYERS|SAILOR JERRY/.test(text)) return 'Rum';
  if (/BRANDY|COGNAC|COURVOISIER|HENNESS|REMY MARTIN/.test(text)) return 'Brandy & Cognac';
  if (/ABSINT|PISCO|MOONSHINE|AQUAVIT|CACHACA|Cachaça/i.test(text)) return 'Other Spirits';
  return null;
}

function validNonnegativePrice_(value) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function validateSpiritRow_(row) {
  var errors = [];
  if (!row || !managerText_(row.name)) errors.push('Guest Name is required.');
  if (row && row.showOnQr === true) {
    if (SPIRIT_FAMILIES_.indexOf(managerText_(row.spiritFamily)) < 0) errors.push('Spirit Family must be confirmed.');
    if (!managerText_(row.pourSize)) errors.push('Standard Pour Size is required.');
    if (!validNonnegativePrice_(row.pourPrice)) errors.push('Standard Pour Price is required.');
  }
  if (row && row.featuredShot === true) {
    if (row.showOnQr !== true) errors.push('A Featured Shot must also be shown on QR.');
    if (row.shotPrice !== '' && row.shotPrice !== null && row.shotPrice !== undefined && !validNonnegativePrice_(row.shotPrice)) errors.push('Shot Price must be zero or greater.');
    if (managerText_(row.shotNote).length > 120) errors.push('Shot Note must be 120 characters or fewer.');
  }
  return errors;
}

function buildSpiritWritePlan_(rows) {
  var fields = {
    name: 'Guest Name', spiritFamily: 'Spirit Family', style: 'Style / Expression', region: 'Country / Region',
    pourSize: 'Standard Pour Size', pourPrice: 'Standard Pour Price', doublePrice: 'Double Price',
    description: 'Description', featuredShot: 'Featured Shot', shotPrice: 'Shot Price', shotNote: 'Shot Note',
    showOnQr: 'Show on QR', sortOrder: 'Sort Order',
  };
  return (rows || []).map(function(row) {
    var errors = validateSpiritRow_(row);
    if (errors.length) throw new Error(row.name + ': ' + errors.join(' '));
    var values = {};
    Object.keys(fields).forEach(function(key) {
      if (Object.prototype.hasOwnProperty.call(row, key)) values[fields[key]] = row[key];
    });
    return { key: String(row.key || row.name), values: values };
  });
}

