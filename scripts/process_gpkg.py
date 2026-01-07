import geopandas as gpd
import pandas as pd
import h3
import argparse
import os
from pathlib import Path

def process_data(input_file, country_code, output_dir, base_resolution=8, target_resolutions=[4, 5, 6, 7, 8]):
    """
    GPKGファイルを読み込み、H3解像度ごとに集計してParquet形式で出力する
    """
    print(f"Loading {input_file}...")
    # GPKG読み込み
    # Konturデータは通常大きいので、必要ならchunk読み込みなどを検討するが、
    # 日本全体で数GB程度ならメモリに乗る可能性が高い。今回はシンプルに一括読み込み。
    gdf = gpd.read_file(input_file)
    
    print(f"Data loaded. Rows: {len(gdf)}")
    print("Columns:", gdf.columns)

    # H3インデックスの確保
    # 既存のカラムに 'h3' があればそれを使う、なければジオメトリから生成
    if 'h3' in gdf.columns:
        print("Using existing 'h3' column.")
        gdf['h3_index'] = gdf['h3']
    else:
        print(f"Generating H3 indexes from geometry at resolution {base_resolution}...")
        # ポリゴンの重心を使ってH3インデックスを取得
        # (Konturデータは六角形ポリゴンなので重心でOK)
        gdf['h3_index'] = gdf.geometry.centroid.apply(
            lambda geom: h3.geo_to_h3(geom.y, geom.x, base_resolution)
        )

    # 必要なカラムだけ残す（populationとh3_index）
    # カラム名はデータセットによって異なる場合があるため、それらしいものを探す
    pop_col = 'population'
    if 'population' not in gdf.columns:
        # 候補を探す
        for col in gdf.columns:
            if 'pop' in col.lower():
                pop_col = col
                break
    
    print(f"Using population column: {pop_col}")
    
    base_df = pd.DataFrame(gdf[[pop_col, 'h3_index']].copy())
    base_df = base_df.rename(columns={pop_col: 'value'})

    # 出力ディレクトリ作成
    country_dir = Path(output_dir) / country_code
    country_dir.mkdir(parents=True, exist_ok=True)

    # 各解像度レベルで集計して出力
    for res in target_resolutions:
        print(f"Processing Resolution {res}...")
        
        # 親レベルへの変換（現在のレベルより粗い場合）
        # まったく同じレベルならそのまま、細かいレベルへは変換不可（今回は集約のみ想定）
        df_res = base_df.copy()
        
        # H3インデックスの解像度変換
        # h3.h3_to_parent は古いAPIの場合があるのでバージョンに注意が必要だが、
        # 一般的に h3.cell_to_parent (v4) または h3.h3_to_parent (v3)
        try:
            # h3-py v4 API attempt
            df_res['h3_index'] = df_res['h3_index'].apply(lambda x: h3.cell_to_parent(x, res))
        except AttributeError:
            # h3-py v3 API fallback
            df_res['h3_index'] = df_res['h3_index'].apply(lambda x: h3.h3_to_parent(x, res))
            
        # 集計 (同じH3インデックスがあれば人口を足し合わせる)
        agg_df = df_res.groupby('h3_index')['value'].sum().reset_index()
        
        # 出力
        output_path = country_dir / f"pop_res_{res}.parquet"
        agg_df.to_parquet(output_path, index=False)
        print(f"Saved to {output_path}. Rows: {len(agg_df)}")

    print("All processing data completed.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process GPKG to H3 Parquet")
    parser.add_argument("--input", required=True, help="Input GPKG file path")
    parser.add_argument("--country", required=True, help="Country code (e.g., jp)")
    parser.add_argument("--output", default="data/output", help="Output directory")
    
    args = parser.parse_args()
    
    process_data(args.input, args.country, args.output)
