# Personal PAPA HUB money ledger

This feature belongs only to `toshi-diary`. It does not read or change company CPG HUB data. Connection is opt-in: loading/upgrading the app does not create a Google file or transmit money. Existing local records remain the displayed source until an explicit, reviewed two-device migration.

## Sources and boundaries

- Existing monthly rent sheets are the authoritative source for rent charges and receipts. The derived rent database says not to input there. This release never writes any rent master, bank, calendar, diary, receipt or image as part of money sync.
- `subjectMonth`, `plannedDate`, `plannedAmount`, `actuals[].date`, `actuals[].amount`, evidence and `done` are separate. Unknown values stay unknown. A planned payment is not proof of payment. Marking settled does not invent actual dates/amounts.
- A private app-created native Google Sheet is the common ledger. It has `設定`, `入出金履歴`, `端末比較`, `照合表示` and `同期記録`. Owner-only metadata and the expected owner, format, version, ledger ID and headers are verified before reading/appending. An inaccessible or shared file stops sync; the app does not expand permissions.
- OAuth uses the existing Calendar read permission for verified identity plus the existing Sheets and `drive.file` permissions. It does not request blanket Drive access or add bank integration. Tokens remain in memory. Because `drive.file` cannot inspect arbitrary connector-created files/folders, the app creates its own private Sheet. Choosing an existing Drive backup parent is a separate Drive operation; it must not be worked around with broader OAuth scopes.
- The initial Sheet is created in My Drive. If the owner wants it inside an existing private PAPA folder, verify that destination and move the already-created Sheet through the connected Drive tools, preserving its ID and permissions. Do not pretend the app can write an arbitrary existing folder with `drive.file`.

## First setup and preservation

1. Before real data is stored, present the exact data scope and destination to the owner. Confirm both device names. Do not treat an old screenshot, old full backup, or synthetic test file as current device data.
2. On the first device confirm its name and create the private ledger. On the second device connect **the same Sheet URL**. Do not create another independent ledger.
3. Each device sends an immutable money-only comparison: visible money records, original legacy money, overlay money/edits, prior money history and the source binding hash. No diary, photos, receipt documents, event lists or tokens are included. IndexedDB retains the same comparisons locally. Repeated unchanged comparison sends reuse the same comparison ID.
4. Until both latest comparisons are received and reviewed, the app says unmerged. Never infer that an empty common ledger means there are no local payments.
5. A money preservation download also contains the common revision archive. It omits images/diaries. This replaces neither the owner's full backups nor the rent master.

For owner-approved Drive archives, use an approved owner-only parent and the structure `お金管理バックアップ/Flip` and `お金管理バックアップ/Fold`. The parent URL/ID is private configuration and must never be committed here. Use a new timestamp + operation-ID JSON file for every saved archive; do not overwrite old files. Verify owner-only permissions on each created folder/file, read the saved bytes back and compare SHA-256 and contents before reporting success. No such folders or real archives are created by this source change. Source/destination approval must happen before any real archive save.

## Immutable protocol and concurrency

The authoritative ledger is the append-only revision log, not a mutable “latest row”. A record ID is permanent. Each correction has a new revision ID, all expected parent heads, action, device, time and SHA-256 of canonical JSON. No timestamp wins a conflict.

- Same-ID/same-content retries deduplicate logically. Same-ID/different-content variants are retained as unverified. Bad fingerprints are quarantined without preventing unrelated records from being read.
- Offline sibling edits remain conflicting heads. Ambiguous records are excluded from sums until the owner reviews all heads and appends a resolution referencing them all.
- A settled parent cannot become unsettled through import/ordinary edit. Explicit reopen/resolve requires a reason. An old offline sibling cannot silently win over settlement.
- New entries reserve their ID/revision ID before a save retry; failures retain the form. Local writes atomically compare current heads and verify readback. They do not replace all IndexedDB records.
- Cloud sync reads first, appends only missing revisions/comparison chunks, then re-reads and checks the complete current version. Unknown POST results are retried under the same operation/IDs; no automatic second ledger is created. `RAW` Sheet writes do not interpret financial titles as formulas.
- A last readback is evidence for that revision set at that time. It is not proof that an offline device has no unsent edits, that another writer cannot update later, or that a bank transfer happened.

## Reviewed migration

A private JSON plan pins exactly two device comparison IDs and fingerprints. Each source row must appear exactly once in a target group; both devices’ positional legacy keys are namespaced by comparison/device rather than assumed globally equal. No device-only row can be silently dropped. The owner reviews differences, amount, target month, actuals, settled state, evidence and rent-master correspondence before apply.

