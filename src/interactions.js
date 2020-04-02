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

import {default as turfArea} from '@turf/area';
import {default as turfBBox} from '@turf/bbox';
import * as turf from '@turf/helpers';

//==============================================================================

import {ContextMenu} from './contextmenu.js';
import {InfoControl} from './info.js';
import {LayerManager} from './layers.js';
//import {QueryInterface} from './query.js';
import {SearchControl} from './search.js';

import * as utils from './utils.js';

//==============================================================================

function bounds(feature)
//======================
{
    // Find the feature's bounding box

    let bounds = ('bounds' in feature.properties) ? feature.properties.bounds
                                                  : feature.properties.bbox;
    if (bounds) {
        // Bounding box is defined in GeoJSON

        return JSON.parse(bounds);
    } else {
        // Get the bounding box of the current polygon. This won't neccessary
        // be the full feature because of tiling

        const polygon = turf.geometry(feature.geometry.type, feature.geometry.coordinates);
        return turfBBox(polygon);
    }
}

//==============================================================================

function expandBounds(bbox1, bbox2)
//=================================
{
    return [Math.min(bbox1[0], bbox2[0]), Math.min(bbox1[1], bbox2[1]),
            Math.max(bbox1[2], bbox2[2]), Math.max(bbox1[3], bbox2[3])
           ];
}

//==============================================================================

export class UserInteractions
{
    constructor(flatmap, userInterfaceLoadedCallback=null)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;
        this._userInterfaceLoadedCallback =  userInterfaceLoadedCallback;
//        this._queryInterface = new QueryInterface(flatmap.id);

        this._selectedFeature = null;
        this._highlightedFeatures = [];

        this._inQuery = false;
        this._modal = false;

        // Fit the map to our window

        flatmap.fitBounds();

        // Add a control to search annotations if option set

        if (flatmap.options.searchable) {
            this._map.addControl(new SearchControl(flatmap.searchIndex));
        }

        // Show information about features

        if (flatmap.options.featureInfo) {
            this._infoControl = new InfoControl(flatmap);
            this._map.addControl(this._infoControl);
            this._map.on('mousemove', e => this._infoControl.mouseMove(e));
        }

        // Manage our layers

        this._layerManager = new LayerManager(flatmap);

        // Add the map's layers

        // Layers have an id, either layer-N or an assigned name
        // Some layers might have a description. These are the selectable layers,
        // unless they are flagged as `no-select`
        // Selectable layers have opacity 0 unless active, in which case they have opacity 1.
        // `no-select` layers have opacity 0.5
        // Background layer has opacity 0.2

        const layersById = new Map();
        const layerBackgroundIds = [];
        for (const layer of flatmap.layers) {
            layer.backgroundLayers = [];
            layersById.set(layer.id, layer);
        }
        for (const layer of flatmap.layers) {
            if (layer.background_for) {
                const l = layersById.get(layer.background_for);
                l.backgroundLayers.push(layer);
                layerBackgroundIds.push(layer.id);
            }
        }
        for (const layer of flatmap.layers) {
            if (layerBackgroundIds.indexOf(layer.id) < 0) {
                this._layerManager.addLayer(layer);
            }
        }

        // Flag features that have annotations
        // Also flag those features that are models of something

        for (const [id, ann] of flatmap.annotations) {
            const feature = utils.mapFeature(ann.layer, id);
            this._map.setFeatureState(feature, { 'annotated': true });
            if ('error' in ann) {
                this._map.setFeatureState(feature, { 'annotation-error': true });
                console.log(`Annotation error, ${ann.layer}: ${ann.error} (${ann.text})`);
            }
        }

        // Display a context menu on right-click

        this._lastContextTime = 0;
        this._contextMenu = new ContextMenu(flatmap, this.contextMenuClosed_.bind(this));
        this._map.on('contextmenu', this.contextMenuEvent_.bind(this));

        // Display a context menu with a touch longer than 0.5 second

