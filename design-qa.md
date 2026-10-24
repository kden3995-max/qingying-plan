# Design QA — 轻盈计划

Date: 2026-10-24. Scope: approved visual direction and the later explicit SPA constraints. The generated concepts are visual references, not a pixel-perfect specification for the old combined page.

**Source visual truth**

- `/workspace/qingying-design-review-2026-10-23/homepage-concept.png`: 1435×1096 pixels.
- `/workspace/qingying-design-review-2026-10-23/results-desktop-concept.png`: 1135×1386 pixels.
- `/workspace/qingying-design-review-2026-10-23/results-mobile-concept.png`: 853×1844 pixels, normalized to 390×844 for comparison.
- Later approved behavior: `docs/superpowers/specs/2026-10-23-apple-bento-spa-design.md` requires independent home/profile/plan screens and independent result panels. This supersedes the form below the home mock and the combined result mock.

**Browser evidence**

Chromium/Playwright rendered the local app over HTTP. `npm run dev -- --host 0.0.0.0 --port 4173 --strictPort` serves the local preview. Captures use deviceScaleFactor 1.

| State | CSS viewport and capture size | Implementation evidence |
| --- | --- | --- |
| Home, no data | 1435×1096 | `artifacts/qa-home-desktop.png` |
| Explicit sample overview, no records | 1135×1386 | `artifacts/qa-results-desktop.png` |
| Same sample overview, phone | 390×844 | `artifacts/qa-results-mobile.png` |
| Personal plan, full overview | 1440×1024 and 390×844; full-page image heights vary | `artifacts/results-desktop.png`, `artifacts/results-mobile.png` |
| Actual test record plot | 390×844; full page | `artifacts/records-with-data-mobile.png` |
| Health hold, long copy | 320×844; full page | `artifacts/hold-mobile.png` |

Source and implementation are physically combined in the same comparison boards: `artifacts/compare-home.png`, `artifacts/compare-results.png`, `artifacts/compare-mobile.png`. Desktop boards are downsampled equally for side-by-side inspection (900px home, 700px results per side); the mobile board keeps 390px per side. Source mocks have no browser/device chrome. The mobile source is downsampled by 390/853, not treated as a 1px-per-CSS-pixel capture.

Native-size focused regions: `artifacts/focus-home-type.png`, `artifacts/focus-mobile-metrics.png`, `artifacts/focus-mobile-chart.png`. These were opened in addition to the full-view comparison to assess Chinese text, numbers, controls, image crop and chart labels.

**Findings and comparison history**

- [P2, resolved] Initial mobile overview repeated the target/pace text and used small target numbers, making the main card tall and weakening the hierarchy. Evidence: `artifacts/compare-mobile-before.png`. Fixed the normal-pace presentation to use the shorter equivalent heading, larger target numbers, one period row and the existing fluctuation caveat. Full long-form advisories stay unchanged for rushed targets, caution and hold states. Long metric notes now appear in the full-width explanation card. Recaptured at the same state and viewport: `qa-results-mobile.png` and final `compare-mobile.png`.
- [P2, resolved] Seven day buttons could be narrower than 44px on phones. The phone selector now wraps into four columns. Browser assertions check every visible button/major route control at 320/390/430px, including the weekly panel.
- [P2, resolved] A fixed 640px SVG viewBox shrank chart-axis text below legible size on phones. Chart geometry now uses the rendered container width, and redraws after entering records or resizing. Dates, measured values and averaging algorithms are unchanged. A regression assertion verifies rendered chart-label size is at least 10px; final native-size evidence is `focus-mobile-chart.png` (normally about 12px).
- The independent code review's two P2 validation compatibility issues were separately reproduced and resolved; see `docs/ui-redesign-qa.md`.

**Required fidelity surfaces**

- Fonts/typography: system font stack prioritizes Apple/PingFang; local Noto Sans CJK SC is a Linux fallback, no downloaded font. Body text is generally 16px, helpers 13–15px, headings and target values clearly larger. Full-width long explanations remain left aligned. Native control/font rendering will vary on iOS.
- Spacing/layout: 22–26px card radii, 16px mobile gaps, 24–32px card padding, large primary result plus small metrics. Screens and panels are genuinely hidden, not stacked. There is no fixed bottom navigation or overlay covering inputs. The added result tabs and preserved explanatory labels intentionally add height versus the static phone concept.
- Colors/tokens: #F5F5F7 background, white cards, #1D1D1F primary text, #176149 actions and #E8F2EC tinted cards. Dark green/neutral copy remains distinct on both white and tint. No decorative gradient or fake health score.
- Image/assets: new local WebP follows the bright meal photography direction; desktop result crop is decorative and intentionally narrower to preserve text. Mobile hides that crop for room. Tabler outline icons are local SVGs with their MIT license. Daily personalized menus remain accurate text, rather than generic photos implied to represent the generated meals.
- Copy/content: simple headline and CTA; explicit sample badge; true empty states; conditional suggestions, all existing why explanations and health restrictions preserved. Equivalent normal-pace copy removes duplicated numbers already shown nearby. No testimonials, outcome promises or fabricated measurements.

**Intentional differences and open questions**

No blocking design question remains. The home form lives in its own screen, and diet/record content lives in separate tabs, as explicitly requested after the mocks. Longer original safety copy is retained rather than clipped to fit the generated composition. The new meal asset and standard line icon replace concept-only artwork in the same direction. The goal is the approved product design and working behavior, not literal transcription of image-generated labels or layout bugs.

**Implementation checklist**

- [x] Opened reference and implementation images; compared physically combined boards and focused native-size regions.
- [x] Addressed P2 findings; recaptured and compared revised states.
- [x] Tested generation, edits, pending state, routes/history, drafts, weekly panels, real records, imports/clears, failure states and keyboard menu.
- [x] Checked console/page errors (none in browser run), local-only runtime requests and responsive widths 320–1440px.
- [x] Preserved core calculation/storage files and avoided publication.

**Follow-up polish / test gaps**

P3: Recheck platform-specific font and native date/select appearance on an actual iPhone. No iPhone Safari or VoiceOver session was available in this environment; all stated browser evidence is Chromium. This is not a claim of physical-device verification.

final result: passed
