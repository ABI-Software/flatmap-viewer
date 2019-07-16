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

import {AnnotationControl, Annotator} from './annotation.js';
import {ContextMenu} from './contextmenu.js';
import {LayerManager} from './layers.js';
import {LayerSwitcher} from './layerswitcher.js'
import {MessagePasser} from './messages.js';
import {ToolTip} from './tooltip.js';

import * as utils from './utils.js';

//==============================================================================

function tooltip(valuesList)
{
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'flatmap-feature-tooltip';
    for (const value of valuesList) {
        const valueElement = document.createElement('div');
        valueElement.className = 'flatmap-feature-property';
        valueElement.textContent = value;
        tooltipElement.appendChild(valueElement);
    }
    return tooltipElement;
}

//==============================================================================

export class UserInteractions
{
    constructor(flatmap,  userInterfaceLoadedCallback=null)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;
        this._userInterfaceLoadedCallback =  userInterfaceLoadedCallback;

        this._selectedFeature = null;
        this._highlightedFeatures = [];

        this._modal = false;

        // Add a control to enable annotation if option set

        if (flatmap.annotatable) {
            this._annotator = new Annotator(flatmap, this);
        }

        // To pass messages with other applications

        this._messagePasser = new MessagePasser(flatmap.uniqueId, json => this.processMessage_(json));

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

        // Add a layer switcher if we have more than one selectable layer

        this._layerSwitcher = null;
        if (this._layerManager.selectableLayerCount > 1) {
            this._layerSwitcher = new LayerSwitcher(flatmap, 'Select system',
                                                    this.layerSwitcherActiveCallback_.bind(this));
            this._map.addControl(this._layerSwitcher);
        } else if (this._layerManager.selectableLayerCount === 1) {
            const selectableLayeId = this._layerManager.lastSelectableLayerId;
            this.activateLayer(selectableLayerId);
            this._messagePasser.broadcast('flatmap-activate-layer', selectableLayerId);
        }

        // Flag objects that have annotations

        for (const [id, annotation] of flatmap.annotations) {
            const feature = utils.mapFeature(annotation.layer, id);
            this._map.setFeatureState(feature, { 'annotated': true });
        }

        // Flag objects against which data queries may be made

        for (const layerStats of this._map.getStyle().sources['features'].tilestats['layers']) {
            if (layerStats.geometry.includes('Polygon')) {
                for (const attribute of layerStats['attributes']) {
                    if (attribute.attribute === 'id') {
                        for (const value of attribute.values) {
                            const feature = utils.mapFeature(layerStats.layer, value);
                            if (this._map.getFeatureState(feature, 'annotated')) {
                                this._map.setFeatureState(feature, { 'queryable': true });
                            }
                        }
                    }
                }
            }
        }

        // Display a tooltip at the mouse pointer

