# Fold専用：元ID1件のローカル修復候補

未公開の候補コード。実Google書込み、PR作成、push、merge、公開、実端末操作は行っていない。Flipは対象外。既存の93履歴コピー計画とは異なり、入力された新しい94履歴の正確なID/canonicalを使う。

## 採用方式と変更範囲

Googleをreadonly通信する案は、端末での追加認証・接続先確認・取得失敗対応を必要とする。今回は親が確認した**署名なしhash-bound snapshotをファイル入力**する最小構成を採用した。Googleへのfetch、トークン、書込みAPIはない。hashは内容の結び付けであり署名/認証/鮮度保証ではない。親は実行直前にGoogle側が依然このsnapshotと一致することとwriter停止を確認し、不一致ならこのmanifestを使わない。

対象はFoldの既存88履歴に含まれる元ID AのA1→A0置換1件。94履歴snapshotに含まれる新ID A1、B1〜B5の不足6履歴を追加する。その他87履歴（共通86＋B0）は完全不変。A1原本の全14項目、旧ID→新ID対応、全before履歴、実行時の全live metaをrepair archiveへ残す。元A1の項目が新ID A1で完全保持されていることも検証する。通常mergeの保護を緩めない。

`diary-local-repair.js` と `tools/diary-local-repair/` は独立した専用経路。通常アプリへの変更は `diary-store.js` のDB version 2対応、修復readback待ちの書込み停止、予約されたrepair metaの通常更新禁止、versionchange後の再読込要求のみ。通常commitの同ID不一致拒否とappend-onlyは維持。

source変更から既存ビルド規則でローカル `hub-app-1.2.42.js` を再生成して一致を確認するが、これは**未公開候補**であり、既存公開1.2.42と同じbytesではない。公開時には新しいrelease番号/asset URLと対応する読み込み設定を用意し、キャッシュ上の旧版と混同しないリリース確認が別途必要。現在の公開画面に専用ボタンがあるとは案内しない。

## private入力とpure API

入力は全てリポジトリ外に置く。実ID・本文・meta・backupをPR/commit/ログへ出さない。日記backupは元の `toshi-hub-diary` schemaVersion 1、revisions 88件、draft、任意exportedAtだけ。backupからdeviceId、sheet、ack等を推測しない。

```js
const L = require('/checkout/diary-local-repair.js');
const H = require('/checkout/diary-repair.js');
// 実値はprivate環境で作成。元93履歴plan/IDを流用しない。
const google = {format: 'fold-google-snapshot-v1', revisions: verifiedGoogle94};
const manifest = {
  format: 'fold-local-restore-v1', repairId: privateRepairId,
  sourceOrigin: exactPublishedOrigin, database: 'toshi_diary_v1',
  beforeHistoryHash: await L.historyHash(savedFoldBackup.revisions),
  afterHistoryHash: await L.historyHash(google.revisions),
  googleSnapshotHash: await H.digest(google),
  backupHash: await H.digest(savedFoldBackup),
  target: {before: originalA1WithOldId, after: originalA0WithOldId,
           remappedRevisionId: actualNewA1Id},
  secondEntryId: actualBEntryId,
  additionIds: exactSixMissingIds
};
const plan = await L.prepare(manifest, google, savedFoldBackup,
  {revisions: observedLocalRows, meta: observedLiveMeta},
  {sourceOrigin: exactPublishedOrigin});
```

履歴hashはID順に並べ、recordの値は変えない。Google file/backup hashはJSON値全体（配列順を含む）。extra keys・非canonical record・重複ID・parent異常・元variant差・他87履歴の差・古いreplacement ID・88/94以外・6追加以外を拒否する。Googleの追加はA1とB0→B1→…→B5の鎖に限定する。

live metaは専用画面でその場で読み、planIdへ結び付ける。backupのdraftと一致しない場合は停止。metaの未知JSON項目はそのまま保存する。非JSON型を勝手に変換せず拒否する。draftが置換対象Aの旧IDをbase/parentに持つ場合は意味が曖昧になるため停止し、原文を保持した別確認が必要。

`L.prepare` はI/Oなし。`L.classify(plan,current)` はbefore/applied/verifiedだけを許し、それ以外を拒否。`L.expectedState(plan,phase)` は合成検証用。`L.createAdapter({indexedDB, locks, assertSolo, sourceOrigin})` は依存注入できるadapterで、既定DB名は固定。

- `read()`：既存DBを読取る。無ければ作成をabort。未知version/schemaも停止。
- `inspect(manifest, google, backup)`：他画面検査→live読取り→pure plan。
- `apply(manifest, google, backup, {backupReadback, confirmedPlanId, stoppedWriters, signal, onBlocked})`：archive再読込と計画ID確認後に限定transaction→再open/readback→verified receipt→再readback。

## 永続性・並行タブ・旧版の排除

DB名は変えず、最初の修復は `indexedDB.open('toshi_diary_v1', 2)` のversionchange transactionで実施する。既存object storesはrevisions/metaの2つだけでschemaは変えない。transaction内で全88履歴と全metaを再読取りし、準備時と完全一致した場合だけ次を行う。

1. `meta.limitedRepairArchive` に原本・liveBefore・入力・対応表をadd。
2. `meta.limitedRepairJournal` にplanId/repairId/phase=`applied`をadd。
3. 対象Aだけput、新6履歴だけadd。

全部がcommitするか全部がabortする。失敗時はDB versionも1に戻る。既存metaキー（draft/deviceId/sheet/remote ack等）へのputはない。archive/journalの予約キーが未知状態で既存なら停止。transaction内にネットワーク・digest awaitを挟まない。

