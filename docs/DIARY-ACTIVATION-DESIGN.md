# 比較用：新世代切替adapter — 非推奨代替案、未実装

優先提案は [2ID限定transaction案](DIARY-TARGETED-TRANSACTION-DESIGN.md)。本書の新世代方式は比較用に残すが、今回の対象では全履歴移行とroute切替が過大なため採用しない。

本書は設計の範囲。実Google/端末への操作、adapter実装、公開bundleや本番同期変更は含めない。既存のpureコピー変換を実運用可能と宣言するものではない。親側でprivateコピー検証が成功したとの報告は受領したが、実データはこのcheckoutへ受領・保存していない。

## 対象と影響範囲

| 項目 | 意図する操作 | 不変条件 |
| --- | --- | --- |
| 衝突した2日記の2旧ID | 7既知variantを原本対応付きの履歴へ正規化 | 全原本14項目をarchiveへ保持。新5ID/parent以外の各版の値は不変 |
| 対象外86履歴 | 新世代へ全件コピー | 14項目完全一致、追加編集・再採番・parent変更なし |
| 旧Google全台帳、旧端末DB | 凍結した原本として残す | clear/update/delete/置換なし |
| 新Google台帳と各新DB | 同一93履歴を新規準備 | 対象外86件にもコピー・参照先変更の影響がある |
| 各端末draft、既存meta | 自端末から値を複製、原本も保全 | 他端末draftで上書きしない。本文・編集情報を暗黙変換しない |
| 接続先とactive pointer | 専用control領域だけで新世代を指定 | 他ドメイン、認証設定、OAuth scope、Google権限は変更しない |
| 日記以外 | 読取りによる比較用digestのみ | localStorage/他DB/Google他台帳への書込みなし |

「2件だけ修復」は「2行だけ書く」という意味ではない。全日記履歴のコピー、追加ストレージ消費、接続先変更、停止期間、旧世代保持が実運用承認の対象になる。

## 最小構成と必要な将来の接続点

独立した修復ツールでprepare/readbackを担当する。通常のcanonical/merge/append-only commitは変えない。世代選択用の専用control DBを加え、日記に限って次を将来接続する必要がある（今回は実装しない）。

1. 日記起動時にcontrolを読み、旧DBか指定された新DBを一つだけ開く。未知schema・壊れたpointer・途中状態は日記だけ停止。旧DBへの黙ったfallbackは禁止。
2. 日記の全書込み経路（保存、draft自動保存、新規開始、復元、接続先設定、同期、まとめ同期からの呼出し）が日記専用gateを通る。500ms draft timerとwriteQueue、既存syncの完了を待ってからfreezeする。未保存のフォーム内容は本人に保存/私有退避を求め、無断破棄しない。
3. 新世代の日記同期はeffective routeをcontrolから取得し、旧 `meta.sheet` や旧 `remote:<sheet>.ids` を参照しない。旧metaは値を変えず複製するが、過去の記録として扱う。新台帳のackは世代別sidecarへ保存する。UIの接続先表示とopen-sheetも同じrouteを用いる。
4. 日記専用の同一origin Web Lockをwrite/sync/activationの全経路で使用し、controlを毎回再確認する。DBを跨ぐ原子トランザクションはないので、新DBはprepare後に封印し、同lock配下で読戻しとpointer commitを行う。非対応ブラウザではactivationを禁止。BroadcastChannelは通知用であり排他・停止の証明にはしない。

現行 `diary.js` は冒頭で既定DBを固定生成し、syncは `state.meta.sheet` を使う。したがって**本番コード変更ゼロで安全に切り替える方法はない**。修復ツールで既定DBの中身だけ交換する案は不採用。最小でも上記の日記限定の起動/gate/route接続が必要で、これを大規模な共通同期改修へ広げない。

## 永続データと識別子

本人確認済みprivate計画へ `repairId`, `planId`, `generationId`, 全端末参加者リスト、旧ソースdigest、新履歴digest、原本archiveのbytes digestとJSON digest、各端末draft/meta digest、旧/新のrouteを結び付ける。新しい実ID等はprivate実行計画にのみ記録。既存pure planを改変せず、実行計画digestを別に作り、全確認が両digestに結び付く。

各端末control DBは `state` とappend-only `events` を持つ。stateは `sequence, phase, activeDescriptor, preparedDescriptor, runDigest, generationId, fenceId, releaseReceipt`。descriptorは `{generationId, dbName, spreadsheetId, sheetTabId, archiveRef, runDigest}` を一つの値として持つ。sequence比較・phase遷移・pointer・event追加を**同じcontrol DBの1 readwrite transaction**でcommitする。新DBの内容との原子性は主張しない。

eventsには `operationId, priorSequence, nextSequence, expectedBeforeDigest, intendedAfterDigest, kind, result(unknown/verified), evidenceDigest`。本文やtokenはイベントへ重複記録しない。再試行は同じoperationId・同じ予約IDを使う。IDやphase名だけで一致扱いせず実体を再読取りする。

