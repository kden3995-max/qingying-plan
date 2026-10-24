# Apple Bento SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the approved light Bento redesign with independently displayed home, grouped profile and plan screens, retaining existing data behavior.

**Architecture:** Keep the current static HTML/JS stack and the existing planner/storage functions. A small hash router controls visibility, focus, scroll and browser history. The profile form stays mounted so raw drafts survive navigation; generated plans continue to use submitted profile snapshots. Result tabs isolate overview, weekly advice and records.

**Tech Stack:** Existing plain JavaScript, semantic HTML, CSS, system fonts, local images and a vendored MIT icon set; Node built-in tests and Chromium/Playwright for verification.

**Spec:** `docs/superpowers/specs/2026-10-23-apple-bento-spa-design.md`; approved images remain in `/workspace/qingying-design-review-2026-10-23/`.

## Global Constraints

- Do not publish, push, deploy or change the live website in this task.
- Preserve `app.js` and `features.js` calculations, health modes, date validation and storage schema/key `qingying-state-v1`.
- No new storage keys, health uploads, analytics, accounts or remote runtime dependencies.
- Use `#F5F5F7`, white cards, `#1D1D1F`, `#176149`, `#E8F2EC`; 24px card radii; system fonts; body usually at least16px and main touch controls at least44px.
- One primary screen and one result/profile subpanel visible at a time. Hashes contain view names only. Route changes scroll to top and focus the heading.
- Support browser back/forward, raw in-session drafts, unchanged committed results until regeneration, empty states and reduced motion.

## Review Focus

- A route opened directly without a generated plan must show an honest empty state while records remain independently usable (Task1 browser tests).
- Invalid/unfinished number inputs and health checkboxes must survive route/back operations without being silently normalized (Task1).
- Cross-tab updates must retain drafts and must not overwrite newer records following failed writes (Task2 regression suite).
- Clearing or importing must update all screens, labels and draft state without creating extra storage keys (Task2).
- Long caution/hold messages and narrow screens must remain readable with no hidden focusable content or horizontal overflow (Task3).

## Task1: Navigation and form/plan state

**Files:** create `router.js`, `tests/router.test.cjs`, `tests/navigation.cjs`; modify `index.html`, `ui.js`; add a reusable browser server helper if required.

**Interfaces:** `QingyingRouter.resolve(hash)` returns canonical `{screen,step,panel,hash}`; `QingyingRouter.start(onChange)` returns `{go,stop}`. UI owns form elements, current submitted data and all screen rendering. No router state is persisted.

- [x] Write tests for normal/legacy/unknown hashes, one visible screen, 3 form steps, error focus, draft/back/forward preservation, scroll reset, no reload and deep links.
- [x] Run tests and observe failures caused by missing navigation behavior.
- [x] Implement hash routes `#/home`, `#/profile/basic|habits|health`, `#/plan/overview|week|records`; hide inactive panels; use native anchors and accessible buttons.
- [x] Preserve empty first-use fields, optional explicit sample viewing, route-only drafts, submitted result snapshots and pending-regeneration messaging. Validate only the relevant step on Next and all fields on Generate; retain original planner validation.
- [x] Run router and navigation tests, then commit the independently verified task.

## Task2: Existing record and storage workflows

**Files:** modify `ui.js`, `tests/browser.cjs`, browser helpers; keep `app.js`/`features.js` unchanged.

**Interfaces:** continue using `QingyingPlanner`/`QingyingFeatures` unchanged; route rendering must not write to localStorage. Existing control IDs stay available inside their assigned screens.

- [x] Adapt existing regression tests to navigate to profile, weekly and records screens before operating controls; retain assertions for backup roundtrip, date ranges, holds, denied storage and cross-tab conflicts.
- [x] Run tests against the routed interface, fix integration issues while keeping storage/data algorithms unchanged.
- [x] Add assertions for no additional storage keys/network calls and for clearing/importing across views.
- [x] Run all logic/navigation/browser tests and commit.

## Task3: Responsive visual implementation and accessibility

**Files:** replace `styles.css`, remove old inline theme from `index.html`; add local `assets/` and attribution; add local preview script and update README; save captures/QA report outside runtime files.

**Interfaces:** style the semantic screens and their existing control IDs; use local image/icon paths only. Source images provide art direction; later screen-splitting requirements override old combined mock layouts.

- [x] Reuse the local meal asset or prepare a matching local hero asset; vendor a consistent line-icon library with its license.
- [x] Implement home hero/Bento, grouped form and results Bento, full-width explanations and readable daily/record panels; no fake data visualization.
- [x] Check 320/390/430/768/1440px, keyboard/focus/labels, touch sizes, reduced motion, health-hold copy and actual empty states in Chromium.
- [x] Inspect screenshots against approved home/results/mobile references, fix meaningful layout discrepancies, and save QA findings.
- [x] Run the complete relevant suite and syntax/diff checks; verify core files and storage format unchanged. Save reviewable screenshots, local runnable app and concise validation notes. Do not publish.

## Execution notes

Completed locally on 2026-10-24. The screen markup, event handlers, tests and CSS shared DOM interfaces, so the verified implementation is retained in one coherent local feature-branch commit rather than separate intermediate task commits. No push, merge or deployment. The independent final review identified two P2 form-validation compatibility issues; both were reproduced before fixing, covered by browser regressions, and accepted in the reviewer follow-up. Screenshot comparison also corrected mobile metric emphasis, touch targets and chart-label size. See `docs/ui-redesign-qa.md` and root `design-qa.md`.