専用service workerはrepairディレクトリscopeのみで、fetch interception/cache/data保存なし。`clients.matchAll(includeUncontrolled:true)` で同一originの他windowがあれば停止する。Web Locksはrepair同士の二重実行防止。**それだけで旧writerを排除したとは扱わない**。versionchangeがDB接続を排出し、古い明示version 1のクライアントは修復後にVersionErrorとなる。対応storeもversionchangeで開いていたinstanceを無効化し、古い編集状態での再接続を拒否する。別接続でupgradeがblockedになれば、後からその接続が閉じても遅れて修復を実行せずabortする。

既存の外部Google writer、別origin、既に送信済みの通信はこの機構では止められない。本人/親が停止・結果確認してから実行する。実行前は旧HUBの全タブ/PWAを閉じ、保存/同期が進行中なら先に完了を確認する。未保存フォームは捨てず保存または退避する。

commit後はDBを閉じて再openし、94履歴・archive・全metaを照合してから別transactionでjournalをverifiedへする。applied中は対応版の通常state/commitが停止する。verified後の通常commitも同ID不一致は拒否する。verified記録を通常metadata更新で書換えられない。

close→reopen readbackを行うが、ブラウザ/OSの物理ディスクfsyncや永久保持を証明するものではない。archiveの独立保存・親側の元原本保全を必須とする。ブラウザ容量不足・eviction・機器故障に備え、日記revisions/draftだけの通常backupとは別にrepair archiveを保管する。

## 失敗・結果不明・中止

- commit前の不一致/abort：元88履歴とmetaのまま。原因を確認して同じ入力で再照合。
- commit後にタブ終了/中止/readback失敗：archiveとapplied journalを残す。対応通常画面は停止。同じmanifest/snapshot/backupと保存archiveで再開し、94履歴を読戻してverifiedにする。
- verified後の再実行：exact after/receipt一致ならno-op。重複6履歴を追加しない。
- 途中でdraft/meta/履歴が変わった：元planでは停止。変更を上書きしない。
- 元A1に自動rollbackする操作はない。元14項目はarchiveから完全取得できるが、追加履歴を捨てて旧状態へ戻さない。異常時はarchiveと全現状態を保全して別判断。
- Googleの現在値は取得しない。`googleSnapshotMatched:true` と `googleLiveChecked:false` を分ける。`localProcessed:true` でも `ownerScreenConfirmed:false`。

## 親側のコピー検証harness

```sh
node scripts/check-fold-local-copy.cjs --synthetic
node scripts/check-fold-local-copy.cjs /absolute/private/fold-input.json
```

private input形は `{manifest, google, backup, live:{revisions,meta}}`。live metaが未取得なら合成metaでの試験はできるが、それを本人端末meta検証と扱わない。harnessは新規isolated Chromium contextの架空originにDBをseedし、adapter・再試行・通常mergeを検証して閉じる。既存ユーザープロファイルを開かず、外部requestは遮断。入力はcheckout外の絶対パスのみ。stdoutは件数とboolだけ、失敗時は個人情報を出さない固定メッセージ。これは実機確認ではない。

## 本人Foldの手順（公開承認・対応版配信後のみ）

**今の公開appにはこの専用画面は未導入で、まだ押せない。** 親は先に対応store＋専用ページの公開承認を取り、新releaseの配信とキャッシュ更新を確認する。DB version 2へ進めた後で旧公開版へ戻しても日記は開けないため、互換版を先に配信する。通常の他データを消す再インストールやストレージ初期化は禁止。

1. 親が新manifest JSON、Google94 snapshot JSON、このFoldの元88履歴backup JSONをprivateに渡す。Google現状態/外部writer停止も親が再確認。Flipには何もしない。
2. Foldの同じブラウザ・同じprofile・同じsite originで専用ページ `tools/diary-local-repair/index.html` を開く。他のHUBタブ/PWAを全て閉じる。incognitoや別ブラウザでは元DBを読めず停止する。
3. 3ファイルを選び「端末を読取り照合（まだ修復しません）」を押す。88→94、置換1、追加6、その他87不変が表示される。違えば止めて親へ件数/エラーだけを知らせる。
4. 「原本・現在のmetaを含むarchiveを保存」を押す。保存できたprivateファイルを「保存したarchiveをもう一度選択」で再選択する。元の独立archiveも残す。
5. 表示された計画IDを入力。停止確認と対象差分確認の2つにチェックし、「このFoldの1件だけを修復」を押す。
6. **「端末処理済み・再読込照合済み（94履歴）」** を確認する。途中で閉じた/不明なら同じファイルで最初から読取り照合し、同じ保存archiveで再開する。
7. 専用画面を閉じ、対応版の通常HUBを開き直す。最新版B5、A1、履歴、draftを本人が確認して親へ報告。その後に通常同期してエラーなしを確認する。Google保存済み・Fold処理済み・本人画面確認済みは別々に記録する。

## 検証の範囲

Nodeの新94履歴fixtureでは古い93計画と異なる新IDを使用。元variant/他履歴/draft/hash/origin差、namespace衝突、重複、draft曖昧baseを拒否する。

Chromiumの合成IndexedDBでatomic修復、transaction abortとversion rollback、meta競合、blocked他接続、commit後中断と実tab終了、applied中の通常保存拒否、再試行no-op、旧version 1拒否、対応storeの古いinstance無効化、通常merge/immutable保護、実service workerの他window検出とUI確認操作を試験する。実Android Foldの挙動・実Google現在値・本人画面反映は未検証。
