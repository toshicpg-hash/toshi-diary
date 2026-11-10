# お金の端末内処理改善（1.2.52）

AI連絡箱の11/11 8:14、クロ経由のエジソン提案（番号280、同番号の別報告と区別）のE/F/Gに対応。基準mainは1.2.51、12eaf9f6c5deb2c890ec2c654e9a1321d3628a1d。実データ・認証・権限は変更しない。C（最新照合表示への置換）とD（履歴read回数削減）は含まない。

## 実装と安全条件

- E：SHA-256の成功結果のみ、入力の正確な文字列をキーに再利用。オブジェクトは毎回canonical化し、verifyの構造検査・fingerprint比較・子履歴検査は省かない。上限4096項目・キー合計4Mi文字（UTF-16の本文約8MiB＋オーバーヘッド）。大きすぎる入力と失敗結果は保持しない。永続化しない。
- F：履歴appendは以前から同じIDと内容の行を再addしていなかったので変更しない。saveSampleは全DBのrawではなく対象IDを読み、既存値との完全一致を確認。検証済みの同一内容のみunpackを再利用する（最大32項目・合計2Mi文字、単体1Mi文字以下）。新規は従来どおりreadwriteトランザクション内で再照合。既存・新規とも保存後の対象ID読戻しを残す。入力を最初にcopyし、await中の呼出元による変更を受けない。
- G：照合表示の全ページを読み、現在checkpointの内容が履歴と一致し、missing=0の場合だけ直後の2回目を省く。1行以上追記したら2回目の全件読戻しを維持。before/verified/again/finalの履歴読取り4回は維持。
- 同時更新をSheetsの原子的排他で防げるという変更ではない。Gで無追記時は照合表示を1回確認するため、2回の間に生じる表示セルだけの変更を観測する機会は減る。履歴のfinal照合は残り、外部編集との競合が絶対に起きないとは保証しない。金融の正本は履歴であり、表示セルから実績を作らない。

## 合成計測

`node tests/money-local-performance-browser.cjs`：クラウドLinux上のChromium、実IndexedDB、架空1000履歴/1000記録・端末比較100KB。Google通信はスタブで各応答に5msの待機。実Google・Fold8/Flip8の速度ではない。最終実行の1回分であり、時間はCPU負荷・端末・通信環境で変動する。シード生成は計測前かつブラウザ外で実施し、初回のキャッシュを温めない。

|項目|1.2.51|候補|
|---|---:|---:|
|初回 全体ms|956|756|
|初回 模擬通信待ちms（重複時間を除く）|103|101|
|初回 その他ms（計算/DB/ハーネス）|853|655|
|再同期 全体ms|842|612|
|再同期 模擬通信待ちms|97|86|
|再同期 その他ms|745|526|
|初回SHA呼出数|13017|2002|
|再同期SHA呼出数|13017|0|
|再同期リクエスト|29|27|
|再同期DB getAll|29|23|

両版checkpoint一致。再同期時の履歴/比較addは両版とも0、同期結果meta putは両版とも1。1000行の照合表示は2ページなのでGで2リクエスト減る。実際の通信時間をこの5msモデルから推定しない。全体同期には予定・日記など別処理もあり、この数字はお金だけ。

## 検証結果

- `node --test tests/*.test.cjs`：269件合格。完全一致/変更/不正fingerprint/構造不正/キャッシュ上限/crypto失敗、照合表示追記あり2回・なし1回、履歴4回維持、照合不一致停止を含む。
- `node tests/money-local-performance-browser.cjs`：上記比較と実IndexedDBの同一比較省略、同ID別内容・改ざん拒否、guard、保存失敗・同時保存・固定ID再試行・読戻し失敗後の結果確認と重複防止に合格。
- `node tests/money-sync-browser.cjs`：既存の合成2端末同期、競合、失敗、再実行、オフライン、保存保持、320/390/822pxに合格。
- `node tests/nami-import-browser.cjs`：1.2.51の確認表示と探索の回帰に合格。
- `MONEY_PREVIOUS_ROOT=/workspace/papa-money-performance MONEY_PREVIOUS_COMMIT=12eaf9f6c5deb2c890ec2c654e9a1321d3628a1d node tests/money-release-browser.cjs`：未改変旧版から通常終了後のオンライン/オフライン更新、controller/cache一致、履歴/localStorage等保持に合格。公開済み1.2.51bundle不変。
- bundle整合とgit diff --checkを確認。配信状態はGitHub Pagesのデプロイ結果で確認する。実Google性能・実機表示は未検証。
