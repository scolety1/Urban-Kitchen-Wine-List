# Simon Design Review

## Verdict
YELLOW

## One-Sentence Read
The direction is finally behaving like a real wine list, but the mobile top end still feels a little heavy-handed and under-edited.

## Mission Fit
The design matches the mission: static, premium, mobile-first, and clearly built around browsing bottles and using Help Me Decide. The dark cellar palette, serif wine-list typography, staff picks, bins, regions, vintages, and prices all support the hospitality use case. The main weakness is not concept, it is refinement: the first mobile screen is confident but bulky, and a few scanability details still feel more "styled demo" than restaurant-grade tool.

## Taste Check
The black-and-warm-gold palette feels appropriate, restrained, and much better than generic SaaS styling. The table/list hybrid is smart: it keeps the wine-list ritual while making mobile cards readable. Staff Picks has good authority, and Help Me Decide is positioned as the signature interaction instead of buried.

What feels off: the mobile header and hero are oversized relative to the browsing job. The pill filters feel slightly chunky, and the horizontal nav appears to run past the viewport with limited affordance. Some text truncation in wine notes looks mechanical, especially where varietal copy cuts off mid-word. The card borders and boxed hero are tasteful, but there are many rectangles competing for attention. A little less frame, a little more rhythm.

## Visual Problems To Fix
- Mobile filter row overflows horizontally, with later categories pushed off-screen and no strong scroll cue.
- The mobile first screen spends too much vertical space on the title, filter pills, and hero before the user reaches bottles.
- Hero card buttons are large and equal-weight, making "Help Me Decide" less decisively primary than it should be.
- Wine card notes truncate awkwardly, including mid-word endings that feel generated rather than curated.
- Mobile wine rows have strong content, but the bin/name/price triangle is visually loud and competes with the tasting details.
- Desktop top controls feel oddly small and administrative, especially the "MOOD" and "CATEGORY" labels.
- Section cards stack with heavy borders, creating a boxed-in feeling instead of a graceful restaurant menu flow.
- Staff badges repeat aggressively on the first visible list, adding noise to an otherwise premium list.

## Strongest Opportunities
- Make Help Me Decide the unmistakable hero action with a clearer primary treatment and quieter secondary browse action.
- Reduce mobile header and hero height so the first bottle appears sooner without making the page feel cramped.
- Treat the filter bar like a polished mobile control: horizontally scrollable, edge-faded, evenly spaced, and calm.
- Improve wine card hierarchy by letting the wine name lead, price anchor, and bin become a quieter supporting marker.
- Replace hard truncation with shorter curated descriptions or cleaner line clamps that never cut mid-word.
- Use fewer enclosing borders and more spacing contrast to make the page feel less boxed and more hospitality-grade.
- Add a stronger selected-wine detail moment visually, so tapping a bottle feels rewarding rather than purely informational.

## Priority Fix
Fix the mobile first-screen hierarchy. The current mobile view is attractive, but it asks the guest to process brand, title, filters, hero copy, two hero buttons, and then Staff Picks before the actual browsing payoff. Tighten the header, slim the filter row, reduce hero padding, and make Help Me Decide clearly primary so a guest can understand the restaurant, choose a path, and see bottles faster.

## Designer Handoff
Keep the dark, editorial wine-list mood, the serif title language, Staff Picks, bin numbers, and the static Help Me Decide concept. Change the mobile spacing and hierarchy: make the header more compact, make the filter rail feel intentionally scrollable, reduce button bulk, and quiet down repeated badges. The next pass should feel like a confident sommelier put the phone in your hand and said, "Start here," not like every component is trying to be the entrance.

## What Not To Do Next
- Do not add more homepage sections.
- Do not add decorative graphics, gradients, or wine-glass clip art.
- Do not broaden the product into reservations, accounts, checkout, or restaurant operations.
- Do not make the wine cards denser just to show more metadata.
- Do not chase desktop polish before mobile hierarchy is tighter.
- Do not add more badge types unless the existing Staff badge gets calmer.
- Do not solve truncation with smaller text; solve it with better copy length and line behavior.

## Next 5 Design Tasks
- [ ] Tighten the mobile header and hero vertical spacing so Staff Picks begins higher on a 390px-wide viewport, without reducing tap targets below comfortable mobile size.
- [ ] Refine the mobile filter rail with visible horizontal-scroll affordance, consistent chip sizing, and no clipped-looking final category.
- [ ] Rebalance hero actions so Help Me Decide reads as the primary action and Browse Wines reads as secondary, without adding new copy.
- [ ] Adjust mobile wine card hierarchy so bin and Staff badge are quieter than wine name, region, vintage, and price.
- [ ] Replace awkward mid-word tasting-note truncation with cleaner line-clamp behavior or shorter curated text, preserving wine-aware tone.

## Stop Or Continue
continue but fix visual issues first