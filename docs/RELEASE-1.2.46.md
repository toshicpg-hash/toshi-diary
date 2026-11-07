# PAPA HUB 1.2.46 — local review candidate

Based on main `545f60d29017a98becd4ff400fc51958e9823f28` (1.2.45). Calendar entry opens the week containing Japan today. In-calendar browsing, ordinary redraw and sync retain the viewed date. No sync optimization, Nami edit tooling, auth or data changes are included. No push, PR, merge or deployment was performed.

The published `hub-app-1.2.45.js` is byte-identical to main: SHA-256 `12a0583e63e22277f018a5d76c305b6230c143726884080f8617a3d6566ec33c`. The new bundle, index badge and references, build target, worker VERSION/CORE and `papa-hub-static-1.2.46` cache agree. Worker install/activation behavior is unchanged.

Validation:
- `node --test tests/*.test.cjs`: 216 passed.
- `NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules PAPA_CALENDAR_ARTIFACTS=/workspace/scratch node tests/calendar-navigation-browser.cjs`: 12 scenarios passed, synthetic only.
- `node scripts/build-bundle.cjs` and `git diff --check`: passed.
- Export exact main with `git archive 545f60d29017a98becd4ff400fc51958e9823f28` into a separate baseline directory, then run `MONEY_PREVIOUS_ROOT=<baseline> MONEY_PREVIOUS_COMMIT=545f60d29017a98becd4ff400fc51958e9823f28 MONEY_RELEASE_LOG=<result.json> node tests/money-release-browser.cjs`. Passed normally and with `MONEY_RELEASE_DELAY=1500` (candidate icon response delayed).
- Both upgrade tests verify immutable baseline files, old tab retained, new activated controller, all origin tabs closed normally, online reopening/reload, offline reload, cache bytes, money history, diary history/draft and localStorage preservation, and offline calendar entry on Japan today's week.

An initial added test incorrectly expected the new worker to remain waiting. It timed out because the existing worker already uses skipWaiting/clients.claim. The test was corrected to inspect actual activation while retaining the old page; no worker behavior was changed. An old page can retain the old UI even with a new controller. Release instructions remain: close all HUB tabs/PWA windows normally and reopen online in the same browser/profile. Do not clear site data, unregister workers or reinstall.

Before publication: review the final diff and obtain authorization for external actions. Recheck main/version collisions, then verify served index/bundle/worker and immutable old asset after approved publication. Actual Fold/Flip hardware, actual Google OAuth/sync and deployed delivery are untested for this candidate.
