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

import 'dat.gui/build/dat.gui.css';

//==============================================================================

// Load our stylesheet last so we can ovveride styling rules

import '../static/flatmaps.css';

//==============================================================================

import {mapEndpoint} from './endpoints.js';
import {parser} from './annotation.js';
import {QueryInterface} from './query.js';
import {UserInteractions} from './interactions.js';

import * as utils from './utils.js';

//==============================================================================

const queryInterface = new QueryInterface();

//==============================================================================

class FlatMap
{
    constructor(container, map)
    {
        this._id = map.id;

        this._idToAnnotation = new Map();
        this._urlToAnnotation = new Map();
        for (const [id, annotation] of Object.entries(map.annotations)) {
            const ann = parser.parseAnnotation(annotation.annotation);
            if ('error' in ann) {
                console.log(`Annotation error: ${ann.error} (${ann.text})`);
            } else {
                const feature = ann.id.substring(1);
                const url = `${map.source}/${annotation.layer}/${feature}`;
                ann.url = url;
                ann.featureId = id;
                ann.layer = annotation.layer;
                this._idToAnnotation.set(id, ann);
                this._urlToAnnotation.set(url, ann);
            }
        }

        // Set base of source URLs in map's style

        for (const [id, source] of Object.entries(map.style.sources)) {
            if (source.url) {
                source.url = this.addUrlBase_(source.url);
            }
            if (source.tiles) {
                const tiles = []
                for (const tileUrl of source.tiles) {
                    tiles.push(this.addUrlBase_(tileUrl));
                }
                source.tiles = tiles;
            }
        }

        this._options = map.options;

        this._map = new mapboxgl.Map({
            style: map.style,
            container: container,
            attributionControl: false
        });

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

    addUrlBase_(url)
    //==============
    {
        if (url.startsWith('/')) {
            return `${mapEndpoint()}flatmap/${this._id}${url}`; // We don't want embedded `{` and `}` characters escaped
        } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
            console.log(`Invalid URL (${url}) in map's sources`);
        }
        return url;
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
        return this._idToAnnotation;
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

    urlForFeature(featureId)
    //======================
    {
        const ann = this._idToAnnotation.get(featureId);
        return (ann) ? ann.url : null;
    }

    modelsForFeature(featureId)
    //=========================
    {
        const ann = this._idToAnnotation.get(featureId);
        if (ann
         && 'properties' in ann
         && 'models' in ann.properties) {
            return ann.properties.models;
        }
        return [];
    }

    featureIdForUrl(url)
    //==================
    {
        const ann = this._urlToAnnotation.get(url);
        return (ann) ? ann.featureId : null;
    }

    layerIdForUrl(url)
    //=================
    {
        const ann = this._urlToAnnotation.get(url);
        return (ann) ? ann.layer : null;
    }

    hasAnnotation(featureId)
    //======================
    {
        return this._idToAnnotation.has(featureId);
    }

    getAnnotation(featureId)
    //======================
    {
        return this._idToAnnotation.get(featureId);
    }

    annotationText(featureId)
    //========================
    {
        const ann = this._idToAnnotation.get(featureId);
        return (ann) ? ann.text : null;
    }

    async setAnnotationText(featureId, annotation)
    //============================================
    {
        const feature = utils.mapFeature(annotation.layer, featureId);
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
            const postAnnotations = await fetch(mapEndpoint(`${this.id}/annotations`), {
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

function showError(container, error)
{
    const domElement = (typeof container === 'string') ? document.getElementById(container)
                                                       : container;
    domElement.style = 'text-align: center; color: red;';
    domElement.innerHTML = `<h3>${error}</h3`;
}

//==============================================================================

export class MapManager
{
    constructor()
    {
        this._maps = null;
    }

    async findMap_(mapDescribes)
    //==========================
    {
        if (this._maps === null) {
            // Find what maps we have available
            const query = await fetch(mapEndpoint(), {
                headers: { "Accept": "application/json; charset=utf-8" },
                method: 'GET'
            });
            if (query.ok) {
                this._maps = await query.json();
            } else {
                showError('Error requesting flatmaps...');
            }
        }

        let latestMap = null;
        let lastCreatedTime = '';
        for (const map of this._maps) {  // But wait until response above...
            if (mapDescribes == map.describes || mapDescribes === map.source) {
                if ('created' in map) {
                    if (lastCreatedTime < map.created) {
                        lastCreatedTime = map.created;
                        latestMap = map;
                    }
                } else {
                    return map;
                }
            }
        }
        return latestMap;
    }

    async loadMap(mapDescribes, container, options={})
    //================================================
    {
        const map = await this.findMap_(mapDescribes);
        if (map === null) {
            showError(container, `Unknown map for '${mapDescribes}'`);
            return null;
        }

        // Load the maps index file

        const getIndex = await fetch(mapEndpoint(`flatmap/${map.id}/`), {
            headers: { "Accept": "application/json; charset=utf-8" },
            method: 'GET'
        });
        if (!getIndex.ok) {
            showError(container, `Missing index file for map '${map.id}'`);
            return null;
        }

        // Set the map's options

        const mapOptions = await getIndex.json();
        if (map.id !== mapOptions.id) {
            showError(container, `Map '${map.id}' has wrong ID in index`);
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

        const getStyle = await fetch(mapEndpoint(`flatmap/${map.id}/style`), {
            headers: { "Accept": "application/json; charset=utf-8" },
            method: 'GET'
        });
        if (!getStyle.ok) {
            showError(container, `Missing style file for map '${map.id}'`);
            return null;
        }
        const mapStyle = await getStyle.json();

        // Get the map's annotations

        const getAnnotations = await fetch(mapEndpoint(`flatmap/${map.id}/annotations`), {
            headers: { "Accept": "application/json; charset=utf-8" },
            method: 'GET'
        });
        if (!getAnnotations.ok) {
            showError(container, `Missing annotations for map '${map.id}'`);
            return null;
        }
        const annotations = await getAnnotations.json();

        // Display the map

        return new FlatMap(container, {
            id: map.id,
            source: map.source,
            style: mapStyle,
            options: mapOptions,
            annotations: annotations
        });
    }
}

//==============================================================================
