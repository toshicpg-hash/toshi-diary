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
