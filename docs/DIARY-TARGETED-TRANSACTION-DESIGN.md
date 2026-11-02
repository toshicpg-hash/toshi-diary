# 優先案：2ID限定repair transaction（設計のみ）

## 親から説明する短い案

全7原本・旧ID対応をprivate archiveへ保存して読戻し、本人が対象とbefore/after差分を確認する。全端末と外部writerを停止した上で、Googleと各端末の**元ストア内の対象2IDだけ**を既知variantから原初版へ明示的に正規化し、新5履歴を追加する。対象外86履歴は読取り照合だけで、移動も更新もしない。通常のappend-only APIは維持し、別の限定repair入口のみが対象行の置換を許す。全保存元の完全readbackと本人確認が揃うまで日記を再開しない。

これは原ストアの行を書き換える操作であり、単なるappendでもバックアップ復元でもない。archiveから全14項目・元ID・元parentを完全に取り出せるが、元の行の内容は変わる。その具体的差分、archive保持先、停止範囲への**別の実行承認**が必要。今回は設計とfixtureのみで、adapter・配信bundle・通常同期を変更しない。

最重要の前提：旧端末が同ID衝突で必ず停止する保証はない。原初A0を持つ旧端末は修復後と一致してmergeできる。全writer停止・旧版廃止を本人が確認できない場合は、この案も実行不可。CASなしで無条件の安全保証はしない。

## 比較と選択

| 比較 | 2ID限定transaction（優先） | 新世代DB/台帳（比較用） |
| --- | --- | --- |
| 対象外86履歴 | 全照合のみ、書込まない | 全コピーと参照先変更 |
| 旧対象行 | 明示的に置換。全原本を別archiveへ保全 | 旧ストアをそのまま残せる |
| 接続先/DB pointer | 変更なし。phase/gateのみ追加 | 全端末でrouteとpointerを切替 |
| local atomicity | 既存DBのrevisions/meta内で完結 | 新DBとcontrol DBを跨ぎ別バリアが必要 |
| Google排他 | CASなし、全writer停止必須 | CASなし、新台帳への外部書込みも排除できない |
| 旧端末 | 一部のみ同ID衝突。他は通る | 新route非通知で隔離しやすいが権限制御ではない |
| rollback | 新追加履歴を削除せず、復旧は原則forward | release前は旧pointerへ戻せるが全履歴移行が必要 |

対象2件が既知root・子履歴なしという条件では小さい2ID案に絞る。新世代案の詳細は `DIARY-ACTIVATION-DESIGN.md` に比較用として残し、実装しない。

## 実行計画を確定する条件

既存pure planに別のprivate execution manifestを添付し、元planIdと実行計画全体のdigestへ本人確認を結び付ける。最低項目：

- 正確な2対象ID、各全variant canonical、採用する原初版と新5ID/parentの対応、全7原本archiveのbytes/JSON digest。
- **保存元ごとの**許可されたbefore snapshotのexact hashとafter hash。全variant whitelistは本人確認の資料であり、「別端末で既知だからこの端末でも許可」とはしない。変更後は再レビューが必要。
- 各端末は対象別にexact canonicalまたは明示的なabsent。draft/meta/対象外86のdigestと、非日記データの比較証跡。Googleは全raw行順・14列ヘッダー・対象のrow座標・空の追加range・sheet/tab ID・grid情報もpinする。
- planId、executionId、固定operationId、参加者の全端末/profile/writer一覧、freeze receipt、実行前archive読戻し証跡、各段階の期待hash。
- 本文等はprivateのみ。digestは署名・本人認証ではなく、確認内容を固定する識別子。

実際のwrite setは保存元で異なる。fixtureの端末1はA0が既に一致するため置換0、B0未取得なので原初B0追加1＋新5履歴追加。端末2はA1→A0の置換1＋新5履歴追加。GoogleはA1→A0とB4→B0の置換2＋新5履歴追加。**「2IDだけ」と「全保存元で2行を書き換える」を混同しない。** いずれも完成は93履歴。

## archive・journal・gate

全原本を含む既存archiveとraw source backupをリポジトリ外の独立媒体2か所へ保存し、実ファイルの読戻しを検証する。保全は無期限・自動削除なしの方針とするが、ブラウザevictionや媒体故障を無期限に防ぐ保証はない。外部backupが読めない場合は実行しない。

