# Urban Kitchen Beverage Manager Guide

## Review the current guest menus

Open the Beverage Manager:

```text
https://urbankitchenbeverage.com/manager/
```

Use **Pull Wine** or **Pull Whiskey** to load the exact hard-coded snapshot used by the guest QR menus. Each review shows the published row count, missing required data, a short preview and a CSV download.

Pulling is safe. It does not change the live website.

The manager is currently in **Snapshot mode**. Secure Google Sheets publishing is not connected yet.

## Temporary update process

The two public source files are:

```text
data/wines.csv
data/whiskey.csv
```

Keep the filenames and CSV column headers unchanged. Prices must be plain numbers without dollar signs.

After changing Wine data, run:

```text
node scripts/enrich-wines.mjs
```

After changing Whiskey data, run:

```text
node scripts/build-whiskey-release.mjs
```

Run the project tests before publishing. Commit the source data and generated Wine files together.

## Future connected workflow

The planned secure workflow is:

1. Managers update the private inventory workbook.
2. The manager pulls only approved public menu fields.
3. The manager reviews published, hidden and incomplete rows.
4. An authenticated publish action updates the website while preserving its URLs and QR codes.

Private counts, par levels, costs, distributors and ordering notes must never be included in the public guest files.
