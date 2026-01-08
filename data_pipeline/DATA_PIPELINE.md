# データ処理パイプライン

本プロジェクトにおける人口データの加工から可視化用タイル生成までのフローを記述します。

## 全体フロー

`kontur_population_JP_20231101.gpkg`  
⬇️ (Step 1: Parquetへの分割・集計)  
`data/output/jp/*.parquet`  
⬇️ (Step 2: GeoJSONへの結合)  
`data/output/jp/combined_for_tiles.geojson`  
⬇️ (Step 3: PMTilesへの変換)  
`public/data/jp.pmtiles`

---

## Python環境のセットアップ

データ処理スクリプトを実行するために、Python仮想環境を作成し、必要なライブラリをインストールします。

1.  **仮想環境の作成**:
    ```bash
    cd data_pipeline
    pyenv local 3.11.9
    python -m venv .venv
    ```

2.  **仮想環境の有効化**:
    ```bash
    source .venv/bin/activate
    ```

3.  **依存ライブラリのインストール**:
    必要なライブラリ：`geopandas`, `pandas`, `h3`, `pyarrow`
    ```bash
    pip install geopandas pandas h3 pyarrow
    ```

---

## 詳細ステップ

### Step 1: GeoPackage から Parquet への変換・集計

元データ（.gpkg）を読み込み、H3解像度（Resolution 4〜8）ごとに集計して個別のParquetファイルとして保存します。

*   **Script**: `scripts/process_gpkg.py`
*   **Command**: (例) `python scripts/process_gpkg.py --input data/kontur_population_JP_20231101.gpkg --country jp`
*   **Input**: `data/kontur_population_JP_20231101.gpkg` (Users/yuichiyazaki/Documents/GitHubRepository/Projects_DataViz_SelfWorks/kontur_browser/data 配下を想定)
*   **Output**:
    *   `data/output/jp/pop_res_4.parquet`
    *   `data/output/jp/pop_res_5.parquet`
    *   `data/output/jp/pop_res_6.parquet`
    *   `data/output/jp/pop_res_7.parquet`
    *   `data/output/jp/pop_res_8.parquet`

### Step 2: Parquet から GeoJSON への結合

各解像度のParquetファイルを読み込み、指定したズームレベル範囲（minzoom/maxzoom）などの `tippecanoe` 用メタデータを付与して1つの巨大なGeoJSONファイルに結合します。
この段階で、H3インデックスからポリゴン（または点）ジオメトリへの変換が行われます。

*   **Script**: `scripts/prepare_geojson.py`
*   **Command**: `python scripts/prepare_geojson.py --country global`
*   **Input**: `data/output/jp/pop_res_*.parquet`
*   **Output**: `data/output/jp/combined_for_tiles.geojson`

### Step 3: GeoJSON から PMTiles への変換

Tippecanoeを使用して、GeoJSONをベクトルタイルアーカイブ（PMTiles）に変換します。このファイルがWebアプリケーション（MapLibre Source/Layer）から読み込まれます。

*   **Command**: 
    ```bash
    tippecanoe --force -o data/output/jp.pmtiles \
      -l combined_for_tiles \
      --no-tile-compression \
      --no-feature-limit \
      --no-tile-size-limit \
      --drop-densest-as-needed \
      -zg \
      data/output/jp/combined_for_tiles.geojson
    ```

    ```bash
    tippecanoe --force -o data/output/global.pmtiles \
      -l combined_for_tiles \
      --no-tile-compression \
      --no-feature-limit \
      --no-tile-size-limit \
      --drop-densest-as-needed \
      -zg \
      data/output/global/combined_for_tiles.geojson
    ```
*   **Input**: `data/output/jp/combined_for_tiles.geojson`
*   **Output**: `data/output/jp.pmtiles`
