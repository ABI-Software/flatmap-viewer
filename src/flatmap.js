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

import {LayerManager} from './layers.js';
import {UserInteractions} from './interactions.js';

import * as utils from './utils.js';

//==============================================================================

function addUrlBase(url)
{
    if (url.startsWith('/')) {
        if (window.location.pathname.endsWith('/')) {
            return `${window.location.origin}${window.location.pathname}flatmap${url}`;
        } else {
            return `${window.location.origin}${window.location.pathname}/flatmap${url}`;
        }
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.log(`Invalid URL (${url}) in map's sources`);
    }
    return url;
}

//==============================================================================

class FlatMap
{
    constructor(htmlElementId, mapId, mapStyle, options, annotations)
    {
        this._id = mapId;
        this._annotations = annotations;

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

        this._map.setRenderWorldCopies(false);

        if ('maxzoom' in options) {
            this._map.setMaxZoom(options.maxzoom);
        }

        if (options.fullscreenControl !== false) {
            this._map.addControl(new mapboxgl.FullscreenControl());
        }

        this._map.addControl(new mapboxgl.NavigationControl({showCompass: false}));
        this._map.dragRotate.disable();
        this._map.touchZoomRotate.disableRotation();


        // Finish initialisation when all sources have loaded

        this._layerManager = null;

        this._userInteracions = null;

        this._map.on('load', this.finalise_.bind(this));
    }

    get id()
    //======
    {
        return this._id;
    }

    get activeLayerId()
    //=================
    {
        return this._layerManager.activeLayerId;
    }

    get annotations()
    //===============
    {
        return this._annotations;
    }

    get layers()
    //==========
    {
        return this._options.layers;
    }

    get map()
    //=======
    {
        return this._map;
    }

    get layerManager()
    //================
    {
        return this._layerManager;
    }

    annotationAbout(featureId)
    //========================
    {
        return this._annotations[featureId];
    }

    hasAnnotationAbout(featureId)
    //===========================
    {
        return featureId in this._annotations;
    }

    finalise_()
    //=========
    {
        // Manage our layers

        this._layerManager = new LayerManager(this)

        // Add a background layer if we have one

        if (this._hasBackground) {
            this._layerManager.addBackgroundLayer();
        }

        // Add the map's layers

        for (const layer of this.layers) {
            this._layerManager.addLayer(layer);
        }

        this._userInteractions = new UserInteractions(this);
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

export async function loadMap(mapId, htmlElementId, options={})
{
    const getIndex = await fetch(utils.makeUrlAbsolute(`flatmap/${mapId}/`), {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });

    if (!getIndex.ok) {
        showError(htmlElementId, `Missing index file for map '${mapId}'`);
        return null;
    }

    const mapOptions = await getIndex.json();
    if (mapId !== mapOptions.id) {
        showError(htmlElementId, `Map '${mapId}' has wrong ID in index`);
        return null;
    }

    for (const [name, value] of Object.entries(options)) {
        mapOptions[name] = value;
    }

    const getStyle = await fetch(utils.makeUrlAbsolute(`flatmap/${mapId}/style`), {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });

    if (!getStyle.ok) {
        showError(htmlElementId, `Missing style file for map '${mapId}'`);
        return null;
    }

    const mapStyle = await getStyle.json();

    const getAnnotations = await fetch(utils.makeUrlAbsolute(`flatmap/${mapId}/annotations`), {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });

    if (!getAnnotations.ok) {
        showError(htmlElementId, `Missing annotations for map '${mapId}'`);
        return null;
    }

    const annotations = await getAnnotations.json();

    return new FlatMap(htmlElementId, mapId, mapStyle, mapOptions, annotations);
}

//==============================================================================
