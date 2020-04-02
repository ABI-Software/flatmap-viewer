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

// Load our stylesheet last so we can overide styling rules

import '../static/flatmap-viewer.css';

//==============================================================================

import {mapEndpoint} from './endpoints.js';
import {SearchIndex} from './search.js';
import {UserInteractions} from './interactions.js';

import * as images from './images.js';
import * as utils from './utils.js';

//==============================================================================

class FlatMap
{
   /**
    * Maps are not created directly but instead are created and loaded by
    * :meth:`MapManager.LoadMap`.
    */
    constructor(container, mapDescription, resolve)
    {
        this._id = mapDescription.id;
        this._source = mapDescription.source;
        this._created = mapDescription.created;
        this._describes = mapDescription.describes;
        this._mapNumber = mapDescription.number;
        this._callback = mapDescription.callback;
        this._options = mapDescription.options;
        this._resolve = resolve;

        if (this.options.searchable) {
            this._searchIndex = new SearchIndex(this);
        }

        this._idToAnnotation = new Map();
        this._metadata = mapDescription.metadata;
        for (const [featureId, metadata] of Object.entries(mapDescription.metadata)) {
            const ann = {};
            if ('error' in metadata && !('error' in ann)) {
                ann.error = metadata.error;
            }
            ann.id = featureId;
            ann.label = metadata.label;
            ann.layer = metadata.layer;
            ann.models = metadata.models;
            ann.queryable = 'geometry' in metadata
                          && metadata.geometry.includes('Polygon');
            ann.text = metadata.annotation;
            this.addAnnotation_(featureId, ann);
            if (this.options.searchable) {
                this._searchIndex.indexMetadata(featureId, metadata);
            }
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

        // Ensure rounded background image (for feature labels) is loaded

        if (!('images' in mapDescription.options)) {
            mapDescription.options.images = [];
        }

        mapDescription.options.images.push({
            id: 'rounded-background',
            url: images.ROUNDED_RECT,
            options: {
                content: [3, 3, 13, 13],
                stretchX: [[7, 9]],
                stretchY: [[7, 9]]
            }
        });

        // Set options for the Mapbox map

        const mapboxOptions = {
            style: mapDescription.style,
            container: container,
            attributionControl: false
        };

        if ('debug' in mapDescription.options) {
            mapboxOptions.hash = true;
        }
        if ('max-zoom' in mapDescription.options) {
            mapboxOptions.maxZoom = mapDescription.options['max-zoom'];
        }
        if ('min-zoom' in mapDescription.options) {
            mapboxOptions.minZoom = mapDescription.options['min-zoom'];
        }
        if ('zoom' in mapDescription.options) {
            mapboxOptions.zoom = mapDescription.options['zoom'];
        }

        // Create the map

        this._map = new mapboxgl.Map(mapboxOptions);

        // Don't wrap around at +/-180 degrees

        this._map.setRenderWorldCopies(false);

        // Do we want a fullscreen control?

        if (mapDescription.options.fullscreenControl === true) {
            this._map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        }

        // Add navigation controls and disable rotation

        this._map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'bottom-right');
        this._map.dragRotate.disable();
        this._map.touchZoomRotate.disableRotation();

        // Finish initialisation when all sources have loaded

        this._userInteractions = null;
        this._map.on('load', this.finalise_.bind(this));
    }

    async finalise_()
    //===============
    {
        // Load any images required by the map

        for (const image of this._options.images) {
            await this.addImage(image.id, image.url, '', image.options);
        }

        // Layers have now loaded so finish setting up

        const flatmap = this;
        this._userInteractions = new UserInteractions(this, ui => {
            if ('state' in flatmap._options) {
                // This is to ensure the layer switcher has been fully initialised...
                setTimeout(() => {
                    ui.setState(flatmap._options.state);
                    flatmap._resolve(flatmap);
                }, 200);
            } else {
                flatmap._resolve(flatmap);
            }
        });
    }

    /**
     * Load images and patterns/textures referenced in style rules.
     */
    loadImage_(url)
    //=============
    {
        return new Promise((resolve, reject) => {
            this._map.loadImage(url, (error, image) => {
                if (error) reject(error);
                else resolve(image);
            });
        });
    }

