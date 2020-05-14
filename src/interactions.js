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

import {default as turfArea} from '@turf/area';
import {default as turfBBox} from '@turf/bbox';
import * as turf from '@turf/helpers';

//==============================================================================

import {ContextMenu} from './contextmenu.js';
import {InfoControl} from './info.js';
import {LayerManager} from './layers.js';
import {Pathways} from './pathways.js';
//import {QueryInterface} from './query.js';
import {indexedProperties} from './search.js';
import {SearchControl} from './search.js';

import * as utils from './utils.js';

//==============================================================================


// smallest `group` features when zoom < SHOW_DETAILS_ZOOM if there are some, otherwise smallest feature
// if no non-group features then smallest group one

const SHOW_DETAILS_ZOOM = 6;

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

        this._activeFeatures = [];
        this._selectedFeature = null;
        this._highlightedFeatures = [];
        this._searchResultFeatures = [];
        this._lastClickedLocation = null;
        this._currentPopup = null;
        this._infoControl = null;
        this._tooltip = null;

        this._inQuery = false;
        this._modal = false;

        // Fit the map to its initial position

        flatmap.setInitialPosition();

        // Add a control to search annotations if option set

        if (flatmap.options.searchable) {
            this._map.addControl(new SearchControl(flatmap.searchIndex));
        }

        // Show information about features

        if (flatmap.options.featureInfo || flatmap.options.searchable) {
            this._infoControl = new InfoControl(flatmap);
            if (flatmap.options.featureInfo) {
                this._map.addControl(this._infoControl);
            }
        }

        // Manage our pathways

        this._pathways = new Pathways(flatmap);

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

        // Handle mouse events

        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));
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

    highlightFeature_(feature)
    //========================
    {
        this._map.setFeatureState(feature, { 'highlighted': true });
        this._highlightedFeatures.push(feature);
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

        let feature = null;
        if (this._flatmap.options.tooltips) {
            if (this._activeFeatures.length > 0) {
                feature = this._activeFeatures[0];
            }
        } else {
            const symbolFeatures = this._map.queryRenderedFeatures(event.point)
                                            .filter(f => (f.layer.type === 'symbol'));
            if (symbolFeatures.length) {
                feature = symbolFeatures[0];
            }
        }

        if (feature !== null) {
            const id = feature.properties.id;
            if (this._pathways.isNode(id)) {
                const items = [
                    {
                        id: id,
                        prompt: 'Show paths',
                        action: this.enablePaths_.bind(this, feature.sourceLayer, true)
                    },
                    {
                        id: id,
                        prompt: 'Hide paths',
                        action: this.enablePaths_.bind(this, feature.sourceLayer, false)
                    }
                ];
                this._modal = true;
                this._contextMenu.show(event.lngLat, items);
            }
        }
    }

    contextMenuClosed_(event)
    //=======================
    {
        this._modal = false;
    }

    enablePaths_(layer, enable, event)
    //================================
    {
        this._contextMenu.hide();
        const nodeId = event.target.getAttribute('id');
        const lines = this._pathways.pathLines(nodeId);
        for (const lineId of this._pathways.pathLines(nodeId)) {
            const feature = utils.mapFeature(layer, lineId);
            if (enable) {
                this._map.setFeatureState(feature, { 'visible': true });
            } else {
                this._map.removeFeatureState(feature, 'visible');
            }
        }
        this._modal = false;
    }


    zoomTo_(feature)
    //==============
    {
        // Hide context menu if it's open

        this._contextMenu.hide();

        // Highlight the feature

        this.unhighlightFeatures_();
        this.highlightFeature_(feature);

        // Zoom map to feature

        this._map.fitBounds(bounds(feature), {
            padding: 100,
            animate: false
        });
    }

    clearSearchResults(reset=true)
    //============================
    {
        this.unhighlightFeatures_();

        for (const feature of this._searchResultFeatures) {
            this._map.removeFeatureState(feature, 'searchresult');
        }
        this._searchResultFeatures = [];
    }

    showSearchResults(featureIds, padding=100)
    //========================================
    {
        if (featureIds.length) {
            let bbox = null;
            for (const featureId of featureIds) {
                const annotation = this._flatmap.annotation(featureId);
                if (annotation) {
                    // Indicate which features are the result of the search
                    const feature = utils.mapFeature(annotation.layer, featureId);
                    this.highlightFeature_(feature);
                    this._map.setFeatureState(feature, { 'searchresult': true });
                    this._searchResultFeatures.push(feature);

                    const bounds = annotation.bounds;
                    bbox = (bbox === null) ? bounds
                                           : expandBounds(bbox, bounds);
                }
            }

            // Zoom map to features

            this._map.fitBounds(bbox, {
                padding: padding,
                animate: false
            });
        }
    }

    {
    queryData_(model)
    //===============
    {
        if (model) {
            this._flatmap.callback('query-data', model, {
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
            this.queryData_(this._flatmap.modelForFeature(featureId));
        } else {
            const ann = this._flatmap.getAnnotation(featureId);
            //this._queryInterface.query(type, ann.url, ann.models);
            this._map.getCanvas().style.cursor = 'progress';
            this._inQuery = true;
        }
        this._modal = false;
    }

    showPopup(featureId, content, options)
    //====================================
    {
        const properties = this._flatmap.annotation(featureId);

        if (properties) {  // The feature exists

            // Remove any existing popup

            if (this._currentPopup) {
                this._currentPopup.remove();
            }

            // Highlight the feature

            this.unhighlightFeatures_();
            this.highlightFeature_(utils.mapFeature(properties.layer, featureId));

            // Position popup at last clicked location if we have it,
            // otherwise at the feature's centroid

            const location = (this._lastClickedLocation === null) ? properties.centroid
                                                                  : this._lastClickedLocation;

            // Make sure the feature is on screen

            if (!this._map.getBounds().contains(location)) {
                this._map.panTo(location);
            }

            this._currentPopup = new mapboxgl.Popup(options).addTo(this._map);
            this._currentPopup.setLngLat(location);
            if (typeof content === 'object') {
                this._currentPopup.setDOMContent(content);
            } else {
                this._currentPopup.setText(content);
            }
        }
    }

    removeTooltip_()
    //==============
    {
        if (this._tooltip) {
            this._tooltip.remove();
            this._tooltip = null;
        }
    }


    mouseMoveEvent_(event)
    //====================
    {
        // Remove any existing tooltip

        this.removeTooltip_();

        // Reset cursor

        this._map.getCanvas().style.cursor = 'default';

        // Reset any active features

        while (this._activeFeatures.length > 0) {
            this._map.removeFeatureState(this._activeFeatures.pop(), 'active');
        }

        // Get all the features at the current point

        const features = this._map.queryRenderedFeatures(event.point);
        if (features.length === 0) {
            return;
        }

        let html = '';
        if (this._flatmap.options.debug && this._infoControl && this._infoControl.active) {
            html = this._infoControl.featureInformation(features, event.lngLat);
        } else {
            let labelledFeatures = features.filter(feature => 'label' in feature.properties)
                                           .sort((a, b) => (a.properties.area - b.properties.area));
            if (labelledFeatures.length > 0) {
                // Favour group features at low zoom levels
                const zoomLevel = this._map.getZoom();
                const groupFeatures = labelledFeatures.filter(feature => (feature.properties.group
                                                     && zoomLevel < (feature.properties.scale + 1)));
                if (groupFeatures.length > 0) {
                    labelledFeatures = groupFeatures;
                }

                if (this._flatmap.options.debug) {
                    const htmlList = [];
                    for (const feature of labelledFeatures) {
                        this._map.setFeatureState(feature, { active: true });
                        this._activeFeatures.push(feature);
                        for (const prop of indexedProperties) {
                            if (prop in feature.properties) {
                                htmlList.push(`<span class="info-name">${prop}:</span>`);
                                htmlList.push(`<span class="info-value">${feature.properties[prop]}</span>`);
                            }
                        }
                        htmlList.push(`<span class="info-name">Area:</span>`);
                        htmlList.push(`<span class="info-value">${feature.properties.area/1000000000}</span>`);
                        htmlList.push(`<span class="info-name">Scale:</span>`);
                        htmlList.push(`<span class="info-value">${feature.properties.scale}</span>`);
                    }
                    html = `<div id="info-control-info">${htmlList.join('\n')}</div>`;
                } else {
                    const feature = labelledFeatures[0];
                    this._map.setFeatureState(feature, { active: true });
                    this._activeFeatures.push(feature);
                    if (feature.layer.type === 'symbol') {
                        this._map.getCanvas().style.cursor = 'pointer';
                    } else if (this._flatmap.options.tooltips) {
                        this._map.getCanvas().style.cursor = 'pointer';
                        if (this._infoControl && this._infoControl.active) {
                            const htmlList = [];
                            for (const prop of indexedProperties) {
                                if (prop in feature.properties) {
                                    htmlList.push(`<span class="info-name">${prop}:</span>`);
                                    htmlList.push(`<span class="info-value">${feature.properties[prop]}</span>`);
                                }
                            }
                            htmlList.push(`<span class="info-name">Area:</span>`);
                            htmlList.push(`<span class="info-value">${feature.properties.area/1000000000}</span>`);
                            html = `<div id="info-control-info">${htmlList.join('\n')}</div>`;
                        } else if (!('labelled' in feature.properties)) {
                            html = `<div class='flatmap-feature-label'>${feature.properties.label}</div>`;
                        }
                    }
                }
            }
        }

        if (html !== '') {
            // Show a tooltip

            this._tooltip = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                maxWidth: 'none'
            });
            this._tooltip
                .setLngLat(event.lngLat)
                .setHTML(html)
                .addTo(this._map);
        }
    }

    clickEvent_(event)
    //================
    {
        // Also click on this._activeFeatures[0]
        if (this._flatmap.options.tooltips) {
            if (this._activeFeatures.length > 0) {
                const feature = this._activeFeatures[0];
                this._lastClickedLocation = feature.properties.centroid;
                this._flatmap.featureEvent('click', feature);
            }
        } else {
            const symbolFeatures = this._map.queryRenderedFeatures(event.point)
                                            .filter(f => (f.layer.type === 'symbol'));
            if (symbolFeatures.length) {
                this._lastClickedLocation = event.lngLat;
                for (const feature of symbolFeatures) {
                    this._flatmap.featureEvent('click', feature);
                }
            }
        }
    }
}

//==============================================================================
