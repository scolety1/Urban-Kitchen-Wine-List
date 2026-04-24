# Urban Kitchen Wine List Mission

## 1. Mission

Urban Kitchen Wine List should be a polished, mobile-first digital wine list that can be shown confidently to wine people, restaurant managers, and hospitality professionals.

The site should make Urban Kitchen's wine program feel easier to browse, easier to talk about, and more premium on a phone.

This is a frontend-only wine list website. It must stay safe, static, lightweight, and reviewable.

The product should feel polished, wine-aware, fast, mobile-friendly, elegant, interactive, trustworthy, and ready to show in person.

## 2. Product Priorities

### Priority 1: Flawless Mobile Wine Browsing

The first screen and wine list flow should work beautifully on a phone.

Guests and wine people should quickly understand what restaurant this is for, how to browse wines, how to filter by style, how to use Help Me Decide, and why the wine list feels better than a static PDF.

### Priority 2: Better Wine Descriptions

Wine descriptions should sound polished, useful, and hospitality-aware.

Descriptions should help guests and staff understand style, body, region, grape/varietal, flavor profile, pairing idea, and why someone might like it.

Avoid generic filler.

### Priority 3: Help Me Decide

The Help Me Decide recommendation flow is the signature feature.

It should feel fun, useful, and credible without using AI or a backend.

It can use static matching logic and sample data only.

### Priority 4: High Trust, No Risk

This site may represent real work in front of wine people, so it must not include rough placeholder copy, broken links, fake claims, or unpolished UI.

## 3. Hard Forbidden Scope

Codex Fleet must not add or modify:

- backend
- auth
- login
- payments
- Stripe
- checkout
- real APIs
- secrets
- API keys
- environment variables
- new analytics/tracking scripts
- deployment scripts
- package files
- lock files
- dependencies
- real customer data
- unapproved restaurant claims
- broad framework rewrites
- `CNAME` unless explicitly approved

Existing files may mention the current deployed site or existing analytics setup. Do not add new tracking and do not change deployment/domain files unattended.

If a task requires forbidden scope, skip it and choose a safer task.

## 4. Safe Unattended Work

Codex Fleet may safely work on:

- HTML copy
- CSS polish
- JavaScript UI logic
- static wine data descriptions
- filtering/search UI
- Help Me Decide static logic
- accessibility improvements
- mobile layout improvements
- empty states
- docs/codex reporting files

## 5. Review Gates

A task may only be marked complete when:

1. Static check passes.
2. Working tree is clean after commit.
3. No forbidden files or concepts were added.
4. No backend/auth/payment/API/secrets/new tracking were added.
5. The change is small enough to review.
6. The site still feels premium and phone-friendly.

If any gate fails, stop for human review.

## 6. How To Choose Next Tasks

Prefer tasks that improve mobile wine browsing, wine descriptions, Help Me Decide, filters/search, visual polish, rough copy, and in-person showability.

Avoid tasks that add real integrations, deployment, analytics, payment, auth, dependencies, or broad rewrites.
