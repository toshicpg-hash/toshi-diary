# 日をまたぐ予定の表示順（1.2.56）

翌日以降に続く時刻付きeventは、表示対象日の00:00から継続する予定として並べる。終日予定を先に表示し、同順位は既存stable_key順。元のdate/time/endDate/endTimeは変更しない。
前日開始は「前日から」「前日22:49〜01:00」、それ以前の開始は「継続」と開始日を表示する。月・週・日と選択日詳細に適用。編集等の操作には元のitemを渡す。

検証: `node --test tests/*.test.cjs` 292件合格。`node tests/calendar-overnight-browser.cjs` は合成データ、320/390/822pxで月・週・日表示の順序、文言、保存不変を確認。`tests/calendar-navigation-browser.cjs` の12シナリオ合格（環境の/usr/bin/chromiumを使用）。bundle整合・git diff --check合格。1.2.55 bundle不変。
未改変1.2.55からの通常更新・800ms遅延更新試験に合格。旧タブ保持中は旧bundleのまま、全旧タブ通常終了後はcontroller/cache/bundleが1.2.56となり、オンライン・オフラインの再表示と合成履歴・画像・localStorage保持を確認。tests/device-recovery-upgrade.cjsの旧commitと版を今回対象に置換して実行。

2026-11-14に本人から公開承認。実Google・実機は未検証。端末では保存中の操作を完了後、PAPA HUBの旧タブを全て通常終了し、オンラインで開き直して版を確認する。サイトデータ削除は不要。
