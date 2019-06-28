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
import {ToolTip} from './tooltip.js'

//==============================================================================

export class UserInteractions
{
    constructor(map)
    {
        this._map = map;

        this._highlightedFeatures = [];
        this._selectedFeature = null;
        this._enabled = false;

        // Display a tooltip at the mouse pointer

        this._tooltip = new ToolTip(map);

        // Setup callbacks
        //NB. Can be restricted to a layer...

        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));
        this._map.on('click', this.clickEvent_.bind(this));

        // Pass messages with other applications

        this._messagePasser = new MessagePasser(map.id, json => this.process(json));
    }

    disable()
    //=======
    {
        this._selectedFeature = null;
        this.clearStyle_();
        this._enabled = false;
    }

    enable()
    //======
    {
        this._enabled = true;
    }

    clearStyle_()
    //===========
    {
    }

    process(remote)
    //=============
    {
        console.log(this._map.id, 'received', remote);
        if (remote.action === 'select') {
            // remote.type has class of resource
            // features = this._map.getFeaturesByType(remote.type);
            // highlight features (==> unhighlight others)
            // What about zooming to 1.4*features.extent() (20% margin all around)??
            // Activate (and raise to top??) feature.layer() ??
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

        this._tooltip.update(features, e.lngLat);
    }


    clickEvent_(e)
    //============
    {
        const features = this._map.queryRenderedFeatures(e.point).filter(f => 'feature-id' in f.properties);

        if (features.length) {
            this._messagePasser.broadcast(features[0], 'select');
        }
    }

}

//==============================================================================