調整役は一人・一実行だけ。privateの実行計画と端末receiptを耐久保存・独立バックアップする。receiptは `participantId, runDigest, generationId, sequence, localHistoryDigest, draftDigest, activeDescriptorDigest, phase`。hashは署名でも本人認証でもない。receiptの取得元は本人確認した各端末に限定し、第三者の自己申告を証拠にしない。調整役の状態を失ったら自動再構成・再発行せず全端末と実体を再照合する。

## 手順とバリア

| 段階 | 永続操作と読戻し | 許可される日記操作 |
| --- | --- | --- |
| REVIEWED | 計画、参加者、完全原本backupの読戻し、必要容量を確認 | 通常操作からfreezeへ移る前段階。未保存入力を解決 |
| FROZEN | 全参加端末でqueue/sync/timerを排出、gateを永続化。全旧snapshotを再比較 | 旧/新とも日記編集・同期禁止、原本閲覧のみ |
| CLOUD_PREPARED | 新Google台帳へ93履歴、世代metadata、archive保存/参照を準備し全読戻し | 新台帳は封印。通常writerへrouteを配らない |
| LOCAL_PREPARED | 各新DBへ93履歴と自端末meta/draftを1新DB transactionで保存。close→reopen→全読戻し | 新旧とも編集・同期禁止 |
| READY_TO_ACTIVATE | 全参加者のprepared receipt、新Google、旧snapshot、backupを再照合 | まだ書込み不可。欠席・不一致なら停止 |
| ACTIVATED_READ_ONLY | 各端末がlocal lock配下でcontrol descriptorを原子的に切替、commit後再読戻し。新世代でアプリを再起動 | 新世代の読取り専用。旧は閲覧専用の別導線 |
| ALL_ACTIVATED | 全参加者のactive receiptと実画面で最新版/履歴/draftを確認、全旧ソースも再比較 | 新世代はまだ読取り専用 |
| RELEASED | 調整役が全receiptに紐付くrelease証跡を一度作成。各端末が同証跡を確認・永続化 | 確認済み端末だけ新世代で日記編集・同期可 |

「Google保存済み」「端末pointer切替済み」「本人画面確認済み」「全参加者確認済み」「書込み再開済み」を別々に表示する。Google readbackだけで端末表示を確認したことにしない。

全端末に跨るatomic commitは提供できない。片方だけACTIVATED_READ_ONLYで他方が失敗した場合も、両方の編集・同期gateを閉じたままにする。後続を成功扱いしない。後者を同じgenerationへ再開するか、後述の書込み前rollbackを行う。release配信が片方へ届かなくても、全端末のpointer確認済みなので届いた側の新世代編集と整合性は両立するが、届かない側は読取り専用のままであり「全端末利用再開」と表示しない。

## GoogleにCASがないことへの扱い

Google Sheetsのread→appendやread→updateの間を、この設計でCAS化できるとは仮定しない。旧台帳を直すUPDATEは行わず、新世代の隔離台帳だけを単独writerで準備する。それでも所有者本人や外部assistantが同じ台帳へ同時書込みできる権限を持つ限り、排他はサーバから強制されない。

必須条件は本人による全writer停止と新台帳への非公開route管理。旧台帳・新台帳を各バリアで再読取りし、変化なら停止する。これは観測時の検出であり、観測直後の外部書込みを不可能にする保証ではない。writer停止を証明・維持できなければactivation不可。権限剥奪や新認証を勝手に導入して解決しない。より強い保証が必要なら、別承認のサーバ側書込み制御等が必要で、この最小案の範囲を超える。

将来のGoogle adapterには事前のAPI契約確認が必要。新台帳のIDをクライアント予約して指定作成できる契約が確認できた場合だけ、そのIDを永続intentへ先に記録する。利用APIで指定できない場合は、createの結果不明を自動再試行しない。unique repair operation tagで検索できても検索結果ゼロを不在証明にしない。遅延した初回createと再createで二重作成し得るため、operation outcomeが確定できなければ手動調査で停止する。

台帳ID既知後の書込み結果不明は、その同じIDの完全readbackで判定する。完全一致ならverified、既知の厳密な部分集合なら不足分のみを新intentとしてprepareできるが、単独writer維持と未完了リクエストがないことを先に確認する。不明要求が後で成立し得る間は追記再送禁止。対象rangeの固定書込みでの再送がAPI上冪等かどうかも事前確認が必要。未知行、同ID差分、余分な列、複数候補は停止し、clear/deleteで整形しない。archive uploadの結果不明も同じ規則。

## 障害・再開・rollback

