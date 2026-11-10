# ナミ第2段階：既存予定の実績・消込と旧予定の撤回（1.2.48、1.2.49補足）

公開版の仕様と架空試験結果。本番への書込み、権限変更、公開を許可する文書ではない。
1.2.47の未公開「前月以前の未消込」作業は含めない。基準mainはd12f13c。

## 何を変えるか

`scripts/operate-money-ledger.cjs` はネットワークを使わない。planで変更前後、既存recordId、全履歴のID/ハッシュ、対象head、本人・台帳IDを固定し、prepareで承認照合後のRAW追記行を作る。実行担当が既存コネクタで追記し、verifyで全体読戻しを確認する。CLI単体では台帳に保存されない。

- `changes.corrections`: title / plannedDate / plannedAmount / subjectMonth / note の明示した差分のみ。
- `changes.actual`: date / amount / account:{label,reference} / evidence:{status,note,ref?}。日付・整数額・実口座・根拠は必須。accountは口座の識別用名称と末尾等の参照で、秘密値や完全な口座番号を渡さない。予定額・予定日・予定口座の備考を自動で実績へ転用しない。
- `changes.actualEdit`: id / before（実績の全文） / changes（date,amount,account,evidenceだけ）。既存実績IDと元の履歴を保持する。追加と訂正は同時に指定しない。
- `changes.settle:true`: 実績追加・必要な訂正と同一改訂にできる。全実績の日付・額・口座・根拠が確認済みでなければ止まる。1.2.49では対象月だけ不明の場合、classificationPendingReasonを明記してnullを保持し分類保留にできる。予定額との差を自動で残額・割引・不足と解釈しない。部分実績の場合はsettleを指定しない。消込取消や家賃正本の更新は範囲外。
- `changes.withdrawal`: reason / replacementRecordId / replacementActualId。実績のない未消込予定だけを単独操作で撤回する。代替は同区分・readyの正式実績付き既存記録。自己参照、実績不明、競合、撤回済みへの参照は禁止。同じ支払なら、まず同一IDへの実績反映を優先する。

撤回はaction=withdrawとして履歴を追加し、元の予定額・日付・done=false・actuals=[]を維持する。新規の金融記録は作らない。旧履歴削除・0円化・done=trueによる偽装はしない。撤回一覧は全期間・入出金フィルター付きで別枠表示する。月内合計、未消込累計、ホーム・カレンダーの金融表示から除外する。代替記録が後に競合すると撤回側も未確認になり、正常な撤回として隠さない。今回の版では撤回解除は提供しない。旧端末の編集と競合した場合は、既存の「同時編集を確認」で撤回側の完全なvalueを選び、理由付きで統合できる。撤回を復活させる統合や、承認なしの新しい撤回情報の生成は拒否する。

## 運用開始の必須条件

1. 公開承認と配布後、Flip/Foldの両実機を対応版へ更新する。一括操作は1.2.49以降が必要（[一括手順](nami-batch.md)）。
2. 両端末の未送信編集を同期し、同じ全履歴checkpointを確認する。未送信の有無はCLIでは証明できない。
3. 入力の `readerCheckpoint` と `compatibleReaders`（2件、それぞれdeviceId/capability='money-stage2-v1'/checkedAt/checkpoint）に、その確認結果を記録する。deviceIdは台帳比較に存在するもの。この値は担当の確認記録であり、自動端末認証や暗号署名ではない。実際に確認していない値を作らない。
4. 本人承認、台帳の非共有・所有者・対象IDを既存コネクタで確認する。OAuth・共有を広げない。

旧1.2.46はwithdrawを解釈せず、その記録を未確認として隔離し集計対象外にする（試験済み）。ただし、同期前の古い画面は書き換えられない。旧版での継続運用は保証しない。対応版更新を実施しないまま撤回を送らない。台帳の設定version変更・破壊的移行は不要。

## 実行手順（公開と個別承認の後）

1. 既存check-money-ledgerと同じ入力に全設定・履歴・比較・照合表示を最後まで読み、独立した2回目をsecondReadへ設定する。実際の口座・家賃対象月・根拠を別途照合。不明は保留。
2. 固定operationId/at/recordId/changesと端末確認を加え、`node scripts/operate-money-ledger.cjs plan private-input.json`。出力を非公開に保存する。
3. 本人が変更前後・実績・口座・対象月・消込/撤回を確認した承認を、planHash/owner/ledgerId/recordId/operationId/at/noteで入力へ結び付ける。実績の報告だけで撤回の承認を推測しない。
4. 書込み直前に再び全体を2回読み、`prepare latest-input.json plan.json`。元の全履歴checkpointが違えば止まる。取消なら行を生成しない。対象の競合・未確認・家賃正本は更新しない。
5. prepared-not-writtenの1行だけを既存コネクタで入出金履歴へRAW追記。既存セル・並び・別表・家賃正本は変更しない。
6. 全体を2回読戻し、`verify reread.json plan.json`。元履歴、対象外履歴、対象の承認後全文、head、競合/隔離を照合する。他の追記でも成功判定を保留する。
7. 結果不明は最初に読取り。新しいoperationIdやactualIdを作らない。原計画のverifyで確認済みならprepareはalready/append:nullとなる。未検出でも結果不明のまま自動再送しない。保存前失敗が確定し再送許可がある場合のみ同じ行・IDを使う。
8. 各端末の同期・照合ID・対象表示確認を台帳保存と分けて報告。新しい派生表の広範な更新は行わない。

Sheetsにはこの処理で使用する台帳全体の原子的compare-and-swapがない。直前確認と追記の間の並行編集は防げず、枝として保持し読戻し時に競合として止める。編集時間を区切り、完全な排他保証とは説明しない。

## 試験と制約

`node --test tests/*.test.cjs`、`node tests/money-stage2-browser.cjs`、`node tests/money-list-browser.cjs`、`node tests/money-sync-browser.cjs`、`node scripts/build-bundle.cjs`。
追加の合成試験は同一IDの実績+消込、部分実績、明示訂正、実績ID保持、承認不一致、取消、古いhead、直前/追記後の競合、結果不明/同一操作読戻し、重複防止、対象外履歴変化、撤回リンク、集計、旧パーサー隔離。
画面は外部通信遮断、280/320/360/390/822 CSS px、44px操作領域、履歴開閉、編集・消込取消のキャンセル、再読込、保存内容不変を確認。

既存Google Driveコネクタによる非公開架空台帳の実績・撤回追記、2回全体読戻し、再実行追記0は検証済み。実金融データ・実Android・担当間ファイル受渡しは未試験。両端末の対応版・同期確認が運用開始前に必要。
ロールバック：コード公開だけでは本番台帳は変わらない。withdraw追記後に旧版へ戻して通常運用しない。履歴は消さず、対応版の前進修正を行う。端末更新・公開・本番操作は別途判断する。

独立レビューで修正：隔離後の撤回参照状態の伝播、無効な撤回による対応キー競合の解除防止、旧端末との競合を撤回のまま明示統合する経路、口座不明の旧実績との訂正重複防止。反例を回帰テストに追加。
