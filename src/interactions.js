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
import {NerveKey, PathControl} from './controls.js';
import {indexedProperties} from './search.js';
import {SearchControl} from './search.js';
import {VECTOR_TILES_SOURCE} from './styling.js';

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
        this._currentPopup = null;
        this._infoControl = null;
        this._tooltip = null;
        this._markers = [];
        this._disabledLines = false;

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
        this._map.addControl(new PathControl(this));

        // Add a key showing nerve types

        this._map.addControl(new NerveKey());

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

        // Mapbox dynamically sets a transform on marker elements so in
        // order to apply a scale transform we need to create marker icons
        // inside the marker container <div>.
        const defaultMarker = new mapboxgl.Marker().getElement().innerHTML;
        const simulationMarker = new mapboxgl.Marker({color: '#F731D7'}).getElement().innerHTML;

        // Flag features that have annotations
        // Also flag those features that are models of something

        for (const [id, ann] of flatmap.annotations) {
            const feature = this.mapFeature_(id);
            this._map.setFeatureState(feature, { 'annotated': true });
            if ('error' in ann) {
                this._map.setFeatureState(feature, { 'annotation-error': true });
                console.log(`Annotation error, ${ann.layer}: ${ann.error} (${ann.text})`);
            }
            // Add markers to the map
            if ('marker' in ann) {
                const markerElement = document.createElement('div');
                const markerIcon = document.createElement('div');
                markerIcon.innerHTML = ('simulation' in ann) ? simulationMarker : defaultMarker;
                markerIcon.className = 'flatmap-marker';
                markerElement.appendChild(markerIcon);
                const marker = new mapboxgl.Marker(markerElement)
                                           .setLngLat(ann.centroid)
                                           .addTo(this._map);
                markerElement.addEventListener('click',
                    this.markerClickEvent_.bind(this, id, marker));
                markerElement.addEventListener('mouseenter',
                    this.markerMouseEvent_.bind(this, id, marker));
                markerElement.addEventListener('mousemove',
                    this.markerMouseEvent_.bind(this, id, marker));
                markerElement.addEventListener('mouseleave',
                    this.markerMouseEvent_.bind(this, id, marker));
                this._markers.push(marker);
            }
        }

        // Display a context menu on right-click

        this._lastContextTime = 0;
        this._contextMenu = new ContextMenu(flatmap, this.clearModal_.bind(this));
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

    mapFeature_(featureId)
    //====================
    {
        const ann = this._flatmap.annotation(featureId);
        return {
            id: featureId.split('#')[1],
            source: VECTOR_TILES_SOURCE,
            sourceLayer: `${ann.layer}-${ann['tile-layer']}`
        };
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

        if (this._activeFeatures.length > 0) {
            const feature = this._activeFeatures[0];

            // Remove any tooltip
            this.removeTooltip_();

            const id = feature.properties.id;
            if (this._pathways.isNode(id)) {
                const items = [
                    {
                        id: id,
                        prompt: 'Show paths',
                        action: this.enablePaths_.bind(this, true)
                    },
                    {
                        id: id,
                        prompt: 'Hide paths',
                        action: this.enablePaths_.bind(this, false)
                    }
                ];
                this.setModal_();
                this._contextMenu.show(event.lngLat, items, feature.properties.label);
            }
        }
    }

    setModal_(event)
    //==============
    {
        this._modal = true;
    }

    clearModal_(event)
    //================
    {
        this._modal = false;
    }

    enablePaths_(enable, event)
    //=========================
    {
        this._contextMenu.hide();
        const nodeId = event.target.getAttribute('id');
        this.enableLines_(enable, this._pathways.pathFeatures(nodeId));
        this.clearModal_();
    }

    enableLines_(enable, lines)
    //=========================
    {
        for (const lineId of lines) {
            const feature = this.mapFeature_(lineId);
            if (enable) {
                this._map.removeFeatureState(feature, 'hidden');
            } else {
                this._map.setFeatureState(feature, { 'hidden': true });
                this._disabledLines = true;
            }
        }
    }


    togglePaths()
    //===========
    {
        if (this._disabledLines){
            this.enableLines_(true, this._pathways.allLines())
            this._disabledLines = false;
        } else {
            this.enableLines_(false, this._pathways.allLines())
        }
    }

    reset()
    //=====
    {
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
                    const feature = this.mapFeature_(featureId);
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
        this.clearModal_();
    }

    showPopup(featureId, content, options={})
    //=======================================
    {
        const ann = this._flatmap.annotation(featureId);
        if (ann) {  // The feature exists

            // Remove any existing popup

            if (this._currentPopup) {
                this._currentPopup.remove();
            }

            // Highlight the feature

            this.unhighlightFeatures_();
            this.highlightFeature_(this.mapFeature_(featureId));

            // Position popup at the feature's centroid

            const location = ann.centroid;

            // Make sure the feature is on screen

            if (!this._map.getBounds().contains(location)) {
                this._map.panTo(location);
            }
            this.setModal_();
            this._currentPopup = new mapboxgl.Popup(options).addTo(this._map);
            this._currentPopup.on('close', this.clearModal_.bind(this));
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

    tooltipHtml_(properties, labelSuffix='')
    //======================================
    {
        if (this._infoControl && this._infoControl.active) {
            const htmlList = [];
            htmlList.push(`<span class="info-name">Id:</span>`);
            htmlList.push(`<span class="info-value">${properties.id}</span>`);
            for (const prop of indexedProperties) {
                if (prop in properties) {
                    htmlList.push(`<span class="info-name">${prop}:</span>`);
                    htmlList.push(`<span class="info-value">${properties[prop]}</span>`);
                }
            }
            return `<div id="info-control-info">${htmlList.join('\n')}</div>`;
        } else if (!('labelled' in properties)) {
            return `<div class='flatmap-feature-label'>${properties.label}${labelSuffix}</div>`;
        }
    }

    mouseMoveEvent_(event)
    //====================
    {
        // No tooltip when context menu is open

        if (this._modal) {
            return;
        }

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
            let labelledFeatures = features.filter(feature => ('label' in feature.properties
                                                         && (!('tooltip' in feature.properties)
                                                            || feature.properties.tooltip)))
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
                maxWidth: 'none',
                className: 'flatmap-tooltip-popup'
            });
            this._tooltip
                .setLngLat(event.lngLat)
                .setHTML(html)
                .addTo(this._map);
        }
    }

    markerMouseEvent_(featureId, marker, event)
    //=========================================
    {
        // No tooltip when context menu is open
        if (this._modal) {
            return;
        }

        if (['mouseenter', 'mouseleave'].indexOf(event.type) >= 0) {
            // Remove any existing tooltips
            this.removeTooltip_();
            marker.setPopup(null);

            // Reset cursor
            marker.getElement().style.cursor = 'default';

            if (event.type === 'mouseenter') {
                const ann = this._flatmap.annotation(featureId);
                if (ann !== null) {
                    // Show pointer cursor
                    marker.getElement().style.cursor = 'pointer';

                    const html = this.tooltipHtml_(ann, ' datasets');
                    this._tooltip = new mapboxgl.Popup({
                        closeButton: false,
                        closeOnClick: false,
                        maxWidth: 'none',
                        className: 'flatmap-tooltip-popup'
                    });

                    this._tooltip
                        .setLngLat(ann.centroid)
                        .setHTML(html);

                    // Set the new tooltip and show it
                    marker.setPopup(this._tooltip);
                    marker.togglePopup();
                }
            }
        } else if (event.type === 'mousemove') {
            // Stop event from propagating...
            event.stopPropagation();
        }
    }

    clickEvent_(event)
    //================
    {
        // Also click on this._activeFeatures[0]
        if (this._flatmap.options.tooltips) {
            if (this._activeFeatures.length > 0) {
                const feature = this._activeFeatures[0];
                this._lastClickedLocation = centroid(feature);
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

    markerClickEvent_(featureId, marker, event)
    //=========================================
    {
        // Remove tooltip
        marker.setPopup(null);
        this._flatmap.annotationEvent('click', featureId);
    }

}

//==============================================================================
