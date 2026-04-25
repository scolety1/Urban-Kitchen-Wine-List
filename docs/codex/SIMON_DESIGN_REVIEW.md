# Simon Design Review

## Verdict
YELLOW

## One-Sentence Read
The wine list is now credible and moody, but the mobile hierarchy still feels like a dressed-up data table trying to pass as hospitality.

## Mission Fit
The direction mostly matches the mission: static, premium, mobile-first, wine-aware, and focused on browsing plus Help Me Decide. The dark cellar palette, serif title, gold accents, and concise recommendation language give it a restaurant-adjacent feel. The miss is that the mobile browsing experience still prioritizes table mechanics over guest confidence; too many things are clipped, horizontally crowded, or labeled like an admin surface.

## Taste Check
The strongest taste move is the restrained black, ivory, olive, and brass palette. It feels more wine room than generic SaaS, which is correct. The typography has personality, and the staff picks section has enough ceremony to feel curated.

What is off: the UI still has a spreadsheet skeleton. "BIN / WINE / BOTTLE" on mobile is accurate, but not seductive. The filter rail is oversized and visibly clipped in some screenshots, which makes the first impression feel mechanically unresolved. The hero card is useful, but the repeated "Help Me Decide" buttons compete with the nav button. The staff tags are charming in theory, but on mobile they crowd the wine names and create a badge parade. Very "premium restaurant list built inside a CMS at 1:12 AM."

## Visual Problems To Fix
- Mobile filter bar clips off-screen, with "White" visibly cut in one screenshot; this makes the primary navigation feel unfinished.
- The "MOOD" and "CATEGORY" labels compete with actual controls and add noise without helping the guest choose.
- Mobile wine names are truncated aggressively, which hides the most important content in the list.
- The staff badge sits inline with long wine names and creates awkward spacing pressure on mobile.
- The list still reads as a table on phone, with column headers taking valuable vertical space before the content.
- Price is visually clear, but it dominates some rows more than the wine identity deserves.
- Desktop layout is clean but conservative; the central content column feels a little too boxed-in and static.
- The hero card repeats actions already present in the top controls, making the first screen feel slightly redundant.
- The palette is elegant, but the page risks becoming too uniformly dark and brown unless contrast moments are used with more intent.
- Section cards and borders are doing a lot of the visual work; the experience needs more hierarchy inside the content, not more containers.

## Strongest Opportunities
- Turn mobile wine rows into true hospitality cards: wine name, region/year, style cue, description, then price and bin as secondary metadata.
- Make Help Me Decide feel like the signature feature by giving it one confident primary placement instead of repeated equal-weight buttons.
- Replace table headers on mobile with softer metadata labels inside each wine item.
- Give filters a cleaner segmented-control treatment with a single scrollable row and no exposed category labels.
- Use staff picks as an editorial moment: fewer badges, stronger descriptions, and more intentional spacing.
- Add a subtle selected or recommended state that feels like a sommelier handoff, not a form result.
- Tighten desktop width and rhythm so the page feels like a designed wine list, not just a centered dataset.

## Priority Fix
Fix the mobile wine list hierarchy. On phone, the table structure should recede: remove or minimize the column-header feeling, stop truncating the wine identity so brutally, move the staff badge below or beside metadata with breathing room, and make each row feel like a tappable recommendation card. The guest should understand the bottle before they notice the grid.

## Designer Handoff
Keep the dark, elegant restaurant tone, the serif headline, the brass accents, and the practical Help Me Decide concept. Change the mobile layout from "responsive table" to "curated list": wine name gets the most room, region/year and varietal/style sit underneath, description gets one clean line or two, and price/bin become controlled supporting metadata. The filter system should feel like a polished tasting menu selector: compact, horizontally scrollable, obvious, and never clipped. The result should feel calm, confident, and showable at the bar without the guest feeling like they opened an inventory sheet.

## What Not To Do Next
- Do not add more homepage sections to hide the hierarchy problem.
- Do not add decorative wine imagery unless the core mobile list is fixed first.
- Do not make the palette richer by adding more browns, golds, or gradients.
- Do not overbuild Help Me Decide with extra questions before the basic list scan improves.
- Do not change backend scope, dependencies, deployment, analytics, or data architecture.
- Do not ignore mobile clipping because the automated visual report says there are no blockers.
- Do not solve truncation by making everything smaller; the layout needs better priority, not timid typography.

## Next 5 Design Tasks
- [ ] Refactor mobile wine rows so wine names can wrap to two lines before truncation, with price and bin kept stable and secondary.
- [ ] Move the staff badge out of the wine-name line on mobile; keep it visible but never allowed to compress the title.
- [ ] Simplify the mobile filter rail into one clean horizontal control row with no clipped buttons at 390px width.
- [ ] Reduce or hide table column headers on mobile and replace their meaning with inline metadata inside each wine item.
- [ ] De-duplicate first-screen calls to action so Help Me Decide has one dominant primary treatment and Browse Wines has a quieter secondary role.

## Stop Or Continue
continue but fix visual issues first