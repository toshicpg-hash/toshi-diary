# Device recovery — 1.2.53

Source: AI連絡箱 row319, number289, 2026-11-11 10:41, クロ→コーディ. Authority is the owner's direct request passed through the parent, not the spreadsheet approval column.

## Decisions

- Immutable per-device manifests and content-addressed objects; no replacement of old backups. A reduced asset-ID inventory stops a new backup, even when total counts happen to match.
- Explicit owner-only Drive metadata verification. Existing drive.file only. No new grants are requested by the protocol; actual authorization is outside this development task.
- Allowlisted manifest fields exclude tokens, old device IDs, diary bodies and finance histories. Account owner is verified independently. Local send consents are not copied.
- Collection and recovery use separate APIs. Recovery never calls ordinary bidirectional sync: calendar/diary/money must each use read-only Google reads plus local append/readback. Partial success stays incomplete.
- Nonempty destination is preserved in a separate local archive and automatic restore stops for reconciliation. This conservative exception prevents loss of edits; it is not a promise of one-click merging.
- Restore to a fresh device gets fresh identifiers; display name may match the previous device. Samples and migration markers must not be rewritten by restoration.
- First backup failure does not change the financial/calendar sync outcome. The status must separately say backup incomplete; a missing backup cannot restore past unsent edits or lost images.
- Google list and preview must be read-only. Only explicit backup can create a private folder or files. Failed writes retain a fixed reserved Drive ID; uncertain outcomes must be read back, never retried with a new ID.
- Binary assets are uploaded individually without base64 multipart JSON. Browser adapter must enforce bounded memory and journal progress before use. Immutable object hashing does not prove completeness of an inventory.

## Current status

Protocol, private Drive adapter, separate local staging, native Blob inventory, empty-device recovery UI, read-only diary/money reconnection and sync-success backup hook are implemented. An explicit local checkbox enables post-sync backups; failure is reported separately from normal sync. The checkbox and old device identifiers are not restored. Backups refuse unresolved local-only calendar edits, diary drafts/pending revisions, or money checkpoint mismatches rather than falsely claiming completeness.

Synthetic protocol/transport tests cover identity/privacy, reduced inventory, malformed manifests, corrupted objects, cancellation/confirmation, local changes, nonempty destination, partial cloud readback, and unknown upload results. Chromium tests use real isolated IndexedDB to restore a synthetic Blob receipt, verify preservation, and check the diary recovery API issues GETs only; cloud stages are mocked. Narrow 320px and wide 822px layouts are checked. No real grant, Drive upload, lost-device restoration or measured phone performance has been tested.

Remaining limits: a single asset above64MiB stops backup; the first backup can be slow and requires space. Nonempty destinations stop after archival for reconciliation. A matching persisted restore journal permits resuming verified local stages, but changes or an uncertain stage stop rather than guess. No existing snapshot is retroactively created for the already-lost data. Google login and selecting the correct device snapshot remain explicit steps. Site-data erasure removes local progress too; Drive backups remain separate.

The1.2.53 bundle/cache references are aligned, while the previously published1.2.52 bundle remains unchanged. Actual account connection and restoration testing require explicit authorization.

Development/testing did not modify any existing Drive backup or device. The current loss cannot be repaired retroactively by newly implemented backups. Existing cloud ledgers and preserved files remain the sources for the current recovery.

## Prevention wording

Deleting Chrome browsing history and deleting cookies/site data are different operations. Site data deletion may remove HUB local records and settings. Keep cookies/site data out of a history-only deletion. A persistence request cannot protect against explicit user deletion; no persistence permission is changed here. The exact deletion options used on the affected device have not been independently observed.

## Additional verification (2026-11-11, synthetic only)

- `node tests/device-recovery-upgrade.cjs`: unmodified published1.2.52 at aaa704af5df979997981139adff607407c958403 → candidate1.2.53. Normal and800ms worker-response delay. Old live tab keeps1.2.52 controller; after all tabs close normally, online reopen activates1.2.53 and offline reload works. Money history, Blob receipt and localStorage sentinel remain exact. No unregister, cache deletion or forced activation.
- `RECOVERY_ASSET_BYTES=16777216 node tests/device-recovery-browser.cjs` and `RECOVERY_ASSET_BYTES=67108864 node tests/device-recovery-browser.cjs`:16MiB and64MiB synthetic receipt restoration through real isolated Chromium IndexedDB succeeds. This is not a phone memory/latency measurement, nor a large multi-file Drive upload test.
- Transport mocks reject64MiB+1 remote metadata before fetching the body, reject HTTP429 without retrying, and reject expired grants before network access. These complement prior privacy, uncertain-create and read-only-list tests.
- Existing connected Drive metadata reads succeeded for the established ledgers and folder. Connector authorization is different from the app's browser OAuth grant; it does not verify app Drive uploads or restoration permissions.
- Real app Google connection/upload remains untested. It requires an explicitly approved existing-account browser session and an isolated private test destination, with synthetic files only, kept separate from real Fold8/Flip8 backups. No such session was opened and no folder/file was created. Expected risks to check: consent cancellation, missing drive.file visibility, quota/permission failure and unknown upload outcomes. No additional scopes should be granted implicitly.

Publication review also pins the local snapshot before upload and before final confirmation: concurrent local edits prevent claiming a complete backup. The owner authorized publication; actual device restoration is a separate operation.
