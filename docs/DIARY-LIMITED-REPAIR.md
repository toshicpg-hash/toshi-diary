# 限定日記修復 — コピー検証候補（実運用未対応）

この変更は `diary-core.js` の14項目canonical、通常mergeの同ID不一致停止、IndexedDBのappend-only、Google同期、認証、権限を変更しない。配信bundleにも追加しない。実装は純粋なコピー変換APIとローカル専用UI。実Google/端末を修復したという意味ではない。mainへmerge・公開・実データ切替は別承認が必要。

## なぜGoogleだけ直しても足りないか

同revisionIdに異なる原本が複数端末で保存済みなら、Googleを初版に戻しても別端末の更新版と衝突する。現行追加復元も同じ理由で停止する。今回のコピーを通常restoreへ渡すことは禁止。通常の保護を緩めて受け入れる変更もしない。

## コピー内の修復方式

本人が非公開manifestで対象を正確に2IDへ限定する。各対象のvariantは原初から最新版への**本人が確認した順序**で全14項目を並べ、新しく予約したreplacementIdsを全中間版・最新版に割り当てる。時計で勝者を決めない。

原初版は元ID・元項目のまま残す。後続variantは同entryId、直前の新履歴をparentに持つ新IDへ明示的に変換する。本文・人物・日時・source・deviceId等は変えない。修復由来は別archiveのmappingで示す。原本の元ID・元parentsを含む全項目、全スナップショット、manifest、対応表をarchiveに重複保全する。対応表を失うと元の同ID複数原本へ戻せないので、コピー単体は完全な修復成果物ではない。

合成fixtureでは共通86件、端末1=A0/Bなし+古いdraft、端末2=A1/B0、Google=A1/B4を再現。B1〜B3もmanifestに保持する。3コピーとも同じ93履歴となり、headsはA1/B4。86件はcanonicalだけでなくオブジェクト値も不変。各スナップショットのrevisions以外はそのまま複製する。原本ファイルや実保存領域には一切書かない。

制限：対象は別entryのroot revisionかつ既存の対象外履歴に同entryや子がない場合のみ。対象parent・既存子・重複ID・循環・別entry parent・欠落parent・未知variant・対象外差分・未登録ソースは停止する。この条件に実データが合わなければ範囲を拡大せず再設計する。端末在庫の完全性や中間原本の完全性はコードから推測できず、本人が証拠で確認する。

## private manifestとpure API

private入力・出力・バックアップは**リポジトリ外**の非公開作業領域に置く。公開コミット、PR本文、ログ、スクリーンショットへ実ID・本文を含めない。公開のfixtureは架空専用。

`require('./diary-repair.js')` は以下をexportする。ブラウザでは `ToshiDiaryRepair`。

- `await dryRun(manifest, current)`：I/Oなし。planId(SHA-256)、原本archive、各保存元の修復コピー、件数、未反映ステータスを返す。
- `await executeCopies(manifest, current, {backupReadback, confirmedPlanId})`：新たにdry-runを行い、独立保存後に再読込したarchive全体との完全一致と計画IDの明示確認を必須としてコピーを返す。実ストア操作はしない。
- `await digest(json)`：JSONのオブジェクトキー順を安定化したSHA-256。署名・本人認証ではない。
- `await lintAppend(before, proposed, {expectedBefore})`、`verifyAppendReadback(expected, actual)`：外部書込み前後のpure validator。

manifest形式（値は非公開で作成）：

```js
{
  format: 'papa-diary-private-repair-v1',
  repairId: 'locally_reserved_repair_id',
  targets: [
    {revisionId, variants: [original, intermediate, latest], replacementIds: [newId1, newId2]},
    {revisionId: otherId, variants: [otherOriginal, otherLatest], replacementIds: [newId3]}
  ],
  baseline: [/* 全保存元に共通の対象外履歴 */],
  sources: [
    {name: 'device_one', kind: 'device', snapshot: {/* revisions, meta, draft等 */}},
    {name: 'device_two', kind: 'device', snapshot: {/* 同上 */}},
    {name: 'google_copy', kind: 'google', snapshot: {/* revisions, headers等 */}}
  ]
}
```

Googleは1保存元、端末は2以上。`current` はsources.nameをキーとする、今回独立して読み取ったスナップショットのobject。manifestのsnapshotと全JSON値を照合する。行は正確な14キー、parentsはソート済み・重複なしのcanonical形が必要。Sheetsのraw行や元backupファイル自体も別に保存すること（このAPIはJSON値を保全し、ファイルの改行・BOM等のbytesを保全するものではない）。`C.fromRows`による変換だけでは余分な列が落ちるので、raw列数/ヘッダーも別途照合してから変換する。

