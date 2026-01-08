import pyarrow.parquet as pq
import h3
import json
import os

# 設定: 各解像度に対応するズームレベル範囲
# Res 4: Z0-4
# Res 5: Z5
# Res 6: Z6
# Res 7: Z7-20 (高ズームまでRes7を引っ張る)
RES_CONFIG = {
    4: {'min': 0, 'max': 4},
    5: {'min': 5, 'max': 5},
    6: {'min': 6, 'max': 6},
    7: {'min': 7, 'max': 22} 
    # Res 8は今回使用しない（ユーザー要望でRes7相当で止めるため、かつファイルサイズ削減）
}

OUTPUT_FILE = 'data/output/jp/combined_for_tiles.geojson'

def process_resolution(res):
    input_file = f'data/output/jp/pop_res_{res}.parquet'
    if not os.path.exists(input_file):
        print(f"Skipping Res {res}: File not found")
        return []

    print(f"Processing Resolution {res}...")
    df = pq.read_table(input_file).to_pandas()
    
    features = []
    
    # tippecanoe用のメタデータを付与してFeatureを作成
    for _, row in df.iterrows():
        h3_index = str(row['h3_index']) # Ensure String to avoid 64-bit int issues in MVT
        population = float(row['value'])
        
        # H3-py v4 returns ((lat, lng), ...)
        tuple_of_latlngs = h3.cell_to_boundary(h3_index)
        boundary = [(lng, lat) for lat, lng in tuple_of_latlngs]
        
        # Close the ring
        coords = list(boundary)
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        
        feature = {
            "type": "Feature",
            "properties": {
                "population": population,
                "h3_index": h3_index,
                "resolution": res,
                "tippecanoe": {
                    "minzoom": RES_CONFIG[res]['min'],
                    "maxzoom": RES_CONFIG[res]['max'],
                    "layer": "population"
                }
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords]
            }
        }
        features.append(feature)
        
    return features

def main():
    all_features = []
    
    # 対象とする解像度のみ処理
    for res in [4, 5, 6, 7]:
        all_features.extend(process_resolution(res))
        
    print(f"Writing {len(all_features)} features to {OUTPUT_FILE}...")
    
    # GeoJSONSeq (行区切りJSON) で書き出すとTippecanoeに優しいが、
    # Python json dumpだと通常のGeoJSONになる。今回はメモリに乗るサイズなので通常のGeoJSONでOK
    geojson_obj = {
        "type": "FeatureCollection",
        "features": all_features
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(geojson_obj, f)
        
    print("Done.")

if __name__ == "__main__":
    main()
