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

//==============================================================================

function domFeatureDescription(annotation)
{
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'flatmap-feature-tooltip';

    for (const value of annotation.annotation.split(/\s+/)) {
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
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;

        this._selectedFeature = null;
        this._highlightedFeatures = [];

        this._modal = false;

        // Add a control to enable annotation if option set

        if (flatmap.annotatable) {
            this._annotator = new Annotator(flatmap, this);
        }

        // To pass messages with other applications

        this._messagePasser = new MessagePasser(flatmap.id, json => this.processMessage_(json));

         // Manage our layers

        this._layerManager = new LayerManager(flatmap);

        // Add a background layer if we have one

        if (flatmap.hasBackground) {
            this._layerManager.addBackgroundLayer();
        }

        // Add the map's layers

        // Layers have an id, either layer-N or an assigned name
        // Some layers might have a description. These are the selectable layers,
        // unless they are flagged as `no-select`
        // Selectable layers have opacity 0 unless active, in which case they have opacity 1.
        // `no-select` layers have opacity 0.5
        // Background layer has opacity 0.2

        for (const layer of flatmap.layers) {
            this._layerManager.addLayer(layer);
        }

        if (this._layerManager.selectableLayerCount > 1) {
            this._map.addControl(new LayerSwitcher(flatmap, 'Select organ system'));

        } else if (this._layerManager.selectableLayerCount === 1) {
            // If only one selectable layer then it's always active...

            const selectableLayerId = this._layerManager.lastSelectableLayerId;
            this.activateLayer(selectableLayerId);

            this._messagePasser.broadcast('activate-layer', selectableLayerId);
        }


        for (const [id, annotation] of Object.entries(flatmap.annotations)) {
            const feature = {
                id: id.split('-')[1],
                source: "features",
                sourceLayer: annotation.layer
            };
            this._map.setFeatureState(feature, { "annotated": true });
        }

        // Display a tooltip at the mouse pointer

        this._tooltip = new ToolTip(flatmap);
        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));

        // Display a context menu on right-click

        this._contextMenu = new ContextMenu(flatmap, this.contextMenuClosed_.bind(this));
        this._map.on('contextmenu', this.contextMenuEvent_.bind(this));

        // Setup callbacks
        //NB. Can be restricted to a layer...

        this._map.on('click', this.clickEvent_.bind(this));

    }

    get annotating()
    //==============
    {
        return this._flatmap.annotatable && this._annotator.enabled;
    }

    get activeLayerId()
    //=================
    {
        return this._layerManager.activeLayerId;
    }

    get currentLayer()
    //================
    {
        return `${this._flatmap.id}/${this._layerManager.activeLayerId}`;
    }

    activateLayer(layerId)
    //====================
    {
        this._layerManager.activate(layerId, this.annotating);
    }

    processMessage_(msg)
    //==================
    {
        if (msg.action === 'activate-layer') {
            this.activateLayer(msg.resource);
        } else if (msg.action === 'query-results') {
            for (const featureUrl of msg.resource) {
                const objectId = this._flatmap.objectIdForUrl(featureUrl);
                if (objectId) {
                    const feature = {
                        id: objectId.split('-')[1],
                        source: "features",
                        sourceLayer: this._flatmap.layerIdForUrl(featureUrl)
                    };
                    this._map.setFeatureState(feature, { "highlighted": true });
                    this._highlightedFeatures.push(feature);
                }
            }
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
            return this.activeLayerId === f.sourceLayer
                && 'id' in f.properties;
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
            if (this.annotating
             || (feature.geometry.type === 'Polygon' && this._flatmap.hasAnnotationAbout(feature.properties.id))) {
                const annotation = this._flatmap.annotationAbout(feature.properties.id);
                this.selectFeature_(feature);
                if (annotation && this.annotating) {
                    this._tooltip.show(e.lngLat, domFeatureDescription(annotation));
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

        const features = this.activeFeatures_(e);
        for (const feature of features) {
            const id = feature.properties.id;
            if (this.annotating || this._flatmap.hasAnnotationAbout(id)) {
                this.selectFeature_(feature);
                this._tooltip.hide();
                const items = [];
                if (feature.geometry.type === 'Polygon') {
                    items.push({
                        id: id,
                        prompt: 'Query edges',
                        action: this.query_.bind(this, 'edges')
                    });
                    items.push({
                        id: id,
                        prompt: 'Query nodes',
                        action: this.query_.bind(this, 'nodes')
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

        const objectId = e.target.getAttribute('id');
        const node_url = this._flatmap.urlForObjectId(objectId);
        this._messagePasser.broadcast(`query-node-${type}`, node_url);

        this._modal = false;
    }

    clickEvent_(e)
    //============
    {
        const features = this.activeFeatures_(e);

        for (const feature of features) {
            if (this._flatmap.hasAnnotationAbout(feature.properties.id)) {
                const annotation = this._flatmap.annotationAbout(feature.properties.id);
                this._messagePasser.broadcast('select', feature.properties.id, annotation);
                return;
            }
        }
    }

}

//==============================================================================