The plan produces deterministic initial revision IDs. Retry uses the original migration author/time; later edits on another device cannot change them. Migration provenance and source aliases remain immutable. All initial revisions and their source comparisons must be present before migration is regarded as complete. Partially uploaded roots remain pending and do not count as confirmed money.

A plan cannot silently reset a settled source. A reviewed reopen needs an explicit flag and reason. A later original-client edit creates a new comparison and a visible unreviewed-source warning; it cannot revert canonical settled state. The original legacy/overlay money and their previous histories are never deleted or overwritten. After migration their old editing/import/recovery routes are blocked for money; the preserved source can still be viewed. Other recovery work is unchanged.

The money screen, home summaries and calendar money rows use the same canonical records after migration. Original records are available under the explicitly labelled preserved-source view, not mixed into totals. Unknown dates/amounts and conflicts remain visible as incomplete information.

## Nami: read and reconcile, do not edit

1. Ground the owner's exact private native Sheet from live metadata. Read `設定`, all `入出金履歴`, all `端末比較`, `照合表示` and `同期記録`. Read in bounded pages until the actual end; do not silently truncate or fetch a giant base64 export.
2. Read the complete history/comparison ranges a second time; retry if their canonical contents changed. Verify the owner/schema/ledger ID. Check latest per-device comparison ancestry; dates alone do not establish latest. Check source-drift notices and last device receipt times. Unknown device updates remain unknown.
3. Recalculate revisions and SHA-256 using `scripts/check-money-ledger.cjs` (Node with WebCrypto). Input is private JSON with `settingsRows`, `historyRows`, `sampleRows`, `projectionRows` (each including exact headers), `expectedOwner`, `expectedLedgerId` from verified metadata/setup, and optional `subjectMonth`. Output contains private financial data: never commit/upload it publicly.
4. Only trust projection rows whose checkpoint equals the recalculated history checkpoint **and whose full cells match the reconstructed projection**. A stale/partial display is not “no records”. Inspect conflicts/quarantine and per-device samples explicitly. The script exits 2 for a stale/incomplete projection, unverified histories/comparisons, unmerged device sources or unreviewed source edits. This still preserves readable comparison information; it must not be treated as complete device agreement.
5. Reconcile rent against the authoritative monthly rent sheet using property, unit, component and target month. Do not key by row number alone. Use a reviewed stable alias before adding its reference. Never add both a local rent item and the corresponding master item as separate totals.
6. Report the exact read time, history checkpoint, device comparison IDs/times, source coverage and outstanding uncertainty. Do not claim current device agreement before both devices send and re-read the same version.
7. Nami's initial role is read/reconcile. Do not overwrite existing revision cells or write settlement, rent or migration based solely on an interpretation of prose. Further writes require a separate reviewed change.

## Backups and restoration

`papa_hub_money_v1` is a separate append-only database. Safety backups include it and verify stable original stores and money data. The incremental full exporter enumerates this database (including its fallback name list). Money archive restore appends missing revisions/comparisons; it never replaces current data or silently restores connection/device settings. An old archive cannot overwrite a newer settled head. Invalid archives stop with the source preserved.

The existing photo/receipt/diary stores, complete-backup markers, source binding, Google settings and static PDF resources are preserved. The Service Worker caches only static assets; the new bundle/style are versioned together. Old caches and cached PDF resources are retained. No OAuth response, Sheet contents or private archive is cached by the Service Worker.

## Validation and limits

Synthetic tests cover two isolated devices, device-only records, equal positional keys on different devices, settlement retention, stale/forked comparison plans, retry IDs, chunk interruption, same-ID tampering, account/ACL/schema rejection, current projection verification, offline siblings, reviewed resolution, failed-save input retention, reload, append-only restore, full backup inclusion, canonical calendar values and phone widths. Existing identity, calendar/gesture and ToDo tests plus cold offline upgrade tests are also run.

These tests do not establish Android real-device OAuth/Drive behavior, successful real Sheet creation, current Flip/Fold source completeness, bank payments or actual migration. Real owner data is not present in the code or fixtures. Both current device comparisons and a private reviewed mapping are required before real migration. The independent unfinished receipt-PDF work must rebase onto this release rather than overwrite it.

## Money list presentation (1.2.37)

The personal common-ledger screen defaults to unsettled entries. The status selector has unsettled, settled and all options, stored only as current UI state. Within each section, planned dates sort oldest first. Entries with no valid planned date have a labelled undated group. Unknown claim months have their own initially closed section and never enter the selected-month section or its totals. This does not infer missing claim months from payment dates. Connection and backup details are collapsed; touch targets stay at least 44px. These controls never write money, dates, statuses, IDs, history or connection settings. Migration/device verification remains a separate workflow.


