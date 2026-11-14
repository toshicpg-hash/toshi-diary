# 日をまたぐ予定の表示順（1.2.56候補・未公開）

翌日以降に続く時刻付きeventは、表示対象日の00:00から継続する予定として並べる。終日予定を先に表示し、同順位は既存stable_key順。元のdate/time/endDate/endTimeは変更しない。
前日開始は「前日から」「前日22:49〜01:00」、それ以前の開始は「継続」と開始日を表示する。月・週・日と選択日詳細に適用。編集等の操作には元のitemを渡す。

検証: `node --test tests/*.test.cjs` 292件合格。`node tests/calendar-overnight-browser.cjs` は合成データ、320/390/822pxで月・週・日表示の順序、文言、保存不変を確認。`tests/calendar-navigation-browser.cjs` の12シナリオ合格（環境の/usr/bin/chromiumを使用）。bundle整合・git diff --check合格。1.2.55 bundle不変。
実Google・実機・旧版からの更新試験は未実施。push/PR/マージ/公開なし。公開には本人確認が必要。
