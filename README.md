# Kontur Browser

H3 人口密度データを可視化するブラウザアプリケーションとデータ処理パイプラインのプロジェクトです。

## プロジェクト構成

このプロジェクトは2つのメインディレクトリに分かれています。

*   **`app/`**: ウェブアプリケーション (React + MapLibre + Vite)
*   **`data_pipeline/`**: データ処理用スクリプト (Python)

---

## 🚀 ウェブアプリケーションのセットアップ (Web App)

ウェブアプリを実行・開発する場合は `app` ディレクトリで作業します。

### 1. ディレクトリ移動
```bash
cd app
```

### 2. インストール (初回のみ)
`npm init` ではなく、既存の定義ファイル (`package.json`) を元にインストールを行います。

```bash
npm install
```

### 3. ローカル開発サーバーの起動
開発中は以下のコマンドを実行します。ファイル保存時に自動でリロードされます。

```bash
npm run dev
```
起動後、ターミナルに表示されるURL (例: `http://localhost:5173`) にブラウザでアクセスしてください。

### 4. 本番用ビルド (Local Build)
本番環境に向けた最適化ビルドを行う場合は以下を実行します。

```bash
npm run build
```
これにより、`app/dist` フォルダに最適化された静的ファイル（HTML, CSS, JS）が生成されます。

ビルドした内容をローカルで確認（プレビュー）したい場合は：
```bash
npm run preview
```

---

## 🛠️ データパイプライン (Data Pipeline)

データの生成・加工を行いたい場合は `data_pipeline` ディレクトリで作業します。

詳細は [data_pipeline/DATA_PIPELINE.md](data_pipeline/DATA_PIPELINE.md) を参照してください。

### クイックスタート

```bash
cd data_pipeline
pyenv local 3.11.9
python -m venv .venv
source .venv/bin/activate
pip install geopandas pandas h3 pyarrow
```
