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
import {MinimapControl} from './minimap.js';
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
        this._currentPopup = null;
        this._infoControl = null;
        this._tooltip = null;

        this._disabledPathFeatures = false;

        this._inQuery = false;
        this._modal = false;

        // Marker placement and interaction

        this._activeMarker = null;
        this._lastMarkerId = 900000;
        this._markerIdByMarker = new Map();

        // Mapbox dynamically sets a transform on marker elements so in
        // order to apply a scale transform we need to create marker icons
        // inside the marker container <div>.
        this._defaultMarkerHTML = new mapboxgl.Marker().getElement().innerHTML;
        this._simulationMarkerHTML = new mapboxgl.Marker({color: '#005974'}).getElement().innerHTML;

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

        // Neural pathways which are either controlled externally
        // or by our local controls

        this._pathways = new Pathways(flatmap);

        if (flatmap.options.pathControls) {
            // Add controls to manage our pathways

            this._map.addControl(new PathControl(flatmap));

            // Add a key showing nerve types

            this._map.addControl(new NerveKey(flatmap));
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
            const feature = this.mapFeature_(id);
            this._map.setFeatureState(feature, { 'annotated': true });
            if ('error' in ann) {
                this._map.setFeatureState(feature, { 'annotation-error': true });
                console.log(`Annotation error, ${ann.layer}: ${ann.error} (${ann.text})`);
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

        this._map.on('click', this.clickEvent_.bind(this));
        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));

        // Add a minimap if option set

        // NB. This has to be done **after** the flatmap's layers have been added

        if (flatmap.options.minimap) {
            this._minimap = new MinimapControl(flatmap.options.minimap);
            this._map.addControl(this._minimap);
        }

        // Call the `UI loaded` callback if there is one

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

    get minimap()
    //===========
    {
        return this._minimap;
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

    activateFeature_(feature)
    //=======================
    {
        this._map.setFeatureState(feature, { active: true });
        this._activeFeatures.push(feature);
    }

    resetActiveFeatures_()
    //====================
    {
        while (this._activeFeatures.length > 0) {
            this._map.removeFeatureState(this._activeFeatures.pop(), 'active');
        }
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
        this.enablePathFeatures_(enable, this._pathways.pathFeatureIds(nodeId));
        this.clearModal_();
    }

    enablePathFeatures_(enable, featureIds)
    //=====================================
    {
        for (const featureId of featureIds) {
            const feature = this.mapFeature_(featureId);
            if (enable) {
                this._map.removeFeatureState(feature, 'hidden');
            } else {
                this._map.setFeatureState(feature, { 'hidden': true });
                this._disabledPathFeatures = true;
            }
        }
    }

    togglePaths()
    //===========
    {
        if (this._disabledPathFeatures){
            this.enablePathFeatures_(true, this._pathways.allFeatureIds());
            this._disabledPathFeatures = false;
        } else {
            this.enablePathFeatures_(false, this._pathways.allFeatureIds());
        }
    }

    reset()
    //=====
    {
        this.clearModal_();
        this.clearActiveMarker_();
        this.unhighlightFeatures_();
        this.enablePathFeatures_(true, this._pathways.allFeatureIds());
        this._disabledPathFeatures = false;
    }

    clearSearchResults(reset=true)
    //============================
    {
        this.unhighlightFeatures_();
    }

    /**
     * Zoom map to features.
     *
     * @param      {Array.<string>}  featureIds   An array of feature identifiers
     * @param      {number}  [padding=100]  Padding around the composite bounding box
     */
    zoomToFeatures(featureIds, padding=100)
    //=====================================
    {
        if (featureIds.length) {
            this.unhighlightFeatures_();
            let bbox = null;
            for (const featureId of featureIds) {
                const annotation = this._flatmap.annotation(featureId);
                if (annotation) {
                    const feature = this.mapFeature_(featureId);
                    this.highlightFeature_(feature);
                    const bounds = annotation.bounds;
                    bbox = (bbox === null) ? bounds
                                           : expandBounds(bbox, bounds);
                }
            }
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
            const label = properties.label;
            const capitalisedLabel = label.substr(0, 1).toUpperCase() + label.substr(1).toLowerCase();
            if (labelSuffix === '') {
                return `<div class='flatmap-feature-label'>${capitalisedLabel}</div>`;
            } else {
                return `<div class='flatmap-feature-label'>${capitalisedLabel} ${labelSuffix}</div>`;
            }
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

        this.resetActiveFeatures_();

        // Get all the features at the current point

        const features = this._map.queryRenderedFeatures(event.point);
        if (features.length === 0) {
            return;
        }

        let html = '';
        if (this._flatmap.options.debug && this._infoControl && this._infoControl.active) {

            for (const feature of features) {
                this.activateFeature_(feature);
            }

            html = this._infoControl.featureInformation(features, event.lngLat);
        } else {
            const lineFeatures = features.filter(feature => ('type' in feature.properties
                                                         && feature.properties.type.startsWith('line')));
            if (lineFeatures.length > 0) {
                for (const featureId of this._pathways.featureIdsForLines(
                                                        lineFeatures.map(f => f.properties.id))) {
                    this.activateFeature_(this.mapFeature_(featureId));
                }
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
                            this.activateFeature_(feature);
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
                        html = this.tooltipHtml_(feature.properties);
                        this.activateFeature_(feature);
                        if ('type' in feature.properties
                          && feature.properties.type === 'nerve') {
                            if ('nerve-id' in feature.properties){
                                this.activateNerveFeatures_(feature.properties['nerve-id']);
                            } else {
                                this.activateNerveFeatures_(feature.properties.id);
                            }
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

    clickEvent_(event)
    //================
    {
        this.clearActiveMarker_();
        this.unhighlightFeatures_();
        if (this._activeFeatures.length > 0) {
            const feature = this._activeFeatures[0];
            if ('properties' in feature) {
                if ('models' in feature.properties) {
                    this._flatmap.featureEvent('click', feature.properties.models);
                }
                if (this._pathways.isNode(feature.properties.featureId)) {
                    for (const featureId of this._pathways.pathFeatureIds(feature.properties.featureId)) {
                        this.highlightFeature_(this.mapFeature_(featureId));
                    }
                }
            }
        }
    }

    activateNerveFeatures_(nerveId)
    //=============================
    {
        for (const featureId of this._pathways.featureIdsForNerve(nerveId)) {
            this.activateFeature_(this.mapFeature_(featureId));
        }
    }

    showPaths(pathTypes, enable=true)
    //===============================
    {
        // Disable/enable all paths except those with `pathTypes`

        this.enablePathFeatures_(!enable, this._pathways.allFeatureIds());

        if (Array.isArray(pathTypes)) {
            for (const pathType of pathTypes) {
                this.enablePathFeatures_(enable, this._pathways.typeFeatureIds(pathType));
            }
        } else {
            this.enablePathFeatures_(enable, this._pathways.typeFeatureIds(pathTypes));
        }

        this._disabledPathFeatures = true;
    }

    //==============================================================================

    // Marker handling

    addMarker(anatomicalId, markerType='')
    //====================================
    {
        const featureIds = this._flatmap.featureIdsForModel(anatomicalId);
        let markerId = -1;

        for (const featureId of featureIds) {
            const ann = this._flatmap.annotation(featureId);
            if (!('marker' in ann)) {
                if (markerId === -1) {
                    this._lastMarkerId += 1;
                    markerId = this._lastMarkerId;
                }

                const markerElement = document.createElement('div');
                const markerIcon = document.createElement('div');
                if (markerType === 'simulation') {
                    markerIcon.innerHTML = this._simulationMarkerHTML;
                } else {
                    markerIcon.innerHTML = this._defaultMarkerHTML;
                }
                markerIcon.className = 'flatmap-marker';
                markerElement.appendChild(markerIcon);

                const marker = new mapboxgl.Marker(markerElement)
                                           .setLngLat(ann.centroid)
                                           .addTo(this._map);
                markerElement.addEventListener('mouseenter',
                    this.markerMouseEvent_.bind(this, marker, anatomicalId));
                markerElement.addEventListener('mousemove',
                    this.markerMouseEvent_.bind(this, marker, anatomicalId));
                markerElement.addEventListener('mouseleave',
                    this.markerMouseEvent_.bind(this, marker, anatomicalId));
                markerElement.addEventListener('click',
                    this.markerMouseEvent_.bind(this, marker, anatomicalId));

                this._markerIdByMarker.set(marker, markerId);
            }
        }
        return markerId;
    }

    clearMarkers()
    //============
    {
        for (const marker of this._markerIdByMarker.keys()) {
            marker.remove();
        }
        this._markerIdByMarker.clear();
    }

    markerMouseEvent_(marker, anatomicalId, event)
    //============================================
    {
        // No tooltip when context menu is open
        if (this._modal
         || (this._activeMarker !== null && event.type === 'mouseleave')) {
            return;
        }

        if (['mouseenter', 'mouseleave', 'click'].indexOf(event.type) >= 0) {
            this._activeMarker = marker;

            // Remove any existing tooltips
            this.removeTooltip_();
            marker.setPopup(null);

            // Reset cursor
            marker.getElement().style.cursor = 'default';

            if (['mouseenter', 'click'].indexOf(event.type) >= 0) {
                this._flatmap.markerEvent(event.type, this._markerIdByMarker.get(marker), anatomicalId);
            }
        }
        event.stopPropagation();
    }

    clearActiveMarker_()
    //==================
    {
        if (this._activeMarker !== null) {
            this._activeMarker.setPopup(null);
            this._activeMarker = null;
        }
    }

    showMarkerPopup(markerId, content, options)
    //=========================================
    {
        const marker = this._activeMarker;
        if (markerId !== this._markerIdByMarker.get(marker)) {
            this.clearActiveMarker_();
            return false;
        }

        const location = marker.getLngLat();

        // Make sure the marker is on screen

        if (!this._map.getBounds().contains(location)) {
            this._map.panTo(location);
        }

        const element = document.createElement('div');
        if (typeof content === 'object') {
            element.appendChild(content);
        } else {
            element.innerHTML = content;
        }

        element.addEventListener('click', e => this.clearActiveMarker_());

        this._tooltip = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: 'none',
            className: 'flatmap-marker-popup'
        });

        this._tooltip
            .setLngLat(location)
            .setDOMContent(element);

        // Set the merker tooltip and show it
        marker.setPopup(this._tooltip);
        marker.togglePopup();

        return true;
    }
}

//==============================================================================
