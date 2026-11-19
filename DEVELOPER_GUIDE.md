# Developer guide

Urban Kitchen Drinks is a static, CSV-driven guest beverage menu. The implemented engineering includes CSV normalization, filtering/rendering, rule-based preference scoring, conservative whiskey metadata, and keyboard-accessible detail/picker flows. It does not use a recommendation model or require a backend.

## Contribution and boundaries

Spencer Colety maintains this project. Recent development and publication documentation are AI-assisted; Git author names are not evidence that every line was manually written. The restaurant identity/menu content belongs to its respective owner and is not offered as a reusable client-data fixture. This guide adds no client data and changes no menu or runtime behavior. The private manager/operational experiments are separate from this public guest release.

## Read the code

- [Wine recommendation](js/recommend.js): weighted preference matching.
- [CSV boundary](js/csv.js) and [rendering](js/render.js).
- [Whiskey recommendation](js/whiskey-recommend.js), [metadata](js/whiskey-metadata.js), and [picker](js/whiskey-picker.js).
- [Synthetic test fixtures](tests/helpers/whiskey-fixtures.mjs) and [public-release privacy guard](tests/public-release-privacy.test.mjs).

## Run locally

No dependency installation or bundler is needed. From the root, using Python 3:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`, `wine.html`, or `whiskey.html`. For data maintenance, use the existing [bar manager guide](BAR_MANAGER_GUIDE.md).

With Node.js 24:

```sh
node --test tests/production-contract.test.mjs tests/public-release-privacy.test.mjs tests/whiskey-metadata.test.mjs tests/whiskey-recommend.test.mjs tests/whiskey-ui.test.mjs
```

Verified November 14, 2026: all 94 tests passed against the current public source. These cover contracts, privacy guards, metadata/recommendation behavior and DOM fixtures; they do not prove every accessibility interaction or current beverage availability. The separate rendered Opera harness has a machine-specific executable path and is not part of this portable command.

This developer guide preserves the existing operator README and does not adopt newer local manager candidates.

## Guest menu update — November 18, 2026

The owner confirmed the current whiskey list with `IMG_0346 (1).HEIC`
(SHA-256 `fa979de8edc6f9092d9cf11c9ffb3246b26f3867f17ed854e66834465950cb96`).
The guest CSV now includes all 109 printed names and prices. Wrapped lines resolve
High West Double Rye ($12), Orphan Barrel Muckety Muck ($60), Ezra Brooks Cask
Strength ($16), Eagle Rare 10 yr ($18), and Orphan Barrel Fanged Pursuit ($35).
The 18 additions have no unverified tasting, producer, or age claims; existing
verified metadata stays intact. The older `_audit` decisions are historical and
remain excluded from the Pages build.

The two-choice guest selector is `/beverages/`. Direct QR destinations remain
`/wine.html` and `/whiskey.html`; `/wine/` and `/whiskey/` redirect to those pages.
Wine bin 154, 2021 Marenco Scrapona Moscato d'Asti, is $46 per bottle.
