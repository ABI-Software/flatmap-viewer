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

import {loadJSON, mapEndpoint} from './endpoints.js';
import {NavigationControl} from './controls.js';
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
        this._details = mapDescription.details;
        this._source = mapDescription.source;
        this._created = mapDescription.created;
        this._describes = mapDescription.describes;
        this._mapNumber = mapDescription.number;
        this._callback = mapDescription.callback;
        this._layers = mapDescription.layers;
        this._options = mapDescription.options;
        this._pathways = mapDescription.pathways;
        this._resolve = resolve;
        this._map = null;

        if (this.options.searchable) {
            this._searchIndex = new SearchIndex(this);
        }

        this._idToAnnotation = new Map();
        this._modelToFeatures = new Map();
        for (const [featureId, metadata] of Object.entries(mapDescription.metadata)) {
            this.addAnnotation_(featureId, metadata);
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
                const tiles = [];
                for (const tileUrl of source.tiles) {
                    tiles.push(this.addUrlBase_(tileUrl));
                }
                source.tiles = tiles;
            }
        }

        // Ensure rounded background images (for feature labels) are loaded

        if (!('images' in mapDescription.options)) {
            mapDescription.options.images = [];
        }
        for (const image of images.LABEL_BACKGROUNDS) {
            let found = false;
            for (const im of mapDescription.options.images) {
                if (image.id === im.id) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                mapDescription.options.images.push(image);
            }
        }

        // Set options for the Mapbox map

        const mapboxOptions = {
            style: mapDescription.style,
            container: container,
            attributionControl: false
        };

        if ('max-zoom' in mapDescription.options) {
            mapboxOptions.maxZoom = mapDescription.options['max-zoom'];
        }
        if ('min-zoom' in mapDescription.options) {
            mapboxOptions.minZoom = mapDescription.options['min-zoom'];
        }

        // Only show location in address bar when debugging

        mapboxOptions.hash = (mapDescription.options.debug === true);

        // Create the map

        this._map = new mapboxgl.Map(mapboxOptions);

        // Show tile boundaries if debugging

        if (mapDescription.options.debug === true) {
            this._map.showTileBoundaries = true;
        }

        // Don't wrap around at +/-180 degrees

        this._map.setRenderWorldCopies(false);

        // Do we want a fullscreen control?

        if (mapDescription.options.fullscreenControl === true) {
            this._map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        }

        // Disable map rotation

        this._map.dragRotate.disable();
        this._map.touchZoomRotate.disableRotation();

        // Add navigation controls if option set

        if (mapDescription.options.navigationControl) {
            const value = mapDescription.options.navigationControl;
            const position = ((typeof value === 'string')
                           && (['top-left', 'top-right', 'bottom-right', 'bottom-left'].indexOf(value) >= 0))
                           ? value : 'bottom-right';
            this._map.addControl(new NavigationControl(this), position);
        }

        // Finish initialisation when all sources have loaded

        this._userInteractions = null;
        this._map.on('load', this.finalise_.bind(this));

        this._initialState = null;
        this._map.on('idle', () => {
            if (this._initialState === null) {
                this._initialState = this.getState();
            }
        });
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

    resetMap()
    //========
    {
        if (this._initialState !== null) {
            this.setState(this._initialState);
        }
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
     * Full details about the map as returned from the map server
     *
     * @type Object
     */
    get details()
    //===========
    {
        return this._details;
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

    annotation(featureId)
    //===================
    {
        return this._idToAnnotation.get(featureId);
    }

    addAnnotation_(featureId, ann)
    //============================
    {
        ann.featureId = featureId;
        this._idToAnnotation.set(featureId, ann);
        if ('models' in ann) {
            const modelId = ann.models;
            if (modelId) {
                const features = this._modelToFeatures.get(modelId);
                if (features) {
                    features.push(featureId);
                } else {
                    this._modelToFeatures.set(modelId, [featureId]);
                }
            }
        }
    }

    featuresForModel(modelId)
    //=======================
    {
        const features = this._modelToFeatures.get(modelId);
        return features ? features : [];
    }

    modelForFeature(featureId)
    //========================
    {
        const ann = this._idToAnnotation.get(featureId);
        return (ann && 'models' in ann) ? ann.models : null;
    }

    get layers()
    //==========
    {
        return this._layers;
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

    get pathways()
    //============
    {
        return this._pathways;
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

    setInitialPosition()
    //==================
    {
        if ('bounds' in this._options) {
            this._map.fitBounds(this._options['bounds']);
        }
        if ('center' in this._options) {
            this._map.setCenter(this._options['center']);
        }
        if ('zoom' in this._options) {
            this._map.setZoom(this._options['zoom']);
        }

    }

    annotationEvent(eventType, featureId)
    //===================================
    {
        const ann = this._idToAnnotation.get(featureId);
        this.callback(eventType, {
            id: featureId,
            dataset: ann.dataset,
            scaffold: ann.scaffold
        });
    }

    featureEvent(eventType, feature)
    //==============================
    {
        const properties = feature.properties;
        this.callback(eventType, {
            id: properties.id,
            models: properties.models,
            label: properties.label,
            dataset: properties.dataset,
            scaffold: properties.scaffold
        });
    }

    close()
    //=====
    {
        if (this._map) {
            this._map.remove();
            this._map = null;
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

    showPopup(featureId, content, options)
    //====================================
    {
        if (this._userInteractions !== null) {
            this._userInteractions.showPopup(featureId, content, options);
        }
    }

    clearSearchResults()
    //==================
    {
        if (this._userInteractions !== null) {
            this._userInteractions.clearSearchResults();
        }
    }

    showSearchResults(featureIds, padding=100)
    //========================================
    {
        if (this._userInteractions !== null) {
            this._userInteractions.showSearchResults(featureIds, padding);
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
    constructor(options={})
    {
        this._options = options;

        this._mapList = [];
        this._mapNumber = 0;

        this._initialisingMutex = new utils.Mutex();
        this._initialised = false;
    }

    async ensureInitialised_()
    //========================
    {
        return await this._initialisingMutex.dispatch(async () => {
            if (!this._initialised) {
                this._mapList = await loadJSON('');
                this._initialised = true;
            }
        });
    }

    allMaps()
    //=======
    {
        return new Promise(async(resolve, reject) => {
            await this.ensureInitialised_();
            const allMaps = {};
            for (const map of this._mapList) {
                allMaps[map.id] = map;
            }
            resolve(allMaps);
        });
    }

    latestMaps()
    //==========
    {
        return new Promise(async(resolve, reject) => {
            await this.ensureInitialised_();
            const latestMaps = {};
            for (const map of this._mapList) {
                const describes = ('describes' in map) ? map.describes : map.id;
                if (!(describes in latestMaps)) {
                    latestMaps[describes] = map;
                } else if ('created' in map) {
                    if (!('created' in latestMaps[describes])
                      || (latestMaps[describes].created < map.created)) {
                    latestMaps[describes] = map;
                    }
                }
            }
            resolve(latestMaps);
        });
    }

    findMap_(identifier)
    //==================
    {
        return new Promise(async(resolve, reject) => {
            await this.ensureInitialised_();
            resolve(this.lookupMap_(identifier));
        });
    }

    latestMap_(mapDescribes)
    //======================
    {
        let latestMap = null;
        let lastCreatedTime = '';
        for (const map of this._mapList) {
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
    * @arg options.debug {boolean} Enable debugging mode.
    * @arg options.fullscreenControl {boolean} Add a ``Show full screen`` button to the map.
    * @arg options.featureInfo {boolean} Show information about features as a tooltip. The tooltip is active
    *                                    on highlighted features and, for non-highlighted features, when the
    *                                    ``info`` control is enabled. More details are shown in debug mode.
    * @arg options.navigationControl {boolean} Add navigation controls (zoom buttons) to the map.
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

                // Load the maps index file

                const mapIndex = await loadJSON(`flatmap/${map.id}/`);
                if (map.id !== mapIndex.id) {
                    throw new Error(`Map '${map.id}' has wrong ID in index`);
                }

                const mapOptions = Object.assign({}, this._options, options);

                // If bounds are not specified in options then set them

                if (!('bounds' in options) && ('bounds' in mapIndex)) {
                    mapOptions['bounds'] = mapIndex['bounds'];
                }

                // Get details about the map's layers

                let mapLayers = [];
                if (!('version' in mapIndex) || mapIndex.version <= 1.0) {
                    for (const layer of mapIndex.layers) {
                        // Set layer data if the layer just has an id specified
                        if (typeof layer === 'string') {
                            mapLayers.push({
                                id: layer,
                                description: layer.charAt(0).toUpperCase() + layer.slice(1),
                                selectable: true
                            });
                        } else {
                            mapLayers.push(layer);
                        }
                    }
                } else {
                    mapLayers = await loadJSON(`flatmap/${map.id}/layers`);
                }

                // Get the map's style file

                const mapStyle = await loadJSON(`flatmap/${map.id}/style`);

                // Make sure the style has glyphs defined

                if (!('glyphs' in mapStyle)) {
                    mapStyle.glyphs = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';
                }

                // Get the map's pathways

                const pathways = await loadJSON(`flatmap/${map.id}/pathways`);

                // Get the map's metadata

                const metadata = await loadJSON(`flatmap/${map.id}/metadata`);

                // Display the map

                this._mapNumber += 1;
                const flatmap = new FlatMap(container, {
                        id: map.id,
                        details: mapIndex,
                        source: map.source,
                        describes: map.describes,
                        style: mapStyle,
                        options: mapOptions,
                        layers: mapLayers,
                        metadata: metadata,
                        number: this._mapNumber,
                        pathways: pathways,
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