```js
const fs = require('node:fs');
const R = require('/path/to/checkout/diary-repair.js');
// 以下は親の非公開環境だけで実行。実データのパスや内容を公開しない。
const manifest = JSON.parse(fs.readFileSync(privateManifestPath, 'utf8'));
const current = JSON.parse(fs.readFileSync(privateSnapshotPath, 'utf8'));
const plan = await R.dryRun(manifest, current);
// plan/archive/copiesは個人情報を含む。ログへ出さない。
// archiveを新規非公開ファイルへ保存し、独立して読み直す。
const backupReadback = JSON.parse(fs.readFileSync(privateArchivePath, 'utf8'));
const result = await R.executeCopies(manifest, current, {
  backupReadback, confirmedPlanId: ownerReviewedPlanId
});
```

全出力の上書き保存は避ける。親のコピー検証では私有の新規パスへ`flag: 'wx', mode: 0o600`等で保存し、別途読戻す。実機からの採取と原本bytesのバックアップ検証はこのAPI外で行う。

ローカルUIはcheckoutを `python3 -m http.server 8765 --bind 127.0.0.1` で配信し `http://127.0.0.1:8765/tools/diary-repair/` を開く。privateファイルを配信ディレクトリへ置かず、file pickerで選択する。外部通信はCSP `connect-src 'none'`、Google認証やlocalStorage/IndexedDBのコードなし。dry-run→archive保存→保存ファイルの再選択→内容確認→計画ID入力→コピー生成。入力変更・中止は計画と確認を破棄する。リロードは最初から同じファイルを読み直せばよい。

## 部分失敗・中止・再試行

コピー生成は外部副作用なしで決定的。同じ入力は同じplanId/出力になる。ファイル保存の成否が不明ならファイルを読戻して検証し、失敗した出力は採用しない。archiveが失われた、異なる、壊れた場合は生成を拒否する。中止しても元入力は残る。入力が変わったら新しいmanifest確認・backup readback・plan確認が必要。コピー生成の成功をGoogle保存や実機反映として扱わない。

## 実運用への具体的障害と本人承認後の順序案

**この候補には実機切替adapterがない。承認だけでは実行可能にならない。** Sheetsのread→writeには原子的なCASがなく、既存端末は同ID差分の置換を拒否する。旧端末を完全に停止させず、既存Google台帳を上書きする実装は安全と判断できない。

実運用は次の追加設計・実装・テストと、完成差分の本人承認後に限る：

1. 全端末・全外部書込み者を棚卸しし、旧台帳の書込み・同期を停止。新規変更がないことを各完全スナップショットで再検証。取り残された端末があれば停止。
2. 全原本・中間版・draft・端末meta・接続情報を非公開の独立媒体へ保存して読戻す。このAPIでコピーを検証する。
3. 既存台帳・DBを凍結したまま残し、修復専用archiveと**新しい隔離された日記台帳/DB世代**へコピーを準備する。旧接続先を再利用しない。世代識別・repairId・planIdに結び付いたprepare/verify/activateの永続ジャーナルと、再開時の全状態再検証が必要。
4. Google側は新世代の全履歴とarchiveを読戻してから「Google保存済み」。要求結果不明時はID指定読取りで照合し、blind retry禁止。複数候補/不一致なら停止。Google準備だけで端末を自動切替しない。
5. 各端末は旧DBを残し、新DBと自端末のdraft/metaを読戻してから同じ世代へ切替。接続先とactive世代pointerの切替を原子的に扱うadapterが必要。中止・部分準備中は旧世代を凍結したまま保持し、新旧混在同期を禁止。
6. 全端末で履歴と最新版・古いdraftの保持を本人が実画面確認して、端末ごとの「本人端末反映確認済み」を別記録する。その後のみ新世代で編集を再開。

旧版端末は新世代を自動認識しない。旧接続のままにして新世代へ混ぜない。旧版で新コピーをmergeするとA1等の同ID差分で停止する（回帰テスト済み）。未確認端末は同期再開を禁止し、その原本を新manifestで照合する。旧台帳へ後日書込まれた履歴を自動取込しない。権限・認証の変更や他同期を本PRに混ぜない。上記の世代切替・隔離を安全に実装できるまでは、実運用は保留。

## 検証

`node --test tests/*.test.cjs`、`node tests/diary-repair-browser.cjs`、`node scripts/build-bundle.cjs`。合成fixtureのみ。新APIはproduction source listに加えないため、既存48ソースbundleは変更なしで一致する。

この候補の実行結果：Node 161件成功（既存125件＋限定修復36件）。限定修復UIブラウザ1本、既存ブラウザ10本（calendar-navigation / combined-sync / completion / completion-reconcile / deadline / google-account / money-card / money-list / money-release / money-sync）成功。bundle一致。ブラウザはChromium・合成API応答で、実Google送信/実機/旧版からのoptional upgradeモードは未検証。実データを要求する `check-money-ledger.cjs` はusage確認のみで、実台帳検証には使っていない。

初回の新規試験ではfixtureの共有object参照により意図した片側変更が両側へ波及して6件失敗したため、fixtureを独立したJSONコピーに修正した。UI試験の非同期エラーメッセージ待ち不足1件も待機を修正し、最終実行で成功。通常同期の保護条件を緩める変更はしていない。
