# Development Guide

[English](#english) | [日本語](#日本語)

---

## 日本語

### 手動インストール（開発者向け）

1. このリポジトリをクローン
   ```bash
   git clone https://github.com/d8y/backlog-quick.git
   cd backlog-quick
   ```

2. 依存関係をインストール
   ```bash
   pnpm install
   ```

3. ビルド
   ```bash
   pnpm build
   ```

4. Chrome に読み込み
   - `chrome://extensions` を開く
   - 「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `build/chrome-mv3-prod` フォルダを選択

### 開発コマンド

```bash
# 開発サーバー起動（ホットリロード）
pnpm dev

# 本番ビルド
pnpm build

# 配布用パッケージ作成
pnpm package
```

### 技術スタック

- [Plasmo](https://docs.plasmo.com/) - Chrome 拡張機能フレームワーク
- [React](https://react.dev/) 18 - UI ライブラリ
- [TypeScript](https://www.typescriptlang.org/) - 型安全な開発
- [Tailwind CSS](https://tailwindcss.com/) - スタイリング
- [Headless UI](https://headlessui.com/) - アクセシブルな UI コンポーネント
- [Fabric.js](http://fabricjs.com/) - 画像編集用 Canvas ライブラリ

### プロジェクト構成

```
src/
├── popup.tsx              # Popup モード UI
├── sidepanel.tsx          # Side Panel モード UI
├── options.tsx            # 設定ページ
├── background.ts          # Service Worker（スクリーンショット、Side Panel 制御）
├── components/
│   ├── IssueForm.tsx      # 課題作成フォーム
│   └── ImageEditor.tsx    # 画像編集エディタ
├── contents/
│   └── backlog-form-filler.ts  # Backlog フォーム自動入力
├── lib/
│   ├── backlog-api.ts     # Backlog API クライアント
│   ├── storage.ts         # ストレージ管理
│   ├── annotation-tools.ts # 注釈ツール（四角形、矢印、テキスト）
│   └── history-manager.ts # Undo/Redo 履歴管理
└── types/
    ├── index.ts           # 共通型定義
    └── editor.ts          # エディタ関連型定義
```

### コントリビューション

Issue や Pull Request は歓迎します。

---

## English

### Manual Installation (For Developers)

1. Clone this repository
   ```bash
   git clone https://github.com/d8y/backlog-quick.git
   cd backlog-quick
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Build
   ```bash
   pnpm build
   ```

4. Load in Chrome
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-prod` folder

### Development Commands

```bash
# Start development server (hot reload)
pnpm dev

# Production build
pnpm build

# Package for distribution
pnpm package
```

### Tech Stack

- [Plasmo](https://docs.plasmo.com/) - Chrome extension framework
- [React](https://react.dev/) 18 - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe development
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Headless UI](https://headlessui.com/) - Accessible UI components
- [Fabric.js](http://fabricjs.com/) - Canvas library for image editing

### Project Structure

```
src/
├── popup.tsx              # Popup mode UI
├── sidepanel.tsx          # Side Panel mode UI
├── options.tsx            # Settings page
├── background.ts          # Service Worker (screenshot, Side Panel control)
├── components/
│   ├── IssueForm.tsx      # Issue creation form
│   └── ImageEditor.tsx    # Image editor
├── contents/
│   └── backlog-form-filler.ts  # Backlog form auto-fill
├── lib/
│   ├── backlog-api.ts     # Backlog API client
│   ├── storage.ts         # Storage management
│   ├── annotation-tools.ts # Annotation tools (rectangle, arrow, text)
│   └── history-manager.ts # Undo/Redo history management
└── types/
    ├── index.ts           # Common type definitions
    └── editor.ts          # Editor-related type definitions
```

### Contributing

Issues and Pull Requests are welcome.
