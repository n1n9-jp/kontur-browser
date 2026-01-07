import React, { useState, useMemo, useCallback } from 'react';
import { Map } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { MapView } from '@deck.gl/core';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { ParquetLoader } from '@loaders.gl/parquet';
import { colorContinuous } from '@deck.gl/carto';
import debounce from 'lodash.debounce';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  INITIAL_VIEW_STATE,
  MAP_VIEW_SETTINGS,
  lightingEffect,
  MATERIAL_SETTINGS,
  RESOLUTION_SETTINGS,
  getResolutionForZoom,
  COLOR_SCALE_TYPE,
  HEXAGON_COVERAGE
} from './config';

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

const updateUrl = debounce((viewState) => {
  const params = new URLSearchParams();
  params.set('lng', viewState.longitude.toFixed(4));
  params.set('lat', viewState.latitude.toFixed(4));
  params.set('z', viewState.zoom.toFixed(2));
  params.set('p', viewState.pitch.toFixed(0));
  params.set('b', viewState.bearing.toFixed(0));

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}, 500);

export default function App() {
  const [viewState, setViewState] = useState(getParamsFromUrl());

  const handleViewStateChange = useCallback(({ viewState }) => {
    setViewState(viewState);
    updateUrl(viewState);
  }, []);

  const { dataUrl, resolution, elevationScale, colorMaxVal } = useMemo(() => {
    const z = viewState.zoom;
    const res = getResolutionForZoom(z);
    const settings = RESOLUTION_SETTINGS[res];

    return {
      dataUrl: settings.dataUrl,
      resolution: res,
      elevationScale: settings.elevationScale,
      colorMaxVal: settings.colorMaxVal
    };
  }, [Math.floor(viewState.zoom)]);

  const layers = [
    new H3HexagonLayer({
      id: `h3-layer-${resolution}`,
      data: dataUrl,
      loaders: [ParquetLoader],

      pickable: true,
      wireframe: false,
      filled: true,
      extruded: true,
      coverage: HEXAGON_COVERAGE,

      material: MATERIAL_SETTINGS,

      getHexagon: d => d.h3_index,

      getElevation: d => Number(d.value),

      getFillColor: d => {
        const val = Number(d.value);
        // colorContinuousに配列を渡しても動作しないため、手動でマッピングする
        // Configで定義された青色グラデーション配列を使用
        const colors = COLOR_SCALE_TYPE;
        const ratio = Math.min(val / colorMaxVal, 1.0);

        // 配列のインデックスにマッピング
        const index = Math.floor(ratio * (colors.length - 1));

        // 安全策: indexが範囲外にならないように
        const safeIndex = Math.max(0, Math.min(index, colors.length - 1));

        return colors[safeIndex];
      },

      elevationScale: elevationScale,

      transitions: {
        getFillColor: 1000,
        getElevation: 1000
      }
    })
  ];

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      layers={layers}
      effects={[lightingEffect]}
      style={{ width: '100vw', height: '100vh' }}
      views={new MapView({
        id: 'map',
        controller: true,
        ...MAP_VIEW_SETTINGS
      })}
      getTooltip={({ object }) => object && {
        html: `<div style="padding: 4px; color: white;"><b>Population:</b> ${object.value}</div>`,
        style: {
          backgroundColor: '#333',
          fontSize: '0.8em',
          borderRadius: '4px'
        }
      }}
    >
      <Map
        mapLib={maplibregl}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      />
    </DeckGL>
  );
}
