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

import {QueryInterface} from './query.js';
import {UserInteractions} from './interactions.js';

import * as utils from './utils.js';

//==============================================================================

const queryInterface = new QueryInterface();

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
    constructor(htmlElementId, map)
    {
        this._id = map.id;

        this._annotations = map.annotations;

        // Set base of source URLs in map's style

        for (const [id, source] of Object.entries(map.style.sources)) {
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

        this._hasBackground = ('background' in map.style.sources);

        this._options = map.options;

        this._map = new mapboxgl.Map({
            style: map.style,
            container: htmlElementId
        });

        /*
        this._map.addControl(new mapboxgl.AttributionControl({
            compact: true,
            customAttribution: "\u00a9 Auckland Bioengineering Institute"
        }));
        */

        this._map.setRenderWorldCopies(false);

        if ('maxzoom' in map.options) {
            this._map.setMaxZoom(map.options.maxzoom);
        }

        if (map.options.fullscreenControl === true) {
            this._map.addControl(new mapboxgl.FullscreenControl());
        }

        this._map.addControl(new mapboxgl.NavigationControl({showCompass: false}));
        this._map.dragRotate.disable();
        this._map.touchZoomRotate.disableRotation();


        // Finish initialisation when all sources have loaded

        this._userInteractions = null;
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
        return this._userInteractions.activeLayerId;
    }

    get annotatable()
    //===============
    {
        return this._options.annotatable === true;
    }

    get annotations()
    //===============
    {
        return this._annotations;
    }

    get hasBackground()
    //=================
    {
        return this._hasBackground;
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

    annotationAbout(featureId)
    //========================
    {
        if (featureId in this._annotations) {
            return this._annotations[featureId];
        }
        return null;
    }

    hasAnnotationAbout(featureId)
    //===========================
    {
        return featureId in this._annotations;
    }

    async setAnnotationAbout(featureId, annotation)
    //=============================================
    {
        const feature = {
            id: featureId.split('-')[1],
            source: "features",
            sourceLayer: annotation.layer
        };
        let updateAnnotations = true;
        if (featureId in this._annotations) {
            if (annotation.annotation === '') {
                delete this._annotations[featureId];
                this._map.removeFeatureState(feature, "annotated");
            } else {
                if (this._annotations[featureId].annotation === annotation.annotation) {
                    updateAnnotations = false;
                }
                this._annotations[featureId] = annotation;
            }
        } else if (annotation.annotation !== '') {
            this._map.setFeatureState(feature, { "annotated": true });
            this._annotations[featureId] = annotation;
        } else {
            updateAnnotations = false;
        }

        if (updateAnnotations) {
            const postAnnotations = await fetch(utils.makeUrlAbsolute(`flatmap/${this.id}/annotations`), {
                headers: { "Content-Type": "application/json; charset=utf-8" },
                method: 'POST',
                body: JSON.stringify(this._annotations)
            });
            if (!postAnnotations.ok) {
                const errorMsg = `Unable to update annotations for '${this.id}' map`;
                console.log(errorMsg);
                alert(errorMsg);
            }
        }
    }

    finalise_()
    //=========
    {
        // Layers have now loaded so finish setting up

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

export async function loadMap(mapSource, htmlElementId, options={})
{
    // Find what maps we have available

    const mapsQuery = await fetch(utils.makeUrlAbsolute('flatmap/'), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        method: 'GET'
    });
    if (!mapsQuery.ok) {
        showError('Error requesting flatmaps...');
        return null;
    }
    let mapId = null;
    const maps = await mapsQuery.json();
    for (const map of maps) {
        if (map.source === mapSource) {
            mapId = map.id;
            break;
        }
    }
    if (!mapId) {
        showError(htmlElementId, `Unknown map '${mapSource}'`);
        return null;
    }

    // Load the maps index file

    const getIndex = await fetch(utils.makeUrlAbsolute(`flatmap/${mapId}/`), {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });
    if (!getIndex.ok) {
        showError(htmlElementId, `Missing index file for map '${mapId}'`);
        return null;
    }

    // Set the map's options

    const mapOptions = await getIndex.json();
    if (mapId !== mapOptions.id) {
        showError(htmlElementId, `Map '${mapId}' has wrong ID in index`);
        return null;
    }
    for (const [name, value] of Object.entries(options)) {
        mapOptions[name] = value;
    }

    // Set layer data if the layer just has an id specified

    for (let n = 0; n < mapOptions.layers.length; ++n) {
        const layer = mapOptions.layers[n];
        if (typeof layer === 'string') {
            mapOptions.layers[n] = {
                id: layer,
                description: layer.charAt(0).toUpperCase() + layer.slice(1),
                selectable: true
            };
        }
    }

    // Get the map's style file

    const getStyle = await fetch(utils.makeUrlAbsolute(`flatmap/${mapId}/style`), {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });
    if (!getStyle.ok) {
        showError(htmlElementId, `Missing style file for map '${mapId}'`);
        return null;
    }
    const mapStyle = await getStyle.json();

    // Get the map's annotations

    const getAnnotations = await fetch(utils.makeUrlAbsolute(`flatmap/${mapId}/annotations`), {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });
    if (!getAnnotations.ok) {
        showError(htmlElementId, `Missing annotations for map '${mapId}'`);
        return null;
    }
    const annotations = await getAnnotations.json();

    // Display the map

    return new FlatMap(htmlElementId, {
        id: mapId,
        source: mapSource,
        style: mapStyle,
        options: mapOptions,
        annotations: annotations
    });
}

//==============================================================================
