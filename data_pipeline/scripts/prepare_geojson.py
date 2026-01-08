import pyarrow.parquet as pq
import h3
import json
import os
import argparse
from pathlib import Path

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

from shapely.geometry import Polygon, MultiPolygon, box
from shapely.validation import make_valid

# ... (imports)

def fix_antimeridian_geometry(coords):
    """
    Checks if a polygon crosses the antimeridian (180/-180) and splits it if necessary.
    Input: coords = list of [lng, lat]
    """
    # 1. 180度またぎがあるか簡易チェック
    needs_fix = False
    for i in range(len(coords) - 1):
        lng1 = coords[i][0]
        lng2 = coords[i+1][0]
        if abs(lng1 - lng2) > 180:
            needs_fix = True
            break
            
    if not needs_fix:
        return {"type": "Polygon", "coordinates": [coords]}

    # 2. 座標を連続になるように補正 (Shift to 0..360 range for continuity)
    # 西経(-180~0) の点を +360 して東側 (180~360) に持ってくる
    shifted_coords = []
    for lng, lat in coords:
        if lng < 0:
            shifted_coords.append((lng + 360, lat))
        else:
            shifted_coords.append((lng, lat))
            
    poly = Polygon(shifted_coords)
    if not poly.is_valid:
        poly = make_valid(poly)

    # 3. 180度ラインで分割 (Clip with x=180)
    # 左側 (通常): -180 ~ 180 (ここは 0~180 の範囲になる)
    # 右側 (補正分): 180 ~ 540 (補正した 180~360 の範囲)
    
    # 実際は "180度またぎ" なので、180を境界に西側と東側に分ける
    # 補正後の座標系では、境界は x=180 ではなく x=180 (日本などの東側) と x=??
    # いや、H3の六角形がまたぐ場合、片方は 179、もう片方は -179 (+360されて 181) となる。
    # なので、180度線でカットすれば良い。
    
    # bounding box for the "left" part (Eastern Hemisphere in original coords)
    # x: 0 ~ 180
    box_left = box(0, -90, 180, 90)
    
    # bounding box for the "right" part (Western Hemisphere shifted)
    # x: 180 ~ 360
    box_right = box(180, -90, 360, 90)
    
    parts = []
    
    # Intersection with 0-180
    try:
        left_part = poly.intersection(box_left)
        if not left_part.is_empty:
             # そのまま採用
             parts.append(left_part)
    except Exception as e:
        print(f"Error intersecting left: {e}")

    # Intersection with 180-360
    try:
        right_part = poly.intersection(box_right)
        if not right_part.is_empty:
            # -360 して元の座標系 (-180~0) に戻す
            # Shapely geometry shift
            from shapely.affinity import translate
            right_part_shifted = translate(right_part, xoff=-360)
            parts.append(right_part_shifted)
    except Exception as e:
        print(f"Error intersecting right: {e}")

    if not parts:
        # Fallback
        return {"type": "Polygon", "coordinates": [coords]}

    # Merge results
    if len(parts) == 1:
        # Single polygon result
        p = parts[0]
        if isinstance(p, Polygon):
             return {"type": "Polygon", "coordinates": [list(p.exterior.coords)]}
        elif isinstance(p, MultiPolygon):
             # 稀なケース
             params = []
             for sub in p.geoms:
                 params.append(list(sub.exterior.coords))
             return {"type": "MultiPolygon", "coordinates": [params]}
    else:
        # MultiPolygon result
        coords_list = []
        for p in parts:
             if isinstance(p, Polygon):
                 coords_list.append(list(p.exterior.coords))
             elif isinstance(p, MultiPolygon):
                 for sub in p.geoms:
                     coords_list.append(list(sub.exterior.coords))
        return {"type": "MultiPolygon", "coordinates": [coords_list]}

def process_resolution(res, country_code, input_base_dir):
    input_file = os.path.join(input_base_dir, country_code, f'pop_res_{res}.parquet')
    if not os.path.exists(input_file):
        print(f"Skipping Res {res}: File not found at {input_file}")
        return []

    print(f"Processing Resolution {res}...")
    df = pq.read_table(input_file).to_pandas()
    
    features = []
    
    # tippecanoe用のメタデータを付与してFeatureを作成
    for _, row in df.iterrows():
        h3_index = str(row['h3_index']) 
        population = float(row['value'])
        
        tuple_of_latlngs = h3.cell_to_boundary(h3_index)
        boundary = [(lng, lat) for lat, lng in tuple_of_latlngs]
        
        # Close the ring
        coords = list(boundary)
        if coords[0] != coords[-1]:
            coords.append(coords[0])
            
        # Antimeridian Fix
        geometry = fix_antimeridian_geometry(coords)
        
        feature = {
            "type": "Feature",
            "properties": {
                "population": population,
                "h3_index": h3_index,
                "resolution": res,
                "tippecanoe": {
                    "minzoom": RES_CONFIG[res]['min'],
                    "maxzoom": RES_CONFIG[res]['max'],
                    "layer": "combined_for_tiles"
                }
            },
            "geometry": geometry
        }
        features.append(feature)
        
    return features

def main():
    parser = argparse.ArgumentParser(description="Combine Parquet files into GeoJSON for tiles")
    parser.add_argument("--country", required=True, help="Country code (e.g., jp, global)")
    parser.add_argument("--base_dir", default="data/output", help="Base directory for input/output")
    
    args = parser.parse_args()
    
    output_dir = os.path.join(args.base_dir, args.country)
    output_file = os.path.join(output_dir, "combined_for_tiles.geojson")
    
    all_features = []
    
    # 対象とする解像度のみ処理
    for res in [4, 5, 6, 7]:
        all_features.extend(process_resolution(res, args.country, args.base_dir))
        
    print(f"Writing {len(all_features)} features to {output_file}...")
    
    # GeoJSONSeq (行区切りJSON) で書き出すとTippecanoeに優しいが、
    # Python json dumpだと通常のGeoJSONになる。今回はメモリに乗るサイズなので通常のGeoJSONでOK
    geojson_obj = {
        "type": "FeatureCollection",
        "features": all_features
    }
    
    with open(output_file, 'w') as f:
        json.dump(geojson_obj, f)
        
    print("Done.")

if __name__ == "__main__":
    main()
