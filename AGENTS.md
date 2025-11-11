# エージェント向けハンドブック

## プロジェクト概要
- Chrome拡張「Gemini Flashlight Translator」の仕様策定と実装を進行中。
- 英語テキスト選択時にポップアップを表示し、Gemini 2.5 Flashlight APIから日本語訳をストリーミング表示する。
- 翻訳履歴は最新 20 件を既定として保存し、拡張アイコンのポップアップから表示件数を調整できるシンプルな閲覧機能に留める。

## ユーザー向け体験の要点
- 選択テキストの近くにポップアップを挿入し、翻訳ボタンで処理を開始。
- 翻訳中は進捗メッセージを表示し、受信済みテキストは逐次更新する。
- 履歴ビューでは訳文を時系列で表示するのみ。検索・ピン留め等の高度機能はスコープ外。
- 拡張アイコンのポップアップ（利用設定タブ）で API キー、トーン、履歴件数を設定可能。

## 技術構成
- Manifest v3。Service Worker (`src/background/index.ts`) がバックグラウンド処理を担う。
- Content Script (`src/content/index.ts`) がテキスト選択検知とポップアップ描画、進捗表示を実装。
- アクションポップアップ (`popup.html`, `popup.js`) が利用設定タブ／表示設定タブを提供し、APIキー入力や拡張の有効・無効切り替え、履歴UI、見た目の調整を担当。
- オプションページ (`src/options/index.ts`) は同じAPIキー入力欄を持つバックアップUIとして維持。
- 共通の型・メッセージは `src/shared/messages.ts`。
- TypeScript を `tsc` でビルドし、出力は `dist/` 以下に配置。バンドラ未導入。

### ディレクトリ構成の目安
```
dist/                ビルド成果物
manifest.json        Chrome 拡張のマニフェスト (MV3)
src/background/      Service Worker、API クライアント、storage ラッパー
src/content/         ポップアップ DOM とユーザー操作ハンドラ
src/options/         設定 UI
src/shared/          型定義とメッセージ
```

## Gemini API連携
- モデル: `gemini-flash-lite-latest`
- エンドポイント: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:streamGenerateContent`
- 認証: ユーザー入力の API キーを URL クエリ `?key=` に付与
- 設定: `thinkingBudget=0`、`googleSearch` ツールを有効化
- レスポンス形式:
  - `Content-Type: text/event-stream` の SSE チャンク
  - または `Content-Type: application/json` の改行区切り JSON
- `src/background/api.ts` の `streamGeminiTranslation` は上記両方に対応し、累積テキストから差分を算出 (`computeDelta`) して Content Script に通知する。

## ストレージと履歴仕様
- `chrome.storage.local` に保存。
- データ構造の想定:
  ```json
  {
    "id": "uuid",
    "sourceText": "string",
    "translatedText": "string",
    "createdAt": "ISO8601 string",
    "sourceUrl": "string",
    "tone": "polite|casual"
  }
  ```
- 最新エントリを先頭に追加し、設定値に応じて古いものを削除（既定20件、最大50件）。
- 履歴ビューは一覧表示のみ。検索・エクスポート等は実装しない前提。

## 開発ワークフロー
1. `npm install`
2. `npm run build` (単発ビルド) / `npm run dev` (ウォッチビルド)
3. `chrome://extensions` から `dist/` またはリポジトリルートを読み込み
4. ツールバーの拡張アイコンからポップアップを開き、「利用設定」タブで API キーを登録したうえでブラウザ上でテキスト選択して挙動を確認（必要に応じて `chrome://extensions` → 「オプション」から同じ設定も可能）

## テストと検証
- 単体テスト候補: `streamGeminiTranslation` のパーサ、履歴ストアのロジック、設定保存処理。
- E2E テスト候補: ポップアップ表示、翻訳開始、履歴表示の一連の流れ（Playwright 等）。
- パフォーマンス目標: 選択後 100ms 以内にポップアップ表示、翻訳完了まで 1.5 秒以内 (API 応答を含む)。

## デバッグメモ
- Service Worker のログは `chrome://extensions` → 対象拡張 → 「Service Worker」リンクから確認。
- `Extension context invalidated` が出た場合は Chrome 側で Service Worker が再起動している。必要なら拡張を再読み込み。
- API 403 は API キー不備・割当不足・制限設定などを疑う。

## 注意事項
- API キーをリポジトリへコミットしないこと。テスト時は環境変数経由で読み込む。
- 依存ライブラリ追加時はライセンス・容量を確認し最小限に抑える。
- 仕様変更があった場合は README と本ドキュメントを揃えて更新する。
