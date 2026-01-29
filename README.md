
---

# Wine List (QR Menu)

This is a super lightweight, mobile-first wine-by-the-bottle list designed to be accessed via QR code.

The site is intentionally simple:

* One page
* Optimized for smartphones
* Tap a wine to expand and see details
* No backend, no database, no authentication on the site itself

All wine data lives in a single JSON file so updates are fast, safe, and low-maintenance.

---

## How it works

* The QR code points to the root URL of this site.
* The page loads `wines.json` and renders a list of wines.
* Tapping a wine expands it inline to show a short description and details.
* The QR code never changes, even when the wine list is updated.

---

## File structure

```
/index.html    Main (and only) page
/wines.json    Wine data (this is what gets edited)
/app.js        Fetches + renders wines, handles tap-to-expand
/style.css    Mobile-first styling
```

---

## Updating the wine list

Only `wines.json` needs to be edited.

### Steps

1. Open this repository on GitHub
2. Click `wines.json`
3. Click the edit (pencil) icon
4. Add, remove, or modify wines
5. Commit the changes

The site will update automatically within a minute or two.

### Wine format

Each wine is an object in the array:

```json
{
  "name": "Producer",
  "wine": "Wine Name",
  "vintage": "2021",
  "region": "Region, Country",
  "grape": "Grape / Blend",
  "price": 85,
  "description": "Short, customer-facing description."
}
```

Notes:

* `price` should be a number (no dollar sign)
* `vintage` can be left as an empty string if not applicable
* Keep descriptions short (1–2 sentences max)

---

## Hosting

This site is hosted using GitHub Pages.

* No server
* No database
* No ongoing costs

Any commit to the main branch automatically updates the live site.

---

## Design decisions

* Single-page only (no navigation)
* Accordion-style expansion instead of modals (better on phones)
* No admin login on the site for security reasons
* Editing happens through GitHub instead of a custom CMS

This keeps the surface area small and avoids unnecessary complexity.

---

## Notes

If something looks broken:

* Check that `wines.json` is valid JSON (commas, quotes, brackets)
* Make sure prices are numbers
* Give GitHub Pages a minute to redeploy after commits

---

If you want, I can also write a short “how to edit this” version specifically for the bar manager, but this should be all you need for the repo itself.
