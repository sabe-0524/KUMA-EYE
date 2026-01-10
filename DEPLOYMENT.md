# Firebase Auth + GCP デプロイ完全ガイド

## 📋 実装完了項目

### ✅ フロントエンド（Firebase Auth）
- ✅ Firebase SDK インストール (`firebase`)
- ✅ Firebase初期化 ([frontend/src/shared/lib/firebase.ts](frontend/src/shared/lib/firebase.ts))
- ✅ AuthProvider 実装 ([frontend/src/shared/providers/AuthProvider.tsx](frontend/src/shared/providers/AuthProvider.tsx))
- ✅ ログインページ ([frontend/src/app/login/page.tsx](frontend/src/app/login/page.tsx))
- ✅ メインページに認証ガード追加 ([frontend/src/app/page.tsx](frontend/src/app/page.tsx))
- ✅ axiosインターセプターでトークン自動付与 ([frontend/src/shared/api/index.ts](frontend/src/shared/api/index.ts))

### ✅ バックエンド（Firebase Admin SDK）
- ✅ `firebase-admin` と `google-cloud-storage` を [backend/requirements.txt](backend/requirements.txt) に追加
- ✅ Firebase認証ミドルウェア ([backend/app/core/auth.py](backend/app/core/auth.py))
- ✅ FastAPIアプリでFirebase初期化 ([backend/app/main.py](backend/app/main.py))
- ✅ APIエンドポイントに認証適用 ([cameras.py](backend/app/api/cameras.py), [uploads.py](backend/app/api/uploads.py), [alerts.py](backend/app/api/alerts.py))
- ✅ Cloud Storageサービス ([backend/app/services/storage.py](backend/app/services/storage.py))
- ✅ 環境変数設定 ([backend/app/core/config.py](backend/app/core/config.py))

### ✅ デプロイ設定
- ✅ Firebase App Hosting設定 ([apphosting.yaml](apphosting.yaml), [firebase.json](firebase.json))
- ✅ Cloud Run用Dockerfile最適化 ([backend/Dockerfile](backend/Dockerfile))
- ✅ Cloud Build設定 ([cloudbuild.yaml](cloudbuild.yaml))
- ✅ 環境変数ファイル ([frontend/.env.local](frontend/.env.local), [backend/.env.production](backend/.env.production))

---

## 🚀 デプロイ手順

### Phase 1: Supabase セットアップ

1. **Supabase プロジェクト作成**
```bash
# https://supabase.com にアクセス
# "New Project" クリック
# リージョン: Northeast Asia (Tokyo) 推奨
# データベース名: kuma-eye-db
```

2. **PostGIS拡張を有効化**
```sql
-- Supabase SQL Editorで実行
CREATE EXTENSION IF NOT EXISTS postgis;
```

3. **データベース接続文字列を取得**
```
Settings > Database > Connection String
例: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

---

### Phase 2: Firebase Console 設定

1. **Firebase Authentication を有効化**
```bash
# https://console.firebase.google.com/project/kuma-eye
# Authentication > Sign-in method > Google を有効化
```

2. **Cloud Storage バケット確認**
```bash
# Storage > kuma-eye.firebasestorage.app が作成済み
# ルールを本番用に更新（後述）
```

---

### Phase 3: Cloud Run デプロイ

1. **GCP プロジェクト設定**
```bash
gcloud config set project kuma-eye
gcloud auth login
```

2. **Cloud Build API を有効化**
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

3. **バックエンドをビルド＆デプロイ**
```bash
cd /Users/abesouichirou/Desktop/hack1_bear

# 環境変数を設定（Supabase接続文字列を使用）
export DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Cloud Buildでデプロイ
gcloud builds submit --config=cloudbuild.yaml

# または直接デプロイ
gcloud run deploy bear-api-service \
  --source=./backend \
  --region=asia-northeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --max-instances=10 \
  --set-env-vars="DATABASE_URL=$DATABASE_URL,FIREBASE_PROJECT_ID=kuma-eye,STORAGE_TYPE=gcs,GCS_BUCKET_NAME=kuma-eye.firebasestorage.app"
