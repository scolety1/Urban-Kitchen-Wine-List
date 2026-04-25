# Simon Design Review

## Verdict
YELLOW

## One-Sentence Read
The wine list is finally starting to feel like a real hospitality object, but the mobile first screen is still too bulky and table-heavy to feel effortless.

## Mission Fit
The direction matches the mission: static, premium, wine-aware, mobile-first, and focused on browsing plus Help Me Decide. The mood is correct for Urban Kitchen: dark, restrained, serif-led, and more restaurant than SaaS. The miss is efficiency. A guest on a phone sees prestige before utility, but the layout makes them work too hard before the list becomes easy to scan.

## Taste Check
The typography, black-and-gold palette, restrained borders, and Staff Picks framing feel credible and more polished than a generic demo. The hero copy is clear, and Help Me Decide has the right prominence.

What is off: mobile scale is a little drunk on its own importance. The chips, hero, table header, and wine rows are all oversized at once, so hierarchy becomes volume rather than precision. Desktop has too much dead black margin and the content column feels like a nice menu trapped in a shipping container.

## Visual Problems To Fix
- Mobile category chips are too large and force horizontal overflow; "Sparkling" appears cut off from the first browsing moment.
- The mobile hero card consumes too much vertical space before the user reaches actual wines.
- The two hero buttons are heavy and nearly equal in weight, so the primary action is not crisp enough.
- Wine rows on mobile feel tall and table-bound; the bin, wine name, badge, region, style, description, and price compete instead of forming a clean card rhythm.
- Staff badges repeat loudly on every Staff Pick row, creating visual noise where the section title already explains the context.
- Description snippets truncate with ellipses, which feels unfinished in a premium wine context.
- Desktop layout is competent but under-composed: content sits in a narrow column with large empty black fields instead of feeling intentionally staged.
- The filter/navigation bar reads like controls bolted above the experience, not fully integrated into the wine list.

## Strongest Opportunities
- Turn the mobile top controls into a tighter, two-row browsing system: Help Me Decide as the hero action, category chips below with smaller sizing and no awkward clipping.
- Make wine rows feel more like premium menu cards on mobile: price and bin as quiet anchors, wine name as the star, tasting/pairing note as one elegant line.
- Reduce repeated Staff badges inside Staff Picks or make them subtler so the section breathes.
- Give desktop a more editorial menu composition with better max width, stronger section spacing, and less empty side darkness.
- Add one small hospitality cue near Help Me Decide that makes the feature feel like a sommelier shortcut, not a quiz widget.

## Priority Fix
Fix the mobile first-screen density. The current phone view looks expensive, but it spends too much space proving it. Tighten the header, reduce chip/button scale, prevent horizontal clipping, and compress the hero so a guest sees the brand, Help Me Decide, and the beginning of the wine list without the interface feeling inflated.

## Designer Handoff
Keep the black, ivory, and muted gold direction. Keep the serif title and the confident restaurant-menu mood. Next batch should make the mobile UI sharper and less swollen: smaller filter chips, cleaner top spacing, a more decisive primary action, and more compact wine rows. Do not add more sections. Make the result feel like a host can hand someone a phone and they immediately understand where to tap, what is special, and how to pick a bottle.

## What Not To Do Next
- Do not add another homepage section or intro block.
- Do not add decorative wine imagery unless it directly improves browsing.
- Do not make the palette lighter just to solve density.
- Do not add more badges, pills, or labels to create hierarchy.
- Do not change backend scope, data architecture, dependencies, or deployment.
- Do not ignore mobile overflow because desktop looks acceptable.
- Do not turn Help Me Decide into a gimmicky quiz with cute copy.

## Next 5 Design Tasks
- [ ] Reduce mobile header and filter chip sizing so all primary category controls feel intentional, with no clipped chip at 390px width.
- [ ] Compress the mobile hero card by tightening padding, button height, and text scale while preserving clear brand and Help Me Decide priority.
- [ ] Rework mobile Staff Pick rows so bin, price, wine name, region, style, and note scan in a calmer hierarchy without increasing row height.
- [ ] Make repeated Staff badges subtler inside the Staff Picks section, or remove them where the section context already communicates the meaning.
- [ ] Improve desktop composition by adjusting content width and section spacing only; do not add new content, imagery, or layout complexity.

## Stop Or Continue
continue but fix visual issues first