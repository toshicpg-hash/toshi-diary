# Money history reader 1.2.60

Malformed rows are kept verbatim and identified as requiring recovery instead of crashing the whole read with a generic JSON error. Quarantine stops cloud writes and financial editing; no version or fingerprint is inferred. Read-only retries preserve pending local history.

A recovery envelope can link exact preserved originals to reviewed replacement histories. The reader validates the envelope and child fingerprints, original raw hashes, baseline parent revisions, constrained values and reader evidence. Only an exact mapping changes the active projection. Original rows remain in storage and backup. Unexpected variants/branches remain blocked. Subject-month uncertainty is explicit.

Public `HubMoneyRecovery` exports only FORMAT, inspect and auditEvents. Planning, recovery execution, connection adapters, operational inventories and real data are not distributed. Updating the application does not repair or write financial records. Normal existing sync/edit features remain subject to their existing guards.

Publication is separate from a reviewed data operation. Close old application tabs normally after preserving local changes, then reopen online after the new worker activates. Do not clear site data. An open old application remains old even when a new cache exists. Old readers cannot validate the new signed recovery metadata; after a recovery envelope has been written, reverting to an old reader gives a blocked state, not normal operation. Never restore an old whole-table snapshot or delete originals as rollback.

Verification uses synthetic data only: Node regression suite, real bundle/IndexedDB browser tests for six malformed rows and linked recovery histories, zero unexpected HTTP writes, backup/restore and later edits, narrow/wide layouts, and unchanged 1.2.58 to new-version worker update with normal/delayed online/offline storage preservation. No test demonstrates real-device recovery or bank reconciliation.
