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
    constructor(container, mapDescription, resolve)
    {
        this._id = mapDescription.id;
        this._source = mapDescription.source;
        this._describes = mapDescription.describes;
        this._mapNumber = mapDescription.serialNumber;
        this._resolve = resolve;

        this._idToAnnotation = new Map();
        this._urlToAnnotation = new Map();
        this._rawAnnotations = mapDescription.annotations;
        for (const [featureId, annotation] of Object.entries(mapDescription.annotations)) {
            const ann = parser.parseAnnotation(annotation.annotation);
            if ('error' in annotation && !('error' in ann)) {
                ann.error = annotation.error;
            }
            ann.layer = annotation.layer;
            this.addAnnotation_(featureId, ann);
        }

        // Set base of source URLs in map's style

        for (const [id, source] of Object.entries(mapDescription.style.sources)) {
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

        this._options = mapDescription.options;

        this._map = new mapboxgl.Map({
            style: mapDescription.style,
            container: container,
            attributionControl: false
        });

        this._map.setRenderWorldCopies(false);

        if ('maxzoom' in mapDescription.options) {
            this._map.setMaxZoom(mapDescription.options.maxzoom);
        }

        if (mapDescription.options.fullscreenControl === true) {
            this._map.addControl(new mapboxgl.FullscreenControl());
        }

        this._map.addControl(new mapboxgl.NavigationControl({showCompass: false}));
        this._map.dragRotate.disable();
        this._map.touchZoomRotate.disableRotation();

        // Finish initialisation when all sources have loaded

        this._userInteractions = null;
        this._map.on('load', this.finalise_.bind(this));
    }

    finalise_()
    //=========
    {
        // Layers have now loaded so finish setting up

        this._userInteractions = new UserInteractions(this, ui => {
            if ('state' in this._options) {
                // This is to ensure the layer switcher has been fully initialised...
                setTimeout(() => {
                    ui.setState(this._options.state);
                    this._resolve(this);
                }, 200);
            } else {
                this._resolve(this);
            }
        });
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

    get uniqueId()
    //============
    {
        return `${this._id}-${this._mapNumber}`;
    }

    get activeLayerNames()
    //====================
    {
        return this._userInteractions.activeLayerNames;
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

    get selectedFeatureLayerName()
    //============================
    {
        return this._userInteractions.selectedFeatureLayerName;
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

    getAnnotation(featureId)
    //======================
    {
        return this._idToAnnotation.get(featureId);
    }

    annotationUrl(ann)
    //================
    {
        return `${this._source}/${ann.layer}/${ann.id}`;
    }

    addAnnotation_(featureId, ann)
    //============================
    {
        const url = this.annotationUrl(ann);
        ann.url = url;
        ann.featureId = featureId;
        this._idToAnnotation.set(featureId, ann);
        this._urlToAnnotation.set(url, ann);
    }

    delAnnotation_(ann)
    //=================
    {
        const url = this.annotationUrl(ann);
        this._idToAnnotation.delete(ann.featureId);
        this._urlToAnnotation.delete(url);
    }

    uniqueAnnotation(ann)
    //===================
    {
        const url = this.annotationUrl(ann);
        return !this._urlToAnnotation.has(url);
    }

    async setAnnotation(featureId, ann)
    //=================================
    {
        let updateAnnotations = true;
        const mapFeature = utils.mapFeature(ann.layer, featureId);
        if (featureId in this._rawAnnotations) {
            if (ann.text === '') {
                this.delAnnotation_(ann);
                delete this._rawAnnotations[featureId];
                this._map.removeFeatureState(mapFeature, "annotated");
            } else if (ann.text !== this._rawAnnotations[featureId].annotation) {
                if (ann.layer !== this._rawAnnotations[featureId].layer) {
                    console.log(`Annotation layer mismatch: ${ann} and ${this._rawAnnotations[featureId]}`);
                }
                const oldAnn = this.getAnnotation(featureId);
                if (oldAnn
                 && oldAnn.id !== ann.id
                 && oldAnn.error !== 'duplicate-id') {
                    const url = this.annotationUrl(oldAnn);
                    this._urlToAnnotation.delete(url);
                }
                this.addAnnotation_(featureId, ann);
                this._rawAnnotations[featureId].annotation = ann.text;
            } else {
                updateAnnotations = false;
            }
        } else {
            if (ann.text !== '') {
                this.addAnnotation_(featureId, ann);
                this._rawAnnotations[featureId] = {
                    annotation: ann.text,
                    layer: ann.layer
                }
                this._map.setFeatureState(mapFeature, { "annotated": true });
            } else {
                updateAnnotations = false;
            }
        }

        if ('error' in ann) {
            this._rawAnnotations[featureId].error = ann.error;
            this._map.setFeatureState(mapFeature, { "annotation-error": true });
        } else {
            delete this._rawAnnotations[featureId].error;
            this._map.removeFeatureState(mapFeature, "annotation-error");
        }

        if (updateAnnotations) {
            const postAnnotations = await fetch(mapEndpoint(`flatmap/${this.id}/annotations`), {
                headers: { "Content-Type": "application/json; charset=utf-8" },
                method: 'POST',
                body: JSON.stringify(this._rawAnnotations)
            });
            if (!postAnnotations.ok) {
                const errorMsg = `Unable to update annotations for '${this.id}' map`;
                console.log(errorMsg);
                alert(errorMsg);
            }
        }
    }

    resize()
    //======
    {
        // Resize our map

        this._map.resize();
    }

    mapLayerId(name)
    //==============
    {
        return `${this.uniqueId}/${name}`;
    }

    getIdentifier()
    //=============
    {
        // Return identifiers for reloading the map

        return {
            describes: this._describes,
            source: this._source
        };
    }

    getState()
    //========
    {
        return (this._userInteractions !== null) ? this._userInteractions.getState() : {};
    }

    setState(state)
    //=============
    {
        if (this._userInteractions !== null) {
            this._userInteractions.setState(state);
        }
    }
}

//==============================================================================

export class MapManager
{
    constructor()
    {
        this._maps = null;
        this._mapNumber = 0;
    }

    latestMap_(mapDescribes)
    //======================
    {
        let latestMap = null;
        let lastCreatedTime = '';
        for (const map of this._maps) {
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

    lookupMap_(identifier)
    //====================
    {
        let mapDescribes = null;
        if (typeof identifier === 'object') {
            if ('source' in identifier) {
                const flatmap = this.latestMap_(identifier.source);
                if (flatmap !== null) {
                    return flatmap;
                }
            }
            if ('describes' in identifier) {
                mapDescribes = identifier.describes;
            }
        } else {
            mapDescribes = identifier;
        }
        return this.latestMap_(mapDescribes);
    }

    findMap_(identifier)
    //==================
    {
        return new Promise((resolve, reject) => {
            if (this._maps === null) {
                // Find what maps we have available
                fetch(mapEndpoint(), {
                    headers: { "Accept": "application/json; charset=utf-8" },
                    method: 'GET'
                }).then(query => {
                    if (query.ok) {
                        return query.json();
                    } else {
                        reject(new Error(`Cannot access ${mapEndpoint()}`));
                    }
                }).then(maps => {
                     this._maps = maps;
                     resolve(this.lookupMap_(identifier));
                });
            } else {
                resolve(this.lookupMap_(identifier));
            }
        });
    }

    loadMap(identifier, container, options={})
    //========================================
    {
        return new Promise((resolve, reject) => {
            this.findMap_(identifier)
            .then(
                map => {
                    if (map === null) {
                        reject(new Error(`Unknown map for ${JSON.stringify(identifier)}`));
                    };
                    return map;
                },
                err => {
                    reject(err);
                }
            ).then(map => {
                // Load the maps index file

                fetch(mapEndpoint(`flatmap/${map.id}/`), {
                    headers: { "Accept": "application/json; charset=utf-8" },
                    method: 'GET'
                }).then(getIndex => {
                    if (!getIndex.ok) {
                        reject(new Error(`Missing index file for map '${map.id}'`));
                    }
                    return getIndex.json();
                }).then(mapOptions => {
                    // Set the map's options
                    if (map.id !== mapOptions.id) {
                        reject(new Error(`Map '${map.id}' has wrong ID in index`));
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

                    fetch(mapEndpoint(`flatmap/${map.id}/style`), {
                        headers: { "Accept": "application/json; charset=utf-8" },
                        method: 'GET'
                    }).then(getStyle => {
                        if (!getStyle.ok) {
                            reject(new Error(`Missing style file for map '${map.id}'`));
                        }
                        return getStyle.json();
                    }).then(mapStyle => {
                        // Get the map's annotations

                        fetch(mapEndpoint(`flatmap/${map.id}/annotations`), {
                            headers: { "Accept": "application/json; charset=utf-8" },
                            method: 'GET'
                        }).then(getAnnotations => {
                            if (!getAnnotations.ok) {
                                reject(new Error(`Missing annotations for map '${map.id}'`));
                            }
                            return getAnnotations.json();
                        }).then(annotations => {

                            // Display the map

                            this._mapNumber += 1;
                            const flatmap = new FlatMap(container, {
                                id: map.id,
                                source: map.source,
                                describes: map.describes,
                                style: mapStyle,
                                options: mapOptions,
                                annotations: annotations,
                                serialNumber: this._mapNumber
                            }, resolve);

                            return flatmap;
                        });
                    });
               });
            });
        });
    }
}

//==============================================================================
