# 家族チャット (family-chatboard)

家族・小グループ向けのプライベートチャットアプリです。  
1グループ専用のクローズドチャットとして、Docker または Fly.io で自己ホスト運用できます。

## 機能

- リアルタイムチャット（SSE）
- 画像・動画・ファイル送受信
- 既読表示
- オンライン/オフラインプレゼンス表示
- メッセージ削除（ロールによる権限制御）
- ログセッション（チャット履歴のアーカイブと切替）
- 管理者によるユーザー管理（追加・バン・復帰・名前/ロール変更）
- Webセットアップ画面（初回のみ、CLIなしで登録可能）

## ロール

| ロール | 権限 |
|--------|------|
| `admin` | 全機能 + ユーザー管理 + ログ管理 |
| `parent` | チャット + 他ユーザーのメッセージ削除 |
| `child` | チャット + 自分のメッセージ削除 |

---

## Fly.io でのデプロイ（推奨）

### 必要なもの

- [Fly.io アカウント](https://fly.io/) （クレジットカード登録が必要）
- [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/)

### 手順

**1. リポジトリを取得**

```bash
git clone <このリポジトリのURL>
cd family-chatboard
```

**2. Fly.io にログイン**

```bash
fly auth login
```

**3. アプリを作成**

```bash
fly apps create <任意のアプリ名>
```

**4. fly.toml のアプリ名を変更**

```toml
# fly.toml
app = '<手順3で作成したアプリ名>'
```

**5. データ保存用ボリュームを作成**

```bash
fly volumes create <任意のボリューム名> --region nrt --size 1
```

作成したボリューム名を `fly.toml` に反映します：

```toml
[[mounts]]
  source = '<ボリューム名>'
  destination = '/data'
```

**6. シークレットを設定**

```bash
fly secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ALLOWED_ORIGIN="https://<アプリ名>.fly.dev"
```

**7. デプロイ**

```bash
fly deploy
```

**8. ブラウザでアクセス**

```
https://<アプリ名>.fly.dev
```

初回アクセス時にセットアップ画面が表示されます。  
最初のユーザーを **管理者（admin）** ロールで登録してください。

---

## Docker でのローカル起動

### 必要なもの

- Docker / Docker Compose

### 手順

**1. 環境変数ファイルを作成**

```bash
cp backend/config/env.php.example backend/config/env.php
```

`env.php` を編集し、`JWT_SECRET` に任意の文字列を設定してください。

**2. ビルドと起動**

```bash
docker build -t family-chatboard .
docker run -d \
  -p 8080:80 \
  -v oyako-data:/data \
  -e JWT_SECRET="your-secret-key" \
  -e ALLOWED_ORIGIN="http://localhost:8080" \
  --name family-chatboard \
  family-chatboard
```

**3. ブラウザでアクセス**

```
http://localhost:8080
```

---

## 初回セットアップ

初回アクセス時にセットアップ画面が表示されます。

1. メンバーの名前・ロール・PIN（4〜8桁の数字）を入力
2. 「＋ メンバーを追加」で人数分追加
3. 「セットアップ完了」をクリック

> 管理者（admin）ロールのユーザーを最低1名登録することを推奨します。

---

## ログセッション（チャット履歴管理）

管理者は「管理」→「ログ管理」タブから操作できます。

| 操作 | 効果 |
|------|------|
| 新しいログセッションを開始 | 現在の履歴をアーカイブし、空のチャットを開始 |
| ログ一覧から「切替」 | 過去のアーカイブを表示（読み込み・追記可能） |

ログ切替後、全メンバーの画面が自動でリロードされます（最大8秒）。

---

## ユーザー管理

管理者は「管理」→「メンバー管理」タブから操作できます。

- **ユーザー追加**: 名前・ロール・PINを入力して追加
- **バン**: 対象ユーザーのログインを停止（プレゼンスからも除外）
- **復帰**: バンを解除してログイン可能に戻す
- **編集**: 名前・ロールを変更

---

## 技術スタック

| 層 | 技術 |
|----|------|
| フロントエンド | React + TypeScript + Vite + Tailwind CSS v3 |
| バックエンド | PHP 8.2 + Apache |
| データベース | SQLite（WALモード） |
| リアルタイム通信 | SSE（Server-Sent Events） |
| 認証 | JWT（HMAC-SHA256） |
| コンテナ | Docker multi-stage build |
| ホスティング | Fly.io |

---

## 開発者

| | |
|---|---|
| **Tomoyuki** | [dev.tomoyuki.org](https://dev.tomoyuki.org) |
| **Claude (Anthropic)** | AI pair programmer — [claude.ai](https://claude.ai) |

---

## ライセンス

MIT
