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

import {MessagePasser} from './messages.js';
import {LayerSwitcher} from './layerswitcher.js'
import {ToolTip} from './tooltip.js'

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

        this._highlightedFeature = null;

        for (const [id, annotation] of Object.entries(flatmap.annotations)) {
            const feature = {
                id: id.split('-')[1],
                source: "features",
                sourceLayer: annotation.layer
            }
            this._map.setFeatureState(feature, { "annotated": true });
        }

        this._map.addControl(new LayerSwitcher(flatmap, 'Select organ system'));

        // Display a tooltip at the mouse pointer

        this._tooltip = new ToolTip(flatmap);

        // Setup callbacks
        //NB. Can be restricted to a layer...

        this._map.on('click', this.clickEvent_.bind(this));
        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));

        // Pass messages with other applications

        this._messagePasser = new MessagePasser(flatmap.id, json => this.processMessage_(json));
    }

    processMessage_(msg)
    //==================
    {
        if (msg.action === 'activate-layer') {
            this._flatmap.layerManager.activate(msg.resource);

        }
    }

    highlightFeature_(feature)
    //========================
    {
        this.unhighlightFeatures_(false);
        this._map.setFeatureState(feature, { "highlighted": true })
        this._highlightedFeature = feature;
    }

    unhighlightFeatures_(reset=true)
    //==============================
    {
        if (this._highlightedFeature !== null) {
            this._map.removeFeatureState(this._highlightedFeature, "highlighted");
            if (reset) {
                this._highlightedFeature = null;
            }
        }
    }

    activeFeatures_(e)
    //================
    {
        const activeLayerId = this._flatmap.activeLayerId;
        return this._map.queryRenderedFeatures(e.point).filter(f => {
            return activeLayerId === f.sourceLayer
                && 'id' in f.properties;
            }
        );
    }

    mouseMoveEvent_(e)
    //================
    {
        // Highlight feature
        // Show tooltip
        //

        const features = this.activeFeatures_(e);

        // Highlight top feature but only in active layer...

        for (const feature of features) {
            if (this._flatmap.hasAnnotationAbout(feature.properties.id)) {
                const annotation = this._flatmap.annotationAbout(feature.properties.id);
                this.highlightFeature_(feature);
                this._tooltip.show(e.lngLat, domFeatureDescription(annotation));
                this._map.getCanvas().style.cursor = 'pointer';
                return;
            }
        }
        this._map.getCanvas().style.cursor = '';
        this._tooltip.hide();
        this.unhighlightFeatures_();
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