        this._lastTouchTime = 0;
        this._map.on('touchstart', (e) => { this._lastTouchTime = Date.now(); });
        this._map.on('touchend', (e) => {
            if (Date.now() > (this._lastTouchTime + 500)) {
                this.contextMenuEvent_(e);
            }
        });

        // Handle mouse click events

        this._map.on('click', this.clickEvent_.bind(this));

        if (this._userInterfaceLoadedCallback !== null) {
            this._userInterfaceLoadedCallback(this);
            this._userInterfaceLoadedCallback = null;
        }
    }

    layerSwitcherActiveCallback_(layerSwitcher)
    //=========================================
    {
        if (this._userInterfaceLoadedCallback !== null) {
            this._userInterfaceLoadedCallback(this);
            this._userInterfaceLoadedCallback = null;
        }
    }

    getState()
    //========
    {
        // Return the map's centre, zoom, and active layers
        // Can only be called when the map is fully loaded
        return {
            center: this._map.getCenter().toArray(),
            zoom: this._map.getZoom(),
            layers: this.activeLayerNames
        };
    }

    setState(state)
    //=============
    {
        // Restore the map to a saved state
        const options = {};
        if ('center' in state) {
            options['center'] = state.center;
        }
        if ('zoom' in state) {
            options['zoom'] = state.zoom;
            options['around'] = [0, 0];
        }
        if (Object.keys(options).length > 0) {
            this._map.jumpTo(options);
        }
    }

    get activeLayerNames()
    //====================
    {
        return this._layerManager.activeLayerNames;
    }

    get activeLayerIds()
    //==================
    {
        const mapLayers = [];
        for (const name of this._layerManager.activeLayerNames) {
            mapLayers.push(this._flatmap.mapLayerId(name));
        }
        return mapLayers;
    }

    activateLayer(layerId)
    //====================
    {
        this._layerManager.activate(layerId);
    }

    activateLayers(layerIds)
    //======================
    {
        for (const layerId of layerIds) {
            this.activateLayer(layerId);
        }
    }

    deactivateLayer(layerId)
    //======================
    {
        this._layerManager.deactivate(layerId);
    }

    deactivateLayers()
    //================
    {
        for (const layerId of this.activeLayerIds) {
            this.deactivateLayer(layerId);
        }
    }

    selectFeature_(feature)
    //=====================
    {
        this.unselectFeatures_(false);
        this._map.setFeatureState(feature, { 'selected': true });
        this._selectedFeature = feature;
    }

    unselectFeatures_(reset=true)
    //===========================
    {
        if (this._selectedFeature !== null) {
            this._map.removeFeatureState(this._selectedFeature, 'selected');
            if (reset) {
                this._selectedFeature = null;
            }
        }
    }

    get selectedFeatureLayerName()
    //============================
    {
        if (this._selectedFeature !== null) {
            const layerId = this._selectedFeature.layer.id;
            if (layerId.includes('-')) {
                return layerId.split('-').slice(0, -1).join('-');
            } else {
                return layerId;
            }
        }
        return null;
    }

    unhighlightFeatures_(reset=true)
    //==============================
    {
        for (const feature of this._highlightedFeatures) {
            this._map.removeFeatureState(feature, 'highlighted');
        }
        this._highlightedFeatures = [];
    }

    activeFeaturesAtEvent_(event)
    //===========================
    {
        // Get the features covering the event's point that are in the active layers

        return this._map.queryRenderedFeatures(event.point).filter(f => {
            return (this.activeLayerNames.indexOf(f.sourceLayer) >= 0)
                && ('id' in f.properties);
            }
        );
    }

    smallestAnnotatedPolygonFeature_(features)
    //========================================
    {
        // Get the smallest feature from a list of features

        let smallestArea = 0;
        let smallestFeature = null;
        for (const feature of features) {
            if (feature.geometry.type.includes('Polygon')
             && this._map.getFeatureState(feature)['annotated']) {
                const polygon = turf.geometry(feature.geometry.type, feature.geometry.coordinates);
                const area = turfArea(polygon);
                if (smallestFeature === null || smallestArea > area) {
                    smallestFeature = feature;
                    smallestArea = area;
                }
            }
        }
        return smallestFeature;
    }

    contextMenuEvent_(event)
    //======================
    {
        event.preventDefault();

        // Chrome on Android sends both touch and contextmenu events
        // so ignore duplicate

        if (Date.now() < (this._lastContextTime + 100)) {
            return;
        }
        this._lastContextTime = Date.now();

        const features = this.activeFeaturesAtEvent_(event);
        let feature = this.smallestAnnotatedPolygonFeature_(features);
        if (feature !== null) {
            const id = feature.properties.id;
            const ann = this._flatmap.getAnnotation(id);
            this.selectFeature_(feature);
            const items = [];
            if (ann) {
                if (ann.models.length > 0) {
                    items.push({
                        id: id,
                        prompt: 'Search for knowledge about node',
                        action: this.query_.bind(this, 'data')
                    });
                }
                if (this._layerManager.layerQueryable(ann.layer)) {
                    items.push({
                        id: id,
                        prompt: 'Find edges connected to node',
                        action: this.query_.bind(this, 'edges')
                    });
                    items.push({
                        id: id,
                        prompt: 'Find nodes and edges connected to node',
                        action: this.query_.bind(this, 'nodes')
                    });
                }
            }
            if (items.length) {
                items.push('-');
            }
            items.push({
                id: id,
                prompt: 'Zoom to...',
                action: this.zoomTo_.bind(this, feature)
            });
            if (items.length) {
                this._modal = true;
                this._contextMenu.show(event.lngLat, items);
                return;
            }
        }
    }

    contextMenuClosed_(event)
    //=======================
    {
        this._modal = false;
    }

    zoomTo_(feature)
    //==============
    {
        this._contextMenu.hide();

        // Zoom map to feature

        this._map.fitBounds(bounds(feature), {
            padding: 100,
            animate: false
        });
    }

    zoomToFeatures(featureIds)
    //========================
    {
        this.unhighlightFeatures_();

        if (featureIds.length) {
            let bbox = null;
            for (const featureId of featureIds) {
                const properties = this._flatmap.annotation(featureId);
                if (properties) {
                    const feature = utils.mapFeature(properties.layer, featureId);
                    this._map.setFeatureState(feature, { 'highlighted': true });
                    this._highlightedFeatures.push(feature);

                    const bounds = properties.bounds;
                    bbox = (bbox === null) ? bounds
                                           : expandBounds(bbox, bounds);
                }
            }

            // Zoom map to features

            this._map.fitBounds(bbox, {
                padding: 100,
                animate: false
            });
        }
    }

    clearResults()
    //============
    {
        this.unhighlightFeatures_();
    }

    queryData_(modelList)
    //===================
    {
        if (modelList.length > 0) {
            this._flatmap.callback('query-data', modelList, {
                describes: this._flatmap.describes
            });
        }
    }

    query_(type, event)
    //=================
    {
        this.unhighlightFeatures_();
        this._contextMenu.hide();
        const featureId = event.target.getAttribute('id');
        if (type === 'data') {
            this.queryData_(this._flatmap.modelsForFeature(featureId));
        } else {
            const ann = this._flatmap.getAnnotation(featureId);
            //this._queryInterface.query(type, ann.url, ann.models);
            this._map.getCanvas().style.cursor = 'progress';
            this._inQuery = true;
        }
        this._modal = false;
    }

    clickEvent_(event)
    //================
    {
        const symbolFeatures = this._map.queryRenderedFeatures(event.point)
                                        .filter(f => (f.layer.type === 'symbol'));
        for (const feature of symbolFeatures) {
            this._flatmap.featureEvent('click', feature);
            const properties = feature.properties;
        }
    }
}

//==============================================================================
