# Googleアカウント選択の繰返しを減らす（1.2.58）

AI連絡箱1154番、2026-11-25の本人依頼に対応。基準mainは c8d0250103a02c994af0eae93de1ac34f7c3c4bb（1.2.56）。保留中の領収書1.2.57候補を混ぜないため、今回の版番号を1.2.58とする。

## 原因と最小変更

PAPAのトークンは従来からメモリー内だけにあり、開き直すと再取得する。通常の要求には空promptを指定していたが、アカウントのlogin_hintは渡していなかった。

PAPAには本人が明示確認した `toshi_google_sync_account_v1` が既にある。通常のinitTokenClientにはこの設定のemailをlogin_hint（連絡箱の互換指定hintも併記）として、requestAccessTokenにも同じlogin_hintと空promptを渡す。Google公式仕様ではlogin_hintにより、成功した場合にアカウント選択を省略できる。hint単体の動作には依存しない。
https://developers.google.com/identity/oauth2/web/reference/js-reference

「Googleアカウントを選び直す」では、新しいクライアントを両hintなしで作り、select_accountを渡す。接続後のprimaryカレンダーの所有者照合は従来のまま。ヒントを本人認証の代わりにはしない。

## CPG案との違い

- PAPAの既存の本人設定を再利用する。新しいemailキャッシュを作らず、Drive aboutの取得やハードコードの既定アカウントを追加しない。
- 初回・設定破損時は従来どおり本人設定を求め、勝手なアカウントで同期を始めない。
- 返された別アカウントを覚えて本人設定へ上書きしない。OAuth中の設定変更・他タブ変更でも安全停止する。
- トークン・パスワード・資格情報の永続化、スコープ追加、実ログイン、実記録の変更は行わない。
- 別経路の領収書読取専用接続や復旧専用UIを今回変更していない。

## 検証

- `node --test tests/*.test.cjs`：298件合格。ソースと生成bundleそれぞれで通常接続、再オープン、期限切れ、設定変更、誤アカウント、選び直し時のヒント欠落を確認。既存の同期ガード回帰を含む。
- `node tests/google-account-browser.cjs`：合成Google応答。設定なし・誤アカウントでは同期せず、日記保存と読戻し、本人設定取消、設定競合時の書込み停止を維持。実bundleの再読込みでも保存メールを渡し、トークンを保存しない。
- `node tests/google-login-hint-upgrade.cjs`：未改変1.2.56から1.2.58へ、通常/800ms遅延。旧タブを保持したままは旧版表示。全タブ通常終了後のオンライン・オフライン再表示で新controllerとbundle、履歴・画像・localStorage保持を確認。
- `node scripts/build-bundle.cjs`、`git diff --check`。旧公開1.2.56 bundleは不変。

Google実接続・本人スマホは未検証。初回やGoogle側のセッション/同意判断により画面が出る可能性は残る。常に選択画面が出ないという保証ではない。マージ・公開は2026-11-25に本人が承認。配信結果はGitHub Pagesの該当commitと実配信で別途確認する。
