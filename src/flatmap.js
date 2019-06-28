/******************************************************************************

Flatmap viewer and annotation tool

Copyright (c) 2019  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

//==============================================================================

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

//==============================================================================

import {ImageLayer} from './styling.js';
import {LayerManager} from './layers.js';
import {UserInteractions} from './interactions.js';

import * as utils from './utils.js';

//==============================================================================

function addUrlBase(url)
{
    if (url.startsWith('/')) {
        if (window.location.pathname.endsWith('/')) {
            return `${window.location.origin}${window.location.pathname}${url.substr(1)}`;
        } else {
            return `${window.location.origin}${window.location.pathname}${url}`;
        }
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.log(`Invalid URL (${url}) in map's sources`);
    }
    return url;
}

//==============================================================================

class FlatMap
{
    constructor(htmlElementId, mapId, mapStyle, options)
    {
        this._id = mapId;

        // Set base of URLs in map's sources

        for (const [id, source] of Object.entries(mapStyle.sources)) {
            if (source.url) {
                source.url = addUrlBase(source.url);
            }
            if (source.tiles) {
                const tiles = []
                for (const tileUrl of source.tiles) {
                    tiles.push(addUrlBase(tileUrl));
                }
                source.tiles = tiles;
            }
        }

        this._hasBackground = ('background' in mapStyle.sources);

        this._options = options;

        this._map = new mapboxgl.Map({
            style: mapStyle,
            container: htmlElementId,
            hash: true
        });

        /*
        this._map.addControl(new mapboxgl.AttributionControl({
            compact: true,
            customAttribution: "\u00a9 Auckland Bioengineering Institute"
        }));
        */

        if ('maxzoom' in options.metadata) {
            this._map.setMaxZoom(Number(options.metadata.maxzoom));
        }

        this._map.addControl(new mapboxgl.FullscreenControl());

        this._map.addControl(new mapboxgl.NavigationControl({showCompass: false}));
        this._map.dragRotate.disable();
        this._map.touchZoomRotate.disableRotation();


        this._userInteractions = new UserInteractions(this._map);

        // Load map layers when all sources have loaded

        this._layerManager = new LayerManager(this._map)

        this._map.on('load', this.loadLayers_.bind(this));
    }

    get id()
    //======
    {
        return this._id;
    }

    loadLayers_()
    //===========
    {
        // Add a background layer if we have one

        if (this._hasBackground && this._map.isSourceLoaded('background')) {
            this._map.addLayer(ImageLayer.style('background', 'background'));
        }

        // Add map's layers

        for (const layer of this._options.layers) {
            this._layerManager.addLayer(layer);
        }
    }

    resize()
    //======
    {
        // Resize our map

        this._map.resize();
    }
}

//==============================================================================

function showError(htmlElementId, error)
{
    const container = document.getElementById(htmlElementId);
    container.style = 'text-align: center; color: red;';
    container.innerHTML = `<h3>${error}</h3`;
}

//==============================================================================

export async function loadMap(mapId, htmlElementId)
{
    const getIndex = await fetch(utils.makeUrlAbsolute(`${mapId}/`), {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });

    if (!getIndex.ok) {
        showError(htmlElementId, `Missing index file for map '${mapId}'`);
        return null;
    }

    const options = await getIndex.json();
    if (mapId !== options.id) {
        showError(htmlElementId, `Map '${mapId}' has wrong ID in index`);
        return null;
    }

    const getStyle = await fetch(utils.makeUrlAbsolute(`${mapId}/style`), {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });

    if (!getStyle.ok) {
        showError(htmlElementId, `Missing style file for map '${mapId}'`);
        return null;
    }

    const mapStyle = await getStyle.json();

    return new FlatMap(htmlElementId, mapId, mapStyle, options);
}

//==============================================================================
