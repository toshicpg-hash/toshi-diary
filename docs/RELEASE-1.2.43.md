# PAPA HUB 1.2.43 — draft PR candidate

This release is prepared for review only. Do not merge, auto-merge, deploy Pages, or execute repair on a real device until the owner reviews the specific PR and separately approves the next action. Google94 and Flip are already confirmed by the parent; this candidate is for the remaining Fold local conflict only. Actual Android Fold operation is not claimed.

## Base, old asset and new delivery

Latest inspected main: `a7e0c7bf41e3933f88a43277e96cfa76d92c5ef3` (1.2.42). It is an ancestor of the existing repair branch, so no merge, rebase or force push was needed. No open competing PR or prior PR for this branch was found during preparation. 1.2.43 is the next unused version found in main, branches/tags and PR checks.

The previously published `hub-app-1.2.42.js` has been restored byte-for-byte from that main commit:

```text
SHA-256 177da3c6dfadbf2de7541577f48b5734ff62b3c127630bdfa98833b9c65670d4
```

The old filename is immutable; do not publish modified 1.2.42 bytes. The compatible normal store is included in the new `hub-app-1.2.43.js`. The standalone repair adapter is NOT in the application bundle and does not run on normal app startup.

Release files:

- `scripts/build-bundle.cjs`: 1.2.43 output filename and banner, same 48-source ordering.
- `hub-app-1.2.43.js`: newly generated application asset.
- `index.html`: new script URL, version badge and matching versioned CSS references.
- `hub-offline-worker.js`: VERSION 1.2.43, separate `papa-hub-static-1.2.43` cache and matching CORE URLs. Previous cache retention behavior is unchanged.
- `tools/diary-local-repair/index.html` and `ui.js`: explicit 1.2.43 dependency URLs / census-worker URL and owner instructions.
- `diary-core.js`, `diary-repair.js`, `diary-local-repair.js`, `tools/diary-local-repair/census-worker.js`, `tools/diary-repair/style.css`: deploy with the approved commit for standalone tool dependencies.

No auth/scope/permission changes, new deploy workflows, Google-write adapter, global merge relaxation or other-domain data migration are introduced.

## Mandatory delivery order after approval

1. Show the owner the exact PR and final test results. Obtain specific merge/deployment approval; stop here until received.
2. Deploy the reviewed full commit containing BOTH the compatible normal bundle and standalone tool/dependencies. Never deploy the repair page by itself to an old-only application.
3. Verify the served normal index/bundle/worker are 1.2.43, old 1.2.42 bytes still match the hash above, and every standalone tool dependency is present. Test cached upgrades separately; browser cache/UI version is not a data-repair receipt.
4. On Fold, close all HUB tabs/PWA windows, reopen normally online in the same browser/profile, and confirm the normal UI says `安全復帰版 1.2.43`. Do not clear storage/reinstall to force an update. Close the normal page before opening the repair page.
5. Only after parent verifies the current Google94 snapshot and writer stop, provide the new private manifest, verified Google94 snapshot and saved Fold88 diary backup. The old 93-record copy manifest is forbidden.
6. Open `/toshi-diary/tools/diary-local-repair/index.html` in that same origin/profile. Read-only inspect → save full live-meta archive → select that saved archive → enter planId → confirm writer stop and exact 1-record replacement/6 additions → apply.
7. Require `端末処理済み・再読込照合済み（94履歴）`. Close the tool and reopen the compatible normal app. Owner checks latest A1/B5, history and draft; report owner-screen confirmation separately. Google-live check, local processing, and owner-screen confirmation remain distinct.

The repair commits DB version 2 with original archive, journal, one replacement and six additions atomically. Old version-1 clients then fail closed on DB open. The compatible store is therefore required BEFORE repair. An interrupted committed repair leaves an applied receipt and blocks normal writes until identical-input readback/retry completes. No automatic rollback deletes added histories. Flip does not need this repair page; separate context tests prove no mutation to its version-1 DB94/draft.

## Preflight evidence

- Full Node suite: 199 passed.
- All browser scripts run locally with synthetic data and mocked/blocked external traffic; results recorded in the final PR body.
- Baseline release test uses an exact archive of main `a7e0c7b`, including immutable old bundle bytes. 1.2.42 → 1.2.43, normal close/reopen, online reload, offline reload, retained history/data and cached-byte SHA comparisons passed.
- Fold browser suite additionally starts the full 1.2.43 application after repair and checks 94 histories and the verified receipt.
- `node scripts/build-bundle.cjs` and `git diff --check` pass.

Tests and committed fixtures contain only fictional IDs/content. The parent independently checked private-history pure preparation; its separate Chromium sandbox launch restriction is not a failing code test or actual-device validation. No private manifest, backup, diary text, actual revision ID or screenshot is included in this PR.

CI status must be read for the final PR/head after creation. The repository currently contains only a manually dispatched Pages-recovery workflow, not a PR test workflow; do not call absent CI runs a passing CI check. No workflow dispatch is part of this task.

Final local results: all 12 browser scripts passed, including 15 Fold scenarios. The additional full-application reopening case initially used `/`, which the isolated test server does not serve; it was corrected to `/index.html` and the entire Fold browser suite passed. The other 11 browser suites had already passed. The release-upgrade run with exact main archive and the synthetic copy harness also passed. No application behavior was relaxed to obtain these results.