    loadEncodedImage_(encodedImageUrl)
    //================================
    {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = encodedImageUrl;
            image.onload = (e) => resolve(e.target);
        });
    }

    async addImage(id, path, baseUrl, options={})
    //===========================================
    {
        if (!this._map.hasImage(id)) {
            const image = await (path.startsWith('data:image') ? this.loadEncodedImage_(path)
                                                               : this.loadImage_(path.startsWith('/') ? this.addUrlBase_(path)
                                                                                                      : new URL(path, baseUrl)));
            this._map.addImage(id, image, options);
        }
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

    /**
     * The taxon identifier of the species described by the map.
     *
     * @type string
     */
    get describes()
    //=============
    {
        return this._describes;
    }

    /**
     * The map's creation time.
     *
     * @type string
     */
    get created()
    //===========
    {
        return this._created;
    }

    /**
     * The map's id as specified at generation time.
     *
     * @type string
     */
    get id()
    //======
    {
        return this._id;
    }

    /**
     * A unique identifier for the map within the viewer.
     *
     * @type string
     */
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

    get annotations()
    //===============
    {
        return this._idToAnnotation;
    }

    addAnnotation_(featureId, ann)
    //============================
    {
        ann.featureId = featureId;
        this._idToAnnotation.set(featureId, ann);
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

    get options()
    //===========
    {
        return this._options;
    }

    get searchIndex()
    //===============
    {
        return this._options.searchable ? this._searchIndex : null;
    }

    get selectedFeatureLayerName()
    //============================
    {
        return this._userInteractions.selectedFeatureLayerName;
    }

    callback(type, features, ...args)
    //===============================
    {
        if (this._callback) {
            return this._callback(type, features, ...args);
        }
    }

    fitBounds()
    //=========
    {
        if ('bounds' in this._options) {
            this._map.fitBounds(this._options['bounds'])
        }
    }

    modelsForFeature(featureId)
    //=========================
    {
        const ann = this._idToAnnotation.get(featureId);
        return ann ? ann.models : [];
    }


    {
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

    clearResults()
    //============
    {
        if (this._userInteractions !== null) {
            this._userInteractions.clearResults();
        }
    }

    zoomToFeatures(featureIds)
    //========================
    {
        if (this._userInteractions !== null) {
            this._userInteractions.zoomToFeatures(featureIds);
        }
    }
}

//==============================================================================

/**
 * A manager for FlatMaps.
 * @example
 * const mapManager = new MapManger();
 */
export class MapManager
{
    /* Create a MapManager */
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
            if (mapDescribes === map.describes
             || mapDescribes === map.id
             || mapDescribes === map.source) {
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
        return new Promise(async(resolve, reject) => {
            if (this._maps === null) {
                // Find what maps we have available
                const response = await fetch(mapEndpoint(), {
                    headers: { "Accept": "application/json; charset=utf-8" },
                    method: 'GET'
                });
                if (!response.ok) {
                    throw new Error(`Cannot access ${mapEndpoint()}`);
                }
                this._maps = await response.json();
                resolve(this.lookupMap_(identifier));
            } else {
                resolve(this.lookupMap_(identifier));
            }
        });
    }

   /**
    * Load and display a FlatMap.
    *
    * @arg identifier {string|Object} A string or object identifying the map to load. If a string its
    *                                 value can be either the map's ``id``, assigned at generation time,
    *                                 or a taxon identifier of the species that the map represents. The
    *                                 latest version of a map is loaded unless it has been identified
    *                                 by ``source`` (see below).
    * @arg identifier.describes {string} The taxon identifier of the map. This is specified as metadata
    *                                    in the map's source file.)
    * @arg identifier.source {string} The URL of the source file from which the map has
    *                                 been generated. If given then this exact map will be
    *                                 loaded.
    * @arg container {string} The id of the HTML container in which to display the map.
    * @arg callback {function(string, Object)} A callback function, invoked when events occur with the map. The
    *                                          first parameter gives the type of event, the second provides
    *                                          details about the feature(s) the event is for.
    * @arg options {Object} Configurable options for the map.
    * @arg options.debug {boolean} Enable debugging mode (currently only shows the map's
    *                              position in the web page's URL).
    * @arg options.featureInfo {boolean} Show information about features as a tooltip. The tooltip is active
    *                                    on highlighted features and, for non-highlighted features, when the
    *                                    ``info`` control is enabled. More details are shown in debug mode.
    * @arg options.searchable {boolean} Add a control to search for features on a map.
    * @example
    * const humanMap1 = mapManager.loadMap('humanV1', 'div-1');
    *
    * const humanMap2 = mapManager.loadMap('NCBITaxon:9606', 'div-2');
    *
    * const humanMap3 = mapManager.loadMap({describes: 'NCBITaxon:9606'}, 'div-3');
    *
    * const humanMap4 = mapManager.loadMap(
    *                     {source: 'https://models.physiomeproject.org/workspace/585/rawfile/650adf9076538a4bf081609df14dabddd0eb37e7/Human_Body.pptx'},
    *                     'div-4');
    */
    loadMap(identifier, container, callback, options={})
    //==================================================
    {
        return new Promise(async(resolve, reject) => {
            try {
                const map = await this.findMap_(identifier);
                if (map === null) {
                    throw new Error(`Unknown map for ${JSON.stringify(identifier)}`);
                };
                // Load the maps index file (its options)

                const optionsResponse = await fetch(mapEndpoint(`flatmap/${map.id}/`), {
                    headers: { "Accept": "application/json; charset=utf-8" },
                    method: 'GET'
                });
                if (!optionsResponse.ok) {
                    throw new Error(`Missing index file for map '${map.id}'`);
                }
                const mapOptions = await optionsResponse.json();

                if (map.id !== mapOptions.id) {
                    throw new Error(`Map '${map.id}' has wrong ID in index`);
                }

                // Set the map's options

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

                const styleResponse = await fetch(mapEndpoint(`flatmap/${map.id}/style`), {
                    headers: { "Accept": "application/json; charset=utf-8" },
                    method: 'GET'
                });
                if (!styleResponse.ok) {
                    throw new Error(`Missing style file for map '${map.id}'`);
                }
                const mapStyle = await styleResponse.json();

                // Get the map's metadata

                const metadataResponse = await fetch(mapEndpoint(`flatmap/${map.id}/metadata`), {
                    headers: { "Accept": "application/json; charset=utf-8" },
                    method: 'GET'
                });
                if (!metadataResponse.ok) {
                    reject(new Error(`Missing metadata for map '${map.id}'`));
                }
                const metadata = await metadataResponse.json();

                // Display the map

                this._mapNumber += 1;
                const flatmap = new FlatMap(container, {
                        id: map.id,
                        source: map.source,
                        describes: map.describes,
                        style: mapStyle,
                        options: mapOptions,
                        metadata: metadata,
                        number: this._mapNumber,
                        callback: callback
                    },
                    resolve);

                return flatmap;

            } catch (err) {
                reject(err);
            }
        });
    }
}

//==============================================================================
