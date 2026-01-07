import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core';

/**
 * 初期ビューポート設定
 */
export const INITIAL_VIEW_STATE = {
    longitude: 136.0,
    latitude: 35.0,
    zoom: 5,
    pitch: 50,
    bearing: -20
};

/**
 * マップ操作の制限設定
 */
export const MAP_VIEW_SETTINGS = {
    minZoom: 3,
    maxZoom: 20,
    minPitch: 0,
    maxPitch: 60
};

/**
 * 照明設定 (Lighting)
 */
const ambientLight = new AmbientLight({
    color: [255, 255, 255],
    intensity: 1.0
});

const pointLight1 = new PointLight({
    color: [255, 255, 255],
    intensity: 2.0,
    position: [-74.05, 40.7, 8000]
});

const pointLight2 = new PointLight({
    color: [255, 255, 255],
    intensity: 2.0,
    position: [139.75, 35.68, 8000]
});

export const lightingEffect = new LightingEffect({ ambientLight, pointLight1, pointLight2 });

/**
 * マテリアル設定 (Material)
 * 光の反射特性などを定義
 */
export const MATERIAL_SETTINGS = {
    ambient: 0.1,
    diffuse: 0.6,
    shininess: 32,
    specularColor: [60, 64, 70]
};

/**
 * 解像度ごとの設定
 * resolution: H3解像度レベル
 * dataUrl: 読み込むParquetファイルのパス
 * elevationScale: 高さの強調倍率。ズームレベルに応じて高すぎる/低すぎる場合はここを調整
 * colorMaxVal: 色のグラデーションの最大値（この値以上の人口は最も濃い色になる）
 */
export const RESOLUTION_SETTINGS = {
    4: { dataUrl: '/data/jp/pop_res_4.parquet', elevationScale: 0.05, colorMaxVal: 200000 },
    5: { dataUrl: '/data/jp/pop_res_5.parquet', elevationScale: 0.2, colorMaxVal: 80000 },
    6: { dataUrl: '/data/jp/pop_res_6.parquet', elevationScale: 0.8, colorMaxVal: 30000 },
    7: { dataUrl: '/data/jp/pop_res_7.parquet', elevationScale: 2.5, colorMaxVal: 10000 },
    8: { dataUrl: '/data/jp/pop_res_8.parquet', elevationScale: 8.0, colorMaxVal: 3000 },
};

/**
 * ズームレベルに応じた解像度選択ロジック
 * 上から順に判定され、最初に条件を満たした解像度が選択される
 */
export const getResolutionForZoom = (z) => {
    if (z < 5) return 4;
    if (z < 6) return 5;
    if (z < 7) return 6;
    // Zoom 7以上は 解像度7 (Res 7) を維持して詳細化しすぎない（データ表現維持のため）
    return 7;
};

/**
 * その他設定
 */
export const COLOR_SCALE_TYPE = [
    [150, 240, 255], // Bright Cyan (Low density)
    [80, 180, 240],
    [40, 120, 200],
    [20, 70, 140],
    [10, 25, 60]     // Deep Blue (High density)
];

export const HEXAGON_COVERAGE = 0.8; // 六角形の隙間率 (0~1)
