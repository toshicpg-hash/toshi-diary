# assistant・外部クライアントの日記保存手順

既存 `revision_id` の行をUPDATEして本文・人物・日時を変更することは禁止。日記は14項目のappend-only DAG。新内容は必ず新revisionId、同entryId、編集元revisionIdをparentsに持つ新行として追加する。中間版も残す。IDだけ同じで別内容は成功や最新版として扱わず保護停止する。

1. 対象と権限の確認後、専用日記台帳のヘッダーと**全行**を読む。raw原本を非公開保管。14列以外や不明な列・型を勝手に落とさない。`diary-core.js`のschema・canonical・mergeで、重複ID、同ID差分、欠落parent、別entry parent、循環を検証する。`lintAppend`は同一内容の重複行も拒否する。
2. 完全snapshotのdigestを保存し、`C.create`で新IDを一度だけ予約してintentとともに非公開保管する。更新のbaseは読んだ履歴に含まれる実在revision。複数headの解消は本人の内容確認とparents明示が必要。
3. 書込み直前に再読取りし、`await R.lintAppend(fresh, proposed, {expectedBefore: originalDigest})`を実行。変更があれば停止し新しい計画を確認する。`append`だけを追加する。既存行置換・全体clear・delete・同ID再利用は禁止。
4. 完了応答だけで成功にしない。全行を再読取りして `R.verifyAppendReadback(plan.expected, actual)` を実行する。全履歴一致で初めて「Google保存済み」。不一致・ネットワーク断・結果不明は「未確認」。
5. 結果不明時は再送の前に完全読取りする。予約済みIDが同じ内容で存在すれば送らない。なければ、新しい読取りdigestを明示して同じintentを再検証。異なる内容なら停止。新IDを都度生成し直すと重複投稿になるため禁止。
6. 「本人端末反映確認済み」は別ステータス。各端末からの対応履歴確認と本人の実画面確認が必要。Google保存だけでは端末確認済みにしない。

validatorはpure lintであり、悪意のあるクライアントを止めるサーバ権限ではない。SheetsにCASがないため読取りと追加の間の競合を原子的に防げず、writerの排他運用が必要。同時追加・通信結果不明はreadback不一致として停止して調査する。既存のGoogleクライアントや権限をこの文書が自動変更することはない。

`diary-repair.js`の `lintAppend`, `verifyAppendReadback` と `tests/diary-repair.test.cjs` が回帰guard。fixture以外の入力をコミットしない。
