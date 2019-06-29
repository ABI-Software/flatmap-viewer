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

export class UserInteractions
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;

        this._highlightedFeature = null;

        this._map.addControl(new LayerSwitcher(flatmap, 'Select organ system'));

        // Display a tooltip at the mouse pointer

        this._tooltip = new ToolTip(flatmap);

        // Setup callbacks
        //NB. Can be restricted to a layer...

        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));
        this._map.on('click', this.clickEvent_.bind(this));

        // Pass messages with other applications

        this._messagePasser = new MessagePasser(flatmap.id, json => this.processMessage_(json));
    }

    processMessage_(msg)
    //==================
    {
        console.log(this._flatmap.id, 'received', msg);
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

    mouseMoveEvent_(e)
    //================
    {
        // Highlight feature
        // Show tooltip
        //
        // Only in active layer ??

        const features = this._map.queryRenderedFeatures(e.point).filter(f => 'feature-id' in f.properties);
        this._map.getCanvas().style.cursor = (features.length) ? 'pointer' : '';

        // Highlight top feature but only if in active layer...

        for (const feature of features) {
            if (this._flatmap.activeLayerId === feature.sourceLayer) {
                this.highlightFeature_(feature);
                this._tooltip.show(feature, e.lngLat);
                return;
            }
        }
        this.unhighlightFeatures_();
        this._tooltip.hide();
    }


    clickEvent_(e)
    //============
    {
        const features = this._map.queryRenderedFeatures(e.point).filter(f => 'feature-id' in f.properties);

        for (const feature of features) {
            if (this._flatmap.activeLayerId === feature.sourceLayer) {
                this._messagePasser.broadcast('select', feature.properties['feature-id'], feature.properties);
                return;
            }
        }
    }

}

//==============================================================================
