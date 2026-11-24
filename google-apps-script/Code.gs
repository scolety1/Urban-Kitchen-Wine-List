/**
 * Read-only public-menu projection for Urban Kitchen.
 * Deploy as a Web app that executes as the owner. This code exposes only the
 * allowlisted guest fields below and never accepts writes.
 */
const HEADER_ROWS = { Wine: 2, Whiskey: 4, 'Other Beverages': 4 };
const SPREADSHEET_ID = '1jPxMuvXcsvm1pu8np46FPl_MsnuplZYf9_RCqzrMAH0';

function doGet() {
  try {
    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      wine: publicWine_('Wine'),
      whiskey: publicWhiskey_('Whiskey'),
      spirits: publicSpirits_('Other Beverages'),
    };
    return json_(payload);
  } catch (error) {
    console.error(error);
    return json_({ error: 'Menu data is temporarily unavailable.' });
  }
}

function publicWine_(sheetName) {
  return publicRows_(sheetName).filter(function(row) { return row['Out'] !== true; }).map(function(row) {
    return {
      name: text_(row['Menu Name']),
      type: text_(row['Type']),
      varietal: text_(row['Varietal']),
      world: text_(row['World']),
      country: text_(row['Country']),
      region_1: text_(row['Region']),
      region_2: '',
      bin: text_(row['Bin']),
      vintage: text_(row['Vintage']),
      glass_price: numberOrBlank_(row['Glass Price']),
      bottle_price: numberOrBlank_(row['Bottle Price']),
      collection: row['Feature'] === true ? 'Feature' : '',
      staff_pick: row['Staff Pick'] === true ? 'Y' : 'N',
      stock: 'Y',
      show: 'Y',
      description: text_(row['Description']),
    };
  });
}

function publicWhiskey_(sheetName) {
  return publicRows_(sheetName).filter(function(row) { return row['Out'] !== true; }).map(function(row) {
    return {
      category: text_(row['Category']) || 'Whiskey',
      name: text_(row['Menu Name']),
      price: numberOrBlank_(row['Standard (1.5 oz)']),
      flight_price: numberOrBlank_(row['Flight (1 oz)']),
      double_price: numberOrBlank_(row['Double (2.5 oz)']),
      description: text_(row['Description']),
      flavor_tags: text_(row['Flavor Tags']),
    };
  });
}

function publicSpirits_(sheetName) {
  return publicRows_(sheetName).filter(function(row) {
    return row['Out'] !== true;
  }).map(function(row) {
    return {
      id: text_(row['Product']),
      name: text_(row['Guest Name']) || text_(row['Product']),
      family: text_(row['Spirit Family']),
      style: text_(row['Style / Expression']),
      region: text_(row['Country / Region']),
      pour_size: text_(row['Standard Pour Size']),
      price: numberOrBlank_(row['Standard Pour Price']),
      double_price: numberOrBlank_(row['Double Price']),
      description: text_(row['Description']),
      featured_shot: row['Featured Shot'] === true,
      shot_price: numberOrBlank_(row['Shot Price']),
      shot_note: text_(row['Shot Note']),
    };
  });
}

function publicRows_(sheetName) {
  const headerRow = HEADER_ROWS[sheetName];
  if (!headerRow) throw new Error('Unsupported menu sheet.');
  const response = Sheets.Spreadsheets.Values.get(
    SPREADSHEET_ID,
    "'" + sheetName.replace(/'/g, "''") + "'!A" + headerRow + ':ZZ',
    { valueRenderOption: 'UNFORMATTED_VALUE' }
  );
  const values = response.values || [];
  if (values.length === 0) return [];
  const headers = values.shift().map(text_);
  const showIndex = headers.indexOf('Show on QR');
  if (showIndex < 0) throw new Error('Show on QR column is missing.');
  return values.filter(function(valuesRow) {
    return valuesRow[showIndex] === true;
  }).map(function(valuesRow) {
    const row = {};
    headers.forEach(function(header, index) { row[header] = valuesRow[index]; });
    return row;
  });
}

function text_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numberOrBlank_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
