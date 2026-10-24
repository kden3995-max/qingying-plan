# Memory Guest Mode Plan

Spec: docs/superpowers/specs/2026-10-24-memory-guest-mode-design.md. User has authorized native implementation and tests; no additional design approval, push or deployment.
Base: 59a6a14, file tree equal to the published 0f8e72e. Branch feature/memory-guest-mode.

## Constraints and interfaces

Keep app.js/features.js unchanged. UI state lives in the existing closure. Backup schema stays version1. Add only guest/legacy controls using the existing visual language. A monotonically increasing experience generation guards pending File.text results and confirmation. No cloud/auth implementation this phase.

## Task 1 — privacy lifecycle and migration

- [x] Add observable browser tests proving old auto-restore, browser writes, or late import would violate the new contract; run and observe RED before product changes.
- [x] Replace UI persistence with validated memory updates; add explicit legacy confirmation/deletion and backup error handling.
- [x] Add end/leave/restore sanitization covering hidden DOM, drafts, cached pages and pending asynchronous work. Keep route-only edits within the current experience.
- [x] Run targeted privacy tests to GREEN; record actual BFCache versus simulated lifecycle evidence.

## Task 2 — existing flow regression and responsive check

- [x] Update regression expectations for intentional non-persistence while retaining meaningful plan, health, menu, trend, backup, record/habit/checkin and navigation checks.
- [x] Test root and /qingying-plan/ mount, blocked storage, restore/delete failure, malformed backups, import races, responsive layout and console/network behavior.
- [x] Verify core file hashes and no backend or analytics runtime calls.

## Task 3 — real backend proposal and handoff

- [x] Research official Supabase/Firebase pricing and restrictions; propose a concrete identity+server-enforced data architecture for this static app.
- [x] Document consent-based guest migration, RLS, deletion endpoint, expiry/signout/request cancellation, cost limits and owner setup steps. Never add fake login or service credentials.
- [x] Run full verification, obtain one fresh whole-branch code review, fix confirmed findings, and distinguish verified guest behavior from unconfigured backend acceptance tests.
- [x] Keep local source/branch and provide reviewable package, validation notes and backend proposal. Do not push or publish.