各端末は既存DBのmetaへ予約namespace `repair:<executionId>:archive` と `repair:<executionId>:journal` を追加する。既存metaキーは変更しない（draft、deviceId、sheet、過去ack等も不変）。archiveキーはaddのみ・既存なら全内容一致を照合。journalはsequence/phase/operationId/beforeHash/afterHash/verifiedEvidenceを持つ。repair journal自身を含むhashの自己参照を避け、既存metaとrepair namespaceは明示分離してdigestする。未知repair namespace衝突なら停止。

Google実行intent/outcomeは調整役の耐久private journalに先に記録し、Googleへ送信前に保存・読戻す。remote行だけから成功を推測せず、固定operationIdと対象台帳を結び付ける。Google側への新journal tab追加はこの最小案に含めない。調整役journal喪失時は自動再送を禁止し、全実体・backupを調査する。

対応版に必要な最小変更は、日記store commitと日記ネットワーク入口のfreeze gate、および限定repair API。通常commitは従来同様append-onlyで、置換のfallbackを作らない。freeze前にdraft timer、writeQueue、進行中syncを排出し、未保存フォームを本人が保存/退避する。ローカル排他とwrite/readbackの順序は全日記write経路で統一する。旧コードはgateを知らないので旧タブ/PWA/profile/外部writerの停止は別の必須条件。

## 永続手順：prepare → readback → 限定apply → resume

1. **REVIEWED → FROZEN**：全端末・全外部writerを停止し、全raw snapshotを再読取りしてexact before hashを確認。archiveを独立保存・読戻し。各端末はrevisions/meta transactionでbeforeを比較し、freeze journalだけを保存。日記以外の操作を変更しない。
2. **PREPARED**：各端末でarchive追加と読戻しを確認、全端末のreceiptを調整役へ私有保存。Googleのbefore/row位置/空rangeも再確認。1端末でも不在・draft変化・未知variantなら停止。まだ履歴は変更しない。
3. **GOOGLE_SENT / UNKNOWN / VERIFIED**：固定した限定batchのintentをjournalへ耐久保存してから送信。Google全readbackがexact afterならVERIFIED。応答successだけでは完了にしない。後述の結果不明ルールを守る。
4. **LOCAL_APPLIED_READ_ONLY**：Google VERIFIEDを確認後、各端末で単一のrevisions/meta readwrite transactionを開始。transaction内で全revisions、既存meta、freeze sequence、archiveを読み、exact beforeならtarget IDsだけput、欠落B0と新5IDだけadd、archive存在確認とjournal outcomeを同時commit。既存86履歴・既存metaキーへputしない。exact after＋一致journalならno-op。不明・混合状態はabort。
5. transaction完了後にDBを再openして全readback。実体とjournalが一致するまで端末完了扱いにしない。途中で端末2が失敗しても端末1/Googleはread-only運用を維持し、端末2を同じoperationで再開する。
6. **ALL_VERIFIED → RESUMED**：Googleと全端末がafter hash、86件不変、全原本archive、draft/meta不変で一致し、本人が両実画面を確認。そのreceiptを耐久保存してから各端末gateを解除。Google保存済み／端末データ修復済み／本人表示確認済み／全端末利用再開済みは別状態。途中でfreeze条件を破る変更を検出したら解除禁止。

新DB・active route pointerは使わない。切替はjournal phaseと日記gateの解除だけ。同一端末でarchiveとrevisionsとjournalがatomicになる一方、全端末＋Googleに跨るatomicityはない。

## Googleのatomic batchとCASの違い

Google公式は `spreadsheets.batchUpdate` のsubrequest群のatomic適用を保証する一方、共同編集者により結果が変わり得ると明記している。これはbefore hashを条件とするCASではない。[公式API契約](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)

将来adapterは、2対象行の `userEnteredValue` と、確認済み末尾の空5行×14列だけを固定座標のUpdateCellsで**一つのbatch**へまとめる。行挿入・全体clear・日記対象外range更新はしない。文字列として保存し、数式解釈/型変換をしない。十分な空gridがなければ勝手に構造変更せず停止する。APIの具体的field mask/境界/型はadapter実装前に追加検証する。通常append endpointのblind retryや「部分成功したら残りを追記」は採用しない。

