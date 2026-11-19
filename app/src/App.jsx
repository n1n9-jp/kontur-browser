import React, { useState, useCallback } from 'react';
import './App.css';
import { Map, Source, Layer } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { MapView } from '@deck.gl/core';
import { Protocol, PMTiles } from 'pmtiles';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  INITIAL_VIEW_STATE,
  MAP_VIEW_SETTINGS,
  lightingEffect,
  COLOR_SCALE_TYPE,
  RESOLUTION_SETTINGS
} from './config';

// Register the PMTiles protocol
let protocol = new Protocol();
maplibregl.addProtocol("pmtiles", (request) => {
  return new Promise((resolve, reject) => {
    const callback = (err, data) => {
      if (err) {
        console.error("PMTiles Protocol Error:", err);
        reject(err);
      } else {
        resolve({ data });
      }
    };
    protocol.tile(request, callback);
  });
});
const R2_BASE_URL = 'https://pub-47797a0e31a54fe3b0a589cfaf3befcc.r2.dev';
const DATASETS = [
  { id: 'global', label: '世界全体' },
  { id: 'jp', label: '日本のみ' }
];
const DEFAULT_DATASET = 'global';
const getPmtilesUrl = (dataset) => import.meta.env.PROD
  ? `${R2_BASE_URL}/${dataset}.pmtiles`
  : window.location.origin + `/data/${dataset}.pmtiles`;

// Helper to convert array color to hex string or rgb string for MapLibre
const toRgb = (color) => {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
};

const getParamsFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    longitude: parseFloat(params.get('lng')) || INITIAL_VIEW_STATE.longitude,
    latitude: parseFloat(params.get('lat')) || INITIAL_VIEW_STATE.latitude,
    zoom: parseFloat(params.get('z')) || INITIAL_VIEW_STATE.zoom,
    pitch: parseFloat(params.get('p')) || INITIAL_VIEW_STATE.pitch,
    bearing: parseFloat(params.get('b')) || INITIAL_VIEW_STATE.bearing
  };
};

const getDatasetFromUrl = () => {
  const d = new URLSearchParams(window.location.search).get('d');
  return DATASETS.some(ds => ds.id === d) ? d : DEFAULT_DATASET;
};

const updateUrl = (viewState, dataset) => {
  const params = new URLSearchParams();
  params.set('d', dataset);
  params.set('lng', viewState.longitude.toFixed(4));
  params.set('lat', viewState.latitude.toFixed(4));
  params.set('z', viewState.zoom.toFixed(2));
  params.set('p', viewState.pitch.toFixed(0));
  params.set('b', viewState.bearing.toFixed(0));

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
};

export default function App() {
  const [viewState, setViewState] = useState(getParamsFromUrl());
  const [dataset, setDataset] = useState(getDatasetFromUrl());

  const handleViewStateChange = useCallback(({ viewState }) => {
    setViewState(viewState);
    updateUrl(viewState, dataset);
  }, [dataset]);

  const handleDatasetChange = useCallback((e) => {
    const next = e.target.value;
    // 日本のみに切り替えたときは、データのある日本へ視点を戻す
    const nextViewState = next === 'jp' ? { ...INITIAL_VIEW_STATE } : viewState;
    setDataset(next);
    setViewState(nextViewState);
    updateUrl(nextViewState, next);
  }, [viewState]);

  // Define zoom ranges for each resolution based on config logic
  // Res 4: z < 5 (minzoom: 0, maxzoom: 5)
  // Res 5: 5 <= z < 6 (minzoom: 5, maxzoom: 6)
  // Res 6: 6 <= z < 7 (minzoom: 6, maxzoom: 7)
  // Res 7: 7 <= z (minzoom: 7, maxzoom: 24)
  const layerConfigs = [
    { res: 4, minzoom: 0, maxzoom: 5 },
    { res: 5, minzoom: 5, maxzoom: 6 },
    { res: 6, minzoom: 6, maxzoom: 7 },
    { res: 7, minzoom: 7, maxzoom: 24 }
  ];

  const layers = layerConfigs.map(config => {
    const res = config.res;
    const settings = RESOLUTION_SETTINGS[res];

    // Calculate expressions for this specific resolution
    const heightExpression = [
      '*',
      ['to-number', ['get', 'population']],
      settings.elevationScale
    ];

    const maxVal = settings.colorMaxVal;
    const normalizedValue = ['/', ['to-number', ['get', 'population']], maxVal];

    const colorStops = COLOR_SCALE_TYPE.flatMap((c, i) => [
      i / (COLOR_SCALE_TYPE.length - 1),
      toRgb(c)
    ]);

    const colorExpression = [
      'interpolate',
      ['linear'],
      normalizedValue,
      ...colorStops
    ];

    return (
      <Layer
        key={`h3-layer-${dataset}-${res}`}
        id={`h3-hexagons-${dataset}-${res}`}
        type="fill-extrusion"
        source={`pmtiles-source-${dataset}`}
        source-layer="combined_for_tiles"
        filter={['==', ['get', 'resolution'], res]}
        minzoom={config.minzoom}
        maxzoom={config.maxzoom}
        paint={{
          'fill-extrusion-color': colorExpression,
          'fill-extrusion-height': heightExpression,
          'fill-extrusion-opacity': 0.9,
          'fill-extrusion-base': 0
        }}
      />
    );
  });

  return (
    <>
    <DeckGL
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      // Removing DeckGL layers, using MapLibre Source/Layer instead
      layers={[]}
      effects={[lightingEffect]}
      style={{ width: '100vw', height: '100vh' }}
      views={new MapView({
        id: 'map',
        controller: true,
        ...MAP_VIEW_SETTINGS
      })}
    >
      <Map
        mapLib={maplibregl}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        reuseMaps
      >
        <Source
          key={dataset}
          id={`pmtiles-source-${dataset}`}
          type="vector"
          url={`pmtiles://${getPmtilesUrl(dataset)}`}
          attribution="Kontur Population"
        >
          {layers}
        </Source>
      </Map>
    </DeckGL>
    <div className="dataset-control">
      <label htmlFor="dataset-select">表示データ</label>
      <select id="dataset-select" value={dataset} onChange={handleDatasetChange}>
        {DATASETS.map(ds => (
          <option key={ds.id} value={ds.id}>{ds.label}</option>
        ))}
      </select>
    </div>
    </>
  );
}