| 障害 | 判断と再開 | データ保持 |
| --- | --- | --- |
| create応答喪失/ID不明 | CLOUD_UNKNOWN。重複createせず調査。0件検索だけで再送しない | 旧原本とintent保持、存在する新候補も削除しない |
| append応答喪失 | 同じ台帳を完全readback。後発完了可能なら待機/停止 | 計画とraw readback保持、blind retryなし |
| local prepare容量不足/transaction abort | pointerは旧。新DBを再読取り、完全一致の場合のみpreparedとする | 旧DB不変、部分新DBも無断deleteしない |
| 新DB commit成功、control記録前crash | 新DBの固定名/manifest/digestを再検証しreceipt追記 | 二重生成しない。未知内容なら停止 |
| pointer transaction abort | 旧descriptor/sequenceのまま。新DBを再検証して同じintent再開 | 接続先だけ先に変わる状態を作らない |
| pointer commit後、応答/receipt喪失 | control実体のsequenceとdescriptorを読戻す | 旧へ自動戻ししない。新なら読取り専用から再開 |
| 片側のみactivated | 双方gate閉、後者を再開。利用不可なら書込み前rollback | 旧/新/receipt/archive全保持 |
| release発行または配信結果不明 | releaseが有効だった可能性を前提に、書込み後rollback扱い | 「まだ誰も書いていない」と推定しない |
| 途中中止/調整役消失 | gate閉。実体再検証後に同じplanへ再開、または保留 | 無断cleanupなし |
| source/draft/非日記値の変化 | 自動切替停止。新snapshotを別保存、計画再レビュー | 古い計画で新変更を上書きしない |

**release未発行と確定し、新旧全実体が計画と一致する場合だけ**、全端末gateを閉じたままcontrolを旧descriptorへ戻せる。旧世代は元の衝突状態なので、戻した後も同期・編集を自動再開せず「原本閲覧・修復保留」。新DB/台帳/archiveは残す。書込み前rollbackにも各端末のpointer読戻しが必要。

release発行済みまたは結果不明なら、まず全writerを止め、新世代の全端末履歴・draft・Googleを独立backupして読戻す。全端末取得不能ならrollback停止。新世代で増えた履歴を旧世代へ自動mergeしない（parentに新IDが含まれる）。旧pointerへ単純に戻すことは通常画面から新規データを隠し得るため禁止。新世代をそのまま復旧するか、新規履歴を含む第三世代への別修復計画を本人確認する。「削除しない」と「継続利用できる」は別条件であり、後者未解決なら停止と明示する。

## 旧未対応端末と隔離の限界

旧クライアントはcontrol/gate/lockを知らない。BroadcastChannel、DBのversionchange、タブを閉じる依頼だけでは再起動・offline PWAからの書込みを防げない。全端末/全ブラウザprofile/全タブ/インストールPWA/外部writerを棚卸し、日記停止と旧クライアント廃止を本人が確認することがrelease条件。確認不能な端末を勝手に参加者リストから除かない。

新台帳IDは旧クライアントへ設定しない。対応版は、新旧世代でのimport/restore/同期接続先混在を拒否する。新台帳を旧クライアントが知れば同じ所有者権限で書けるため、名前やappPropertiesはアクセス制御にならない。実装でこの問題を解決したと主張しない。遅れて復帰した旧端末は読取り・backupだけ実施し、その差分を確認するまで新世代へ接続させない。旧側に新規記録があれば別計画へ退避し、自動discardやimportをしない。

## draftとmetaの意味の保持

原本draft JSONをそのまま各端末新DBへ複製し、旧DBとarchiveにも保持する。`baseRevisionId`が衝突IDを参照すると、IDが同じでも原初版へ意味が変わり得る。したがってdraftの自動再開にもgateが必要。

draftの実際の編集元canonicalを証拠で確認できる場合だけ、別sidecar `draftResolution` に原本draft digestと元variant→新revisionの対応を本人確認付きで記録し、読み込み時の編集contextへ適用する。raw draftは書き換えない。証拠がない場合は本文を読取り専用で提示し、保存/自動保存は止める。最新版をbaseに再採用するなどの内容判断は本人が行い、通常の新revisionとして保存する。古いdraftのfieldsを最新版の内容で置換してはいけない。修復中にdraftを解消・消去する作業は別操作。

旧 `meta.sheet`、旧ack、旧世代DB名などは原本のまま保存するがeffective routeの情報源にしない。端末deviceIdは維持し、認証token/新credentialをarchiveやcontrolへ追加しない。metaに不明項目があれば値を保全し意味を推測しない。非日記データを修復ツールが再serializeして書き戻すことは禁止。

## fixtureと実装前に必要な検証

2ID限定案のfixtureは別文書を参照。本新世代方式のadapter/fixtureは実装しない。

将来adapterを実装する前に、Google APIのID予約/create/write/readbackの契約、既存権限での新台帳とprivate archive作成可否、全端末のWeb Locks/IndexedDB耐久性・容量・eviction、起動前gateと全日記write経路の網羅、未保存フォーム退避、draft意味保持を確認する。prepare/control commit/responseの各境界でcrashを注入し、別タブ、別端末、writerの遅延応答、quota、旧版起動、release配信失敗を実adapterの合成試験で検証する。fixtureだけで通過扱いしない。

採否の要点：排他停止を確認できず、CASも新しい権限制御もない条件では無条件の安全保証は成立しない。今回の最小案はその場合にactivation/releaseを拒否する設計である。
