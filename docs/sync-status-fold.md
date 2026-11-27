# Googleまとめ同期の結果をたたむ 1.2.61

トシさんの指示（11/27）：ホームの「Googleまとめ同期」の結果（予定・ToDo・ダイアリー・お金・ナミ向け確認記録）が長いので、たたむ。

- `hub-sync.js` の `show(states)` だけを変えた。結果の段落は前と同じ文で、`<details class="sync-all-fold">` の中に入れる。
- すべての項目が成功したときだけ閉じて出す。見出しは「✓ 同期が完了しました（押すと詳しい内容）」。開いたら「（押すと詳しい内容）」は消す。
- 同期中（running・waiting）、未完了・失敗（failed・skipped）のときは開いたまま出す（問題を隠さない）。
- 開いたあとに表示が描き直されても、すべて完了のあいだは開いたまま。
- 同期の処理・保存・送信・ナミ向け確認記録の中身は変えていない。

試験（架空のデータだけ）：
- `tests/combined-sync-browser.cjs`：完了のときは閉じた1行で、中の段落は見えない。押すと開く。390px で横のはみ出しなし。未完了・失敗のときは開いたまま。
- `tests/fold-release.test.cjs`：新しい版 1.2.61 の参照。公開済みの 1.2.60 の bundle は変えない（ハッシュ）。
- `node --test tests/*.test.cjs` は全部通過。
- 古い版の番号を決め打ちしている `device-recovery-upgrade`・`google-login-hint-upgrade`・`money-transfer-upgrade`・`diary-local-repair-browser` は、この変更の前（main）でも同じ所で落ちる。この変更とは関係がない。
