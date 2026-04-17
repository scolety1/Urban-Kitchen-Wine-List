# Urban Kitchen Drinks – Menu Instructions

This site is the live drinks menu used in the restaurant via QR code.
It is intentionally simple and spreadsheet-driven so updates can be made without touching any code.

Please read this before making changes.

For the simplest bar-manager instructions, use `BAR_MANAGER_GUIDE.md`.

---

## What you should edit (important)

All menu updates happen in the `data/` folder.

- `wines.csv` controls the wine list
- `whiskey.csv` controls the whiskey / bourbon list

If you are updating the menu, **these are the only files you should touch**.

You can edit them in Excel or Google Sheets and export as CSV when finished.

---

## What you should NOT edit

Please do not edit:
- any `.html` files
- anything in the `css/` folder
- anything in the `js/` folder
- the `CNAME` file

Changing those can break the menu for guests.

If something needs to change outside the CSV, contact the person who set this up.

---

## How menu items are shown

Each row in the CSV represents one item on the menu.

If the item is filled out correctly, it will automatically:
- appear under the correct varietal
- be grouped correctly by Old World / New World
- be ordered by region and bin number
- show prices properly (including market price)

You do not need to manually sort the spreadsheet for display purposes.

---

## Saving and uploading changes (very important)

The menu updates when the CSV files are updated **on GitHub**.
Editing the spreadsheet on your computer does NOT update the live menu by itself.

Follow these steps carefully.

### Step 1: Edit the spreadsheet
- Open `wines.csv` or `whiskey.csv` in Excel or Google Sheets
- Make your changes
- When finished, export or download the file as **CSV**
  - Make sure the file name stays exactly the same

---

### Step 2: Open the GitHub repository
- Go to the GitHub page for this project
- Make sure you are logged into the correct account
- Click into the `data/` folder

You should see `wines.csv` and/or `whiskey.csv`.

---

### Step 3: Upload the updated CSV
- Click on the CSV file you are replacing
- Click **“Add file”** or **“Upload files”** (depending on view)
- Upload your new CSV file
- Confirm that it replaces the old one

Do not upload extra copies or renamed files.

---

### Step 4: Commit the change
After uploading, GitHub will ask you to **commit** the change.

- Add a short message like:
  - “Update wine list”
  - “Wine menu update 9/14”
- Click **Commit changes**

This step is required.
Nothing goes live until the change is committed.

---

### Step 5: Wait for the site to update
Once committed:
- The site usually updates within 30–60 seconds
- You may need to refresh your phone or browser
- If you have the menu open already, fully reload the page

---

## If something looks wrong

If the menu does not update, looks broken, or items disappear unexpectedly:

First check:
- The file is saved as `.csv` (not `.xlsx`)
- The file name has not changed
- Column names are exactly the same as before
- No rows were accidentally deleted
- No extra commas were added inside important fields

If something still looks wrong:
- Do not keep guessing or changing random files
- Try reverting to the previous CSV version if you know how
- Otherwise, stop and contact the person who manages the site

It is much easier to fix one clean mistake than many small ones.

---

## QR codes and pages

- The main QR code points to the wine list
- The whiskey list lives on a separate page but uses the same system

Both menus update automatically when their CSV file is updated correctly.

---

## Final note

This system is designed so that:
- managers only edit spreadsheets
- guests always see a clean, organized menu
- normal updates do not break anything

If something feels unclear or frustrating to update, that is a system issue — not a user issue — and should be addressed properly.

---

## Wine enrichment pipeline

The source spreadsheet remains `data/wines.csv`. The enrichment pipeline reads that file, validates required columns, preserves original notes, adds normalized structured fields, and writes `data/wines.cleaned.csv` for review plus `data/wines.json` for the guest-facing website.

Run it from the project root:

```sh
node scripts/enrich-wines.mjs
```

Description fields are handled in this order: `description_final`, then `description_ai`, then the original `description`, which is preserved as `description_original`.

The pipeline also normalizes useful recommendation fields such as `type`, `style`, `body`, `acidity`, `sweetness`, `oak`, `pairing_tags`, `available`, and `staff_pick`. If those fields already exist in the source CSV, the pipeline keeps them; otherwise it infers practical defaults from the existing wine data.

Validation warnings are printed in the console. Missing names, missing prices, and missing descriptions are flagged so the data can be cleaned before publishing.

---

## Help Me Decide scoring

The guest-facing **Help Me Decide** feature is rules-based and deterministic. It does not call an AI model.

The questions are intentionally short: wine type, body, style, food, glass or bottle, and bottle budget.

The scoring logic lives in `js/recommend.js`. It gives points for matching type, body, style, food pairing, glass/bottle preference, budget, metadata completeness, and staff picks. Staff Picks get a small boost, but they do not dominate the results.

If a guest chooses **Anything**, the recommender tries to return a smart spread across different wine types. If exact matches are limited, it broadens to the closest available wines instead of failing.

---

## Specials status

Specials are intentionally removed from the current guest-facing app and print output. There is no Specials tab, page, route, or visible UI right now.

The wine data may still contain `collection` values so Specials can be reintroduced later without changing the spreadsheet structure.
