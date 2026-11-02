# Fold local adapter validation (synthetic only)

Base: `a7e0c7bf41e3933f88a43277e96cfa76d92c5ef3`.
Continuation before this adapter: `ec7a70a980e40e0da7ba74b981d732380bd9c633`.
No Google writes, live device operation, push, PR, merge or deployment.

- `node --test tests/*.test.cjs`: 181 passed, 0 failed.
- `node tests/diary-local-repair-browser.cjs`: 11 scenarios passed.
- Other browser scripts: 11 scripts passed (calendar-navigation, combined-sync, completion, completion-reconcile, deadline, diary-repair, google-account, money-card, money-list, money-release, money-sync).
- `node scripts/check-fold-local-copy.cjs --synthetic`: isolated copy adapter, idempotence, original retention, live metadata value retention and normal merge passed.
- `node scripts/build-bundle.cjs`: generated candidate matches all 48 ordered sources.
- `git diff --check`: passed.

Local browser scenarios:

1. Atomic single replacement and six additions; full original archive and live metadata retained; normal immutable guard and repeated sync preserved.
2. Separate simulated Flip remains DB version 1 with its 94 histories and own draft unchanged.
3. Wrong backup, confirmation or missing writer-stop consent performs no repair.
4. Concurrent draft/meta change between preparation and transaction aborts the upgrade and preserves the concurrent change.
5. Transaction abort rolls back records, metadata and DB version.
6. Another open DB blocks; delayed close does not cause a silently delayed repair.
7. Interruption after commit persists an applied receipt; normal writes stop; identical retry verifies.
8. Actual tab close after commit, then new tab in same isolated context, resumes from persisted journal.
9. Abort before execution and competing Web Lock do not apply.
10. Old explicit version 1 client receives VersionError. Already-open compatible store is invalidated and requires reload.
11. Actual service-worker census detects another window; dedicated UI requires saved-archive readback and plan confirmation before applying.

Initial test-only errors were corrected: an origin test accidentally supplied the changed origin as its own expected origin, and the browser harness initially collided with the UI's lexical `plan` name. Final runs above passed. No production immutable guard was relaxed to obtain these results.

Limitations: Chromium simulation, not Android Fold; no actual Google-current-state check; local close/reopen readback is not proof of OS fsync or indefinite browser retention. Existing optional old-release upgrade modes were not run. A fresh release asset/version and cache rollout must be prepared and explicitly approved before the owner can use this tool; the locally regenerated 1.2.42-named bundle must not be mistaken for deployed bytes. Private manifest/snapshot authenticity and freshness remain parent/owner verification responsibilities. A draft based on the replaced original ID is rejected for separate review.

## Independent-review follow-up: strict JSON preservation

`diary-local-repair.js` now rejects negative zero, sparse arrays, extra array own properties, symbol keys/values, hidden properties, accessors and cyclic values before copying. Live snapshots and history-hash inputs pass through the same check before their fields are read. Getter regression tests confirm no accessor invocation. Dense JSON arrays retain order and values.

Synthetic IndexedDB regressions store negative zero, sparse arrays and extra array properties, then confirm repair rejects them without upgrading DB version 1, changing the 88 histories, adding archive/journal, or altering the original metadata. No real private input was used.

Release files needed later, **not changed in this follow-up**:

- `scripts/build-bundle.cjs`: select the new release output filename and generated banner version.
- New `hub-app-<approved-version>.js`: generate from reviewed sources; preserve the ordered source wrappers.
- `hub-app-1.2.42.js`: before release, restore the original base commit's published bytes instead of publishing the locally modified candidate under the old cached filename.
- `index.html`: new bundle URL, version badge, and matching versioned CSS URLs used by the static cache.
- `hub-offline-worker.js`: new VERSION/CACHE and CORE URLs matching index/bundle; verify upgrade and offline behavior.
- Deploy the reviewed `diary-core.js`, `diary-repair.js`, `diary-local-repair.js`, `tools/diary-local-repair/{index.html,ui.js,census-worker.js}` and `tools/diary-repair/style.css` with the site. The normal store compatibility change is included in the newly generated bundle. The dedicated repair page must remain outside automatic app initialization.

`config.js`, `manifest.webmanifest`, and `hub-offline.js` contain no release-number reference requiring a version bump for this candidate. No auth/scope or other-domain changes are needed. Assigning the new release number, updating these files, deployment, and owner device execution still require the separate approved release workflow.

Follow-up results: all Node tests 196/196 passed; Fold adapter browser scenarios 14/14 passed; isolated synthetic copy harness passed; existing copy-tool browser suite passed; bundle consistency and diff checks passed. Chromium launched successfully in this environment. The parent's separate sandbox socket launch denial is an environment limitation, not a failed code test. Earlier unrelated browser suites were not rerun for this strict-serialization-only patch; their prior results above remain historical evidence.