        this._tooltip = new ToolTip(flatmap);
        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));

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

        if (this._layerSwitcher === null
         && this._userInterfaceLoadedCallback !== null) {
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

        if ('layers' in state) {
            // We tell the layer manager the required state of a layer
            // and its controller will broadcast activation/deactivation messages
            for (const layerId of this.activeLayerIds) {
                this._layerSwitcher.setState(layerId, false);
            }
            for (name of state.layers) {
                this._layerSwitcher.setState(this._flatmap.mapLayerId(name), true);
            }
        }
        const options = {};
        if ('center' in state) {
            options['center'] = state.center;
        }
        if ('zoom' in state) {
            options['zoom'] = state.zoom;
        }
        if (Object.keys(options).length > 0) {
            this._map.easeTo(options);
        }
    }

    get annotating()
    //==============
    {
        return this._flatmap.annotatable && this._annotator.enabled;
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
        this._layerManager.activate(layerId, this.annotating);
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

    processMessage_(msg)
    //==================
    {
        if (msg.action === 'flatmap-activate-layer') {
            this.activateLayer(msg.resource);
        } else if (msg.action === 'flatmap-deactivate-layer') {
            this.deactivateLayer(msg.resource);
        } else if (msg.action === 'flatmap-query-results') {
            for (const featureUrl of msg.resource) {
                const featureId = this._flatmap.featureIdForUrl(featureUrl);
                if (featureId) {
                    const feature = utils.mapFeature(this._flatmap.layerIdForUrl(featureUrl),
                                                     featureId);
                    this._map.setFeatureState(feature, { "highlighted": true });
                    this._highlightedFeatures.push(feature);
                    if (this._map.getFeatureState(feature, 'queryable')) {
                        for (const model of this._flatmap.modelsForFeature(featureId)) {
                            this._messagePasser.broadcast('query-data', model);
                        }
                    }
                }
            }
            this._map.getCanvas().style.cursor = '';
        }
    }

    selectFeature_(feature)
    //=====================
    {
        this.unselectFeatures_(false);
        this._map.setFeatureState(feature, { "selected": true })
        this._selectedFeature = feature;
    }

    unselectFeatures_(reset=true)
    //===========================
    {
        if (this._selectedFeature !== null) {
            this._map.removeFeatureState(this._selectedFeature, "selected");
            if (reset) {
                this._selectedFeature = null;
            }
        }
    }

    unhighlightFeatures_(reset=true)
    //==============================
    {
        for (const feature of this._highlightedFeatures) {
            this._map.removeFeatureState(feature, "highlighted");
        }
        this._highlightedFeatures = [];
    }

    activeFeatures_(e)
    //================
    {
        // Get features in active layer

        return this._map.queryRenderedFeatures(e.point).filter(f => {
            return (this.activeLayerNames.indexOf(f.sourceLayer) >= 0)
                && ('id' in f.properties);
            }
        );
    }

    mouseMoveEvent_(e)
    //================
    {
        if (this._modal) {
            return;
        }
        const features = this.activeFeatures_(e);

        // When not annotating highlight the top polygon feature, otherwise
        // highlight the top festure
        for (const feature of features) {
            const id = feature.properties.id;
            if (this.annotating
             || (feature.geometry.type.includes('Polygon') && this._flatmap.hasAnnotation(id))) {
                const annotation = this._flatmap.getAnnotation(id);
                this.selectFeature_(feature);
                if (annotation) {
                    if (this.annotating) {
                        this._tooltip.show(e.lngLat, tooltip(annotation.text.split(/\s+/)));
                    } else {
                        const models = this._flatmap.modelsForFeature(id);
                        if (models.length) {
                            this._tooltip.show(e.lngLat, tooltip(models));
                        }
                    }
                }
                this._map.getCanvas().style.cursor = 'pointer';
                return;
            }
        }
        this._map.getCanvas().style.cursor = '';
        this._tooltip.hide();
        this.unselectFeatures_();
    }

    contextMenuEvent_(e)
    //==================
    {
        e.preventDefault();

        // Chrome on Android sends both touch and contextmenu events
        // so ignore duplicate

        if (Date.now() < (this._lastContextTime + 100)) {
            return;
        }
        this._lastContextTime = Date.now();

        const features = this.activeFeatures_(e);
        for (const feature of features) {
            const id = feature.properties.id;
            if (this.annotating || this._flatmap.hasAnnotation(id)) {
                this.selectFeature_(feature);
                this._tooltip.hide();
                const items = [];
                if (this._map.getFeatureState(feature, 'queryable')) {
                    items.push({
                        id: id,
                        prompt: 'Find datasets',
                        action: this.query_.bind(this, 'data')
                    });
                    items.push({
                        id: id,
                        prompt: 'Query node',
                        action: this.query_.bind(this, 'node-single')
                    });
                    items.push({
                        id: id,
                        prompt: 'Query connected nodes',
                        action: this.query_.bind(this, 'node-connected')
                    });
                }
                if (this.annotating) {
                    if (items.length) {
                        items.push('-');
                    }
                    items.push({
                        id: id,
                        prompt: 'Annotate',
                        action: this.annotate_.bind(this)
                    });
                }
                if (items.length) {
                    this._modal = true;
                    this._contextMenu.show(e.lngLat, items);
                    return;
                }
            }
        }
    }

    contextMenuClosed_(e)
    //===================
    {
        this._modal = false;
    }

    annotate_(e)
    //==========
    {
        this._contextMenu.hide();
        this._annotator.showDialog(e.target.getAttribute('id'),
                                   () => { this._modal = false; });
    }

    query_(type, e)
    //=============
    {
        this.unhighlightFeatures_();
        this._contextMenu.hide();
        const featureId = e.target.getAttribute('id');
        if (type === 'data') {
            for (const model of this._flatmap.modelsForFeature(featureId)) {
                this._messagePasser.broadcast('query-data', model);
            }
        } else {
            const node_url = this._flatmap.urlForFeature(featureId);
            this._messagePasser.broadcast(`flatmap-query-${type}`, node_url);
            this._map.getCanvas().style.cursor = 'progress';
        }
        this._modal = false;
    }

    clickEvent_(e)
    //============
    {
        const features = this.activeFeatures_(e);
        for (const feature of features) {
            if (this._map.getFeatureState(feature, 'queryable')) {
                const id = feature.properties.id;
                for (const model of this._flatmap.modelsForFeature(id)) {
                    this._messagePasser.broadcast('query-data', model);
                }
                return;
            }
        }
        this.unhighlightFeatures_();
    }

}

//==============================================================================
