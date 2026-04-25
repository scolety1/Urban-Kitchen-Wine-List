# Simon Design Review

## Verdict
YELLOW

## One-Sentence Read
The wine list now has a believable restaurant mood, but the mobile hierarchy is still a little too heavy-handed and boxed-in to feel fully hospitality-grade.

## Mission Fit
The direction matches the mission: dark, restrained, wine-aware, mobile-first, and clearly positioned around browsing plus "Help Me Decide." It feels much closer to a real in-person wine list than a generic app. The problem is not concept; it is refinement. The first mobile screen proves the idea, but it spends too much vertical space before the guest reaches actual wine.

## Taste Check
The best parts are the serif title, warm brass accents, dark dining-room palette, and clear staff-pick framing. The desktop table has real restaurant-list discipline.

The weaker parts are the oversized mobile chips, thick bordered panels, and repeated calls to action stacked too close together. It is polished, but still has a whiff of "component demo dressed for dinner." The wine list should feel edited, not padded.

## Visual Problems To Fix
- Mobile category chips are too large and horizontally crowded; "Sparkling" appears likely pushed offscreen, which makes the top navigation feel unfinished.
- The first-screen mobile hero consumes too much height before showing enough wine list content.
- "Help Me Decide" appears twice in the first mobile viewport, once in the top chip row and again in the hero, creating visual repetition instead of decisive hierarchy.
- The hero panel border and staff-picks panel border are both heavy, making the page feel boxed rather than elegant.
- Staff pick cards on mobile have strong content, but the wine name, badge, region, style, and note create a dense vertical stack with not enough typographic contrast.
- The truncated description on the second staff pick reads like the interface gave up mid-sentence. That is not premium.
- Desktop is centered and controlled, but the large empty black margins make the experience feel a bit narrow and static for a restaurant presentation.

## Strongest Opportunities
- Make "Help Me Decide" the signature mobile action with a cleaner, calmer first-screen hierarchy.
- Reduce border weight and rely more on spacing, tonal contrast, and typography to create sections.
- Tighten mobile wine cards so each bottle has a predictable scan pattern: bin, name, price, origin, grape/style, one polished note.
- Add a more refined horizontal chip treatment with smaller pills, better overflow behavior, and less button bulk.
- Give staff picks a slightly more editorial treatment so they feel selected by a person, not just filtered from a table.

## Priority Fix
Fix the mobile first-screen hierarchy. Keep the brand title and the "Help Me Decide" concept, but reduce the chip scale, remove the feeling of duplicate CTAs, shrink the hero's vertical footprint, and get the first staff pick higher on the screen. The guest should understand the restaurant, see the main action, and hit real wines faster.

## Designer Handoff
For the next batch, keep the dark restaurant palette, serif-led wine-list personality, brass accents, and staff-pick concept. Change the mobile rhythm: smaller top controls, softer section borders, tighter hero, and more confident wine-card typography. Do not add more content. Edit what is already here until it feels like a sharp printed wine list translated to a phone. The result should feel calm, premium, and easy to browse one-handed at a table.

## What Not To Do Next
- Do not add another section to explain the product.
- Do not add decorative flourishes, gradients, icons, or fake luxury texture.
- Do not make the cards bigger; they already have enough presence.
- Do not chase desktop polish before mobile hierarchy is settled.
- Do not change backend scope, data architecture, dependencies, analytics, or deployment.
- Do not let wine descriptions truncate in a way that looks accidental.

## Next 5 Design Tasks
- [ ] Reduce mobile top chip height and padding, preserving 44px tap targets and ensuring all category controls scroll cleanly without clipped labels.
- [ ] Tighten the mobile hero by reducing vertical padding and resolving duplicate "Help Me Decide" emphasis between the chip row and hero CTA.
- [ ] Soften panel borders on the hero and wine sections so structure remains clear without every section feeling boxed.
- [ ] Refine mobile staff-pick typography so name, badge, origin, style, note, and price form a faster scan path with no cramped stacking.
- [ ] Fix truncated wine-note presentation so shortened text feels intentional, or show a clean complete one-line note within the card.

## Stop Or Continue
continue but fix visual issues first