## Compact record cards (1.2.38 draft, not published)

Record actions show 編集 / 実績 / 消込 (消込取消 for settled records) on one line.
Full action descriptions remain in accessible names and tooltips. Each action
retains at least a 44 × 44 CSS px target. Record IDs are available in the existing
collapsible history area, now labelled 詳細・履歴; raw history is unchanged.
Only presentation changes: values, dates, subject months, settlement state, IDs,
authentication, persistence and synchronization are unchanged.

Synthetic Chromium comparison against main `f27fb93`, with the same long title,
long ID and actual entry (closed details; CSS px, rounded):

| Viewport | Action height before → after | Pending card before → after | Settled card before → after |
| --- | --- | --- | --- |
| 280 | 102 → 44 | 415 → 284 | 395 → 264 |
| 320 | 81 → 44 | 369 → 263 | 349 → 243 |
| 360 | 60 → 44 | 348 → 263 | 328 → 243 |
| 390 | 60 → 44 | 303 → 218 | 328 → 243 |
| 822 | 44 → 44 | 221 → 194 | 249 → 222 |

Run `node tests/money-card-browser.cjs` for narrow/wide layout, action labels and
accessible descriptions, details keyboard toggling, edit/actual dialogs and
canceled settlement/reopening. It blocks external requests and verifies raw
ledger/history/localStorage remain unchanged after these interactions. Optional
`MONEY_TEST_ROOT`, `MONEY_TEST_BASELINE=1` and `MONEY_TEST_OUTPUT` allow comparison
against an archived base checkout. Results and synthetic screenshots go outside
the repository by default. Also run `node --test tests/*.test.cjs`,
`node tests/money-list-browser.cjs`, `node tests/money-sync-browser.cjs`,
`node scripts/build-bundle.cjs` and `git diff --check`.

The source-order test now includes the existing `hub-money-list.js` entry added
in 1.2.37; the prior expectation also failed on unmodified main.
Real device testing and real Google access are not part of these tests.
The supplied private reference image could not be downloaded by the Library
materialization helper in this execution environment; it was not visually
verified or attached here. Release approval and physical-device verification
remain separate steps before publication. The 1.2.38 bundle, HTML references,
CSS cache key and service-worker static cache version are prepared together.
The published 1.2.37 bundle is preserved; this draft does not publish or deploy.

Release validation: `node tests/money-release-browser.cjs` verifies HTML, bundle,
CSS and worker version consistency plus a fresh 1.2.38 offline reload with
unchanged synthetic ledger/history/localStorage. External requests are blocked;
loss of the local HTTP server is simulated at its socket.

The offline status observer now refreshes on `controllerchange`, rather than
messaging the old active worker for each installing-worker state change. It
neither reloads pages nor forces worker activation. The worker itself, storage,
authentication and finance synchronization are unchanged by this follow-up.

The release test awaits actual worker replies in a host-side polling loop.
In this environment Playwright 1.62.1 `waitForFunction(async () => false)` returned
false immediately, so the previous async predicates did not wait correctly.
The new gate requires the expected version/core, an activated controller equal
to registration.active, no installing/waiting worker, and unchanged controller
identity across the reply. It repeats this after online/offline reload.

**Publication remains blocked by legacy-tab activation.** Run
`MONEY_PREVIOUS_ROOT=/path/to/unmodified-main-archive node tests/money-release-browser.cjs`
with an archive of `f27fb936535ead0efa2af3ff40d61c8581940d96`. The test verifies the
old HTML, bundle, offline controller source and worker byte-for-byte against that
commit. It retains the old tab while opening the candidate in a second tab,
checks synthetic ledger history and localStorage, and requires the new controller
before testing offline use. The unmodified-old-tab scenario still times out
with old controller/active activated and new worker waiting/installed, including
with a delayed static response. The new page displays 1.2.38 online, but this is
not proof that its offline controller has upgraded. Changes to the candidate
cannot remove the already running observer from a legacy tab.

The fresh 1.2.38 online/offline test passes. Earlier experiments modifying both
old and new bundles passed but are not evidence for this legacy transition.
Closing all synthetic old tabs and reopening also worked in diagnosis, without
clearing data; no automatic tab closure or forced activation is implemented.
Choose and validate a legacy-tab transition strategy before publication. Worker
changes, force-update behavior and data deletion are outside this change.