送信直前に全状態を再読取りしてbeforeを確認するが、その後の他writerによる変更を排除するCASはない。したがって全writer停止を確認できなければ送信自体を拒否する。直前/直後照合は競合の検出であり、観測間に改変・再改変された未採取原本まで保全できる保証ではない。本人が停止条件を満たせないなら、この案は安全とは言えず保留する。

## 結果不明・再試行・disconnect

| 観測 | journalと動作 |
| --- | --- |
| 送信前失敗、送信していないと確定 | 同じbeforeを再照合して同じoperationを送れる |
| terminalな明示拒否で未適用と確定 | beforeが一致しwriter停止が継続していれば再試行可能 |
| timeout/接続切断後、readback=after | 新送信なしで実体を採用候補とし、元要求の終了確認と再readbackまでfreezeを維持 |
| timeout後、readback=before | 「失敗した」と推定しない。遅延要求が後で適用され得るためUNKNOWNで停止・再送禁止 |
| readback=混合/部分/余分な行/対象外差分 | atomic batchの期待状態ではない。外部編集等を疑い停止、観測rawを保全、残りだけ再送しない |
| local commit応答喪失 | 新transactionでarchive/journal/revisionsを全読戻し。after＋同operationならno-op、before＋未commitなら再開可能、混合なら停止 |
| Google成功・片方端末失敗 | 全員の日記編集/同期gateを閉じたまま残る端末を再開。完了済み行を戻したり再追加しない |

固定座標への同一値再送は、凍結が完全に維持される限り値として冪等だが、要求遅延が解消しないまま書込みを再開すると後着要求が新編集を壊し得る。このため不明要求の自動再送はしない。元要求の終端を確認できない場合、任意の待ち時間だけで安全と判断せず、運用再開も保留する。この停止が最小構成の可用性上の制限。

## 中止・rollback・draft

apply前はfreezeを解除する前に全before一致を確認する。元の衝突は残るので通常同期は依然失敗し得る。apply開始後は既知afterへのforward completionを優先する。archiveに元値があるだけで、自動rollbackしてよいとはしない。

修復後の新5履歴を削除して旧beforeに戻す操作は行わない。Googleまたは一端末だけの元variantへ戻すと再び不整合になる。apply後の中止は全原本・新履歴・journalを保持した停止状態とする。復旧不能なら全保存元の新しいsnapshotをbackupし、別の本人確認済み復旧計画を作る。新規編集が始まった、または始まった可能性がある場合は全新履歴/draftも保全してから判断する。新データを捨てるrollbackは禁止。

draft JSONは書換えない。draftのbaseRevisionIdが今回置換した対象IDなら、意味が変わる可能性がある。編集元variantの証拠と本人確認から別repair sidecarへ対応を記録できる場合だけ再開可能。推定でbaseを最新へ差替えず、証拠不足はdraftを読取り専用で保持して保存を止める。fixtureの古いdraftも内容不変を検証するが、実フォーム再開の安全性は将来adapter試験が必要。

## 旧端末の検証と実装前条件

合成試験で、旧端末2(A1/B0)→修復Google(A0/B0+新履歴)は同ID差分で停止する。一方、旧端末1(A0/Bなし)はmerge成功し、新しいrevisionのappendもschema上可能。したがって「旧端末は必ずfail closed」は誤りであり採用しない。old appが新freeze metaを無視する問題も残る。

必要なfixtureは `tests/diary-targeted-design-fixtures.cjs`。状態遷移の期待値は設計データで、adapterを実装・試験済みとは扱わない。テストは既存pureコピーのwrite set、元14項目回収、対象外/draft不変、旧クライアント反例を検証するだけ。

将来実装へ進む条件は、本人が2IDの元行置換を明示承認すること、全writer停止/旧版廃止の確認、private archiveの独立読戻し、端末ごとのdraft意味確認、Google requestの終端/再開判断の運用、全日記write経路gateを合成crash試験で確認すること。これらが満たせないなら2ID案も実行しない。
