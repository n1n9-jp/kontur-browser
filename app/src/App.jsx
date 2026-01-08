import React, { useState, useCallback, useEffect } from 'react';
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
const PMTILES_URL = window.location.origin + '/data/jp.pmtiles'; // Absolute URL

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

const updateUrl = (viewState) => {
  const params = new URLSearchParams();
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

  const handleViewStateChange = useCallback(({ viewState }) => {
    setViewState(viewState);
    updateUrl(viewState);
  }, []);

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
        key={`h3-layer-${res}`}
        id={`h3-hexagons-${res}`}
        type="fill-extrusion"
        source="pmtiles-source"
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
          id="pmtiles-source"
          type="vector"
          url={`pmtiles://${PMTILES_URL}`}
          attribution="Kontur Population"
        >
          {layers}
        </Source>
      </Map>
    </DeckGL>
  );
}
