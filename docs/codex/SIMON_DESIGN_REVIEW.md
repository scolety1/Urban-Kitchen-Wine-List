# Simon Design Review

## Verdict
YELLOW

## One-Sentence Read
The app now feels like a real wine list with hospitality intent, but the visual system is still more handsome spreadsheet than premium tableside experience.

## Mission Fit
The direction fits the mission: mobile-first browsing is clear, Help Me Decide is prominent, and the dark restaurant tone gives Urban Kitchen a more polished frame than a static PDF. The strongest alignment is the first mobile screen: guests immediately see the restaurant name, the wine-list purpose, category chips, and a direct recommendation path. The weaker fit is scan quality inside the list, where truncation, dense rows, and table habits still make some wines feel processed rather than selected.

## Taste Check
The typography, black-and-gold palette, and restrained borders are moving in the right hospitality lane. It has some cellar-menu confidence and avoids the worst generic SaaS sins.

What is off: the layout still clings to table structure too hard, especially on mobile. The huge filter chips, boxed hero, boxed sections, boxed table, and pill badges all stack into a lot of rectangles. It is tasteful, yes, but a little stiff. A wine person should feel curation; right now they also feel CSS.

## Visual Problems To Fix
- Mobile wine names truncate too aggressively, which hides the most important product information at the exact moment guests are trying to browse.
- The first-screen mobile hierarchy is clear but heavy: header, category chips, hero card, CTA buttons, and staff-picks card all compete in stacked boxes.
- Filter chips on mobile are oversized and consume too much vertical space before the user reaches the list.
- Staff Picks uses a table header on mobile, which adds restaurant-admin energy instead of guest-facing elegance.
- The "STAFF" badge repeats loudly on every pick and starts to feel like noise instead of endorsement.
- Desktop has a narrow centered content column with a lot of empty black margin, making the experience feel less rich than the available screen allows.
- The hero card is clean but generic; it says the right thing without giving much sensory wine personality.
- Price alignment is strong, but bottle prices dominate some mobile rows more than the wine story.

## Strongest Opportunities
- Turn mobile wine rows into elegant list cards with full names, tighter metadata, and a short reason-to-drink line before any truncation.
- Make Help Me Decide feel more like the signature feature visually: warmer, more tactile, less like just another filter pill.
- Reduce repeated badges and table labels so the wine itself carries the page.
- Use section rhythm better: Staff Picks should feel curated and editorial, while the full list can stay compact and browsable.
- On desktop, widen the experience slightly and create a more deliberate two-zone composition: controls and intro above, wine list with confident density below.

## Priority Fix
Fix mobile wine-card scanability first. The current mobile list is readable, but the wine names are cut off too often and the repeated table structure makes browsing feel mechanical. Nami should convert the mobile Staff Picks and list rows into a more guest-facing card/list treatment: full wine name where possible, one clean metadata line, one useful tasting or pairing line, price held steady on the right, and less badge repetition.

## Designer Handoff
Keep the black restaurant mood, serif headline, gold accents, and static frontend restraint. Change the mobile list presentation from "responsive table" to "premium wine browsing": fewer visible grid conventions, more breathing room around each wine, full names over clipped names, and a clearer hierarchy from wine name to region/year to style cue to price. Help Me Decide should remain the primary action, but it needs to feel like a guided hospitality moment, not a chunky green button in a row of category chips. The result should feel like a sommelier handed you a clean, confident shortlist on a phone.

## What Not To Do Next
- Do not add more homepage sections; the page needs refinement, not more furniture.
- Do not add decorative gradients, blobs, illustrations, or fake luxury texture.
- Do not make the palette more colorful just to prove it has color.
- Do not keep polishing desktop while mobile wine rows still truncate important names.
- Do not add backend, AI, APIs, analytics, reservations, checkout, or any operational scope.
- Do not bury Help Me Decide below more explanatory copy.
- Do not turn every improvement into another pill, badge, border, or card.

## Next 5 Design Tasks
- [ ] Redesign mobile wine rows so full wine names can wrap to two lines before truncating; preserve price visibility and avoid layout shift.
- [ ] Simplify Staff Picks on mobile by removing table-header energy and reducing repeated "STAFF" badge noise; keep the curated meaning clear.
- [ ] Tighten the mobile filter bar height by reducing chip padding and improving horizontal scroll behavior; do not reduce tap targets below comfortable mobile size.
- [ ] Give Help Me Decide a more distinct primary treatment than category filters; keep copy concise and avoid adding new claims.
- [ ] Adjust desktop content width and section spacing so the page feels intentionally composed on wide screens; do not introduce a new layout framework or dependencies.

## Stop Or Continue
continue but fix visual issues first