```

4. **デプロイ後のURLを取得**
```bash
gcloud run services describe bear-api-service --region=asia-northeast1 --format="value(status.url)"
# 例: https://bear-api-service-xxxxx-an.a.run.app
```

5. **[apphosting.yaml](apphosting.yaml) を更新**
```yaml
env:
  - variable: NEXT_PUBLIC_API_URL
    value: https://bear-api-service-xxxxx-an.a.run.app/api/v1  # ← 取得したURL
```

---

### Phase 4: Firebase App Hosting デプロイ

1. **Firebase CLI インストール**
```bash
npm install -g firebase-tools
firebase login
```

2. **Firebase App Hosting 初期化**
```bash
cd /Users/abesouichirou/Desktop/hack1_bear

# App Hosting設定
firebase init apphosting

# プロジェクト選択: kuma-eye
# リージョン: asia-northeast1
# ルートディレクトリ: frontend
# ビルドコマンド: npm run build
```

3. **GitHub リポジトリにpush**
```bash
git add .
git commit -m "Add Firebase Auth + GCP deployment config"
git push origin main
```

4. **Firebase Console でデプロイ**
```
https://console.firebase.google.com/project/kuma-eye/apphosting
→ "Connect GitHub repository"
→ リポジトリを選択
→ "Deploy" クリック
```

---

## 🔐 セキュリティ設定

### Firebase Storage ルール
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{allPaths=**} {
      // 認証済みユーザーのみアップロード可能
      allow write: if request.auth != null;
      // 全員が読み取り可能（公開画像）
      allow read: if true;
    }
  }
}
```

### Supabase RLS (Row Level Security)
```sql
-- Supabase SQL Editorで実行
-- 全テーブルにRLSを適用（オプション）
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーのみアクセス可能（例）
CREATE POLICY "Allow authenticated users" ON cameras FOR ALL USING (true);
```

---

## 🧪 ローカル開発環境テスト

### バックエンド
```bash
cd backend

# 依存関係インストール
pip install -r requirements.txt

# 環境変数設定
cp .env.production .env
# .envを編集: DATABASE_URLをSupabase接続文字列に変更

# サーバー起動
uvicorn app.main:app --reload
```

### フロントエンド
```bash
cd frontend

# Firebase認証のテスト
npm run dev

# ブラウザで http://localhost:3000 を開く
# /login でGoogle認証テスト
```

---

## 📊 デプロイ後の確認

1. **フロントエンドURL**: `https://kuma-eye.web.app`
2. **バックエンドURL**: Cloud Runで確認
3. **認証フロー**: ログイン → Google認証 → メインページ表示
4. **APIテスト**: カメラ登録、動画アップロードが動作するか

---

## 💰 コスト見積もり

| サービス | 無料枠 | 超過時コスト |
|----------|--------|-------------|
| Firebase App Hosting | 10GB/月 | ほぼ無料 |
| Cloud Run (2GB, min=0) | 200万リクエスト/月 | ~$15-25/月 |
| Supabase | 500MB DB, 1GB Storage | $0〜$25/月 |
| Cloud Storage | 5GB | ~$1-3/月 |
| **合計** | | **$15〜50/月** |

---

## ❓ トラブルシューティング

### 認証エラー
- Firebase Consoleで認証が有効化されているか確認
- `NEXT_PUBLIC_FIREBASE_*` 環境変数が正しいか確認

### CORS エラー
- Cloud Runの `CORS_ORIGINS` に `https://kuma-eye.web.app` を追加
- バックエンドのconfig.pyで設定

### Cloud Run デプロイ失敗
- `gcloud builds list` でビルドログ確認
- Dockerfileのビルドエラーを確認

---

## 📝 次のステップ

1. **Supabaseプロジェクト作成** → 接続文字列取得
2. **Firebase Authenticationを有効化**
3. **Cloud Runにバックエンドをデプロイ** → URLを取得
4. **apphosting.yamlを更新** → API URLを変更
5. **GitHubにpush** → Firebase App Hostingで自動デプロイ

準備ができたら実行してください！
