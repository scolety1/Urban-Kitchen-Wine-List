# Simon Design Review

## Verdict
YELLOW

## One-Sentence Read
The direction is credible and hospitality-aware, but the mobile UI still feels more like a styled data table than a truly polished restaurant wine experience.

## Mission Fit
The design matches the mission in broad strokes: dark dining-room mood, strong restaurant identity, staff picks, clearer calls to browse or use Help Me Decide, and more useful wine copy. The problem is execution polish on mobile. The first screen says "premium wine list," but the browsing layer still exposes too much table machinery, truncation, and horizontal crowding for something meant to be shown confidently on a phone.

## Taste Check
The strongest taste choice is the restrained black, ivory, and muted gold palette. It feels appropriate for a serious wine list and avoids generic SaaS brightness. The serif headline and section titles give the experience some restaurant character.

What feels weaker: the top filter rail is oversized and clipped on mobile, the table headers make the list feel operational rather than guest-facing, and the staff pick rows are dense in a way that hurts elegance. The UI is not amateur, but it is still carrying too much spreadsheet DNA.

## Visual Problems To Fix
- Mobile category controls are visibly cut off at the right edge, making the first interaction feel unfinished.
- The "Mood" and "Category" labels compete with the actual filter buttons instead of quietly organizing them.
- Wine names and descriptions truncate aggressively on mobile, which undermines the goal of better wine descriptions.
- Staff badges sit in the main title line and create visual clutter beside long wine names.
- The mobile list still uses table columns like "BIN," "WINE," and "BOTTLE," which feels less guest-friendly than a composed card layout.
- The hero card is strong, but it consumes a large amount of first-screen height before showing enough actual wine content.
- Price has good visibility, but the row hierarchy makes bin, badge, name, region, style, and description fight for attention.
- Desktop layout is clean but conservative; it feels competent, not yet memorable.

## Strongest Opportunities
- Turn mobile wine rows into true hospitality cards: name, price, region, style, and one useful tasting line without table-header baggage.
- Make Help Me Decide feel more like the signature feature by giving it a more distinctive mobile entry point and result presentation.
- Replace heavy truncation with intentional two-line limits and clearer tap affordance for full details.
- Reduce the filter rail visual weight so the restaurant name, Help Me Decide, and wine content lead the page.
- Use section rhythm more deliberately: staff picks should feel curated, not like the first rows in a database.

## Next 5 Design Tasks
- [ ] Fix the mobile filter rail so no category pill is clipped at common phone widths; keep horizontal scrolling only if the cut edge is clearly intentional and polished.
- [ ] Redesign one mobile wine row pattern to reduce table feel; preserve bin and price, but make name, region, style, and note scan cleanly without visual crowding.
- [ ] Move or restyle the "STAFF" badge so it supports the wine name instead of interrupting it; verify long wine names still read well.
- [ ] Adjust mobile truncation rules so wine names and tasting notes get enough room to feel useful; do not allow cards to become oversized or uneven.
- [ ] Tighten the first-screen vertical spacing so the hero remains premium but more of the wine list is visible on initial mobile load.

## Stop Or Continue
continue but fix visual issues first