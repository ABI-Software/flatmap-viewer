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

const ATTRIBUTION_ABI = '© <a href="https://www.auckland.ac.nz/en/abi.html">Auckland Bioengineering Institute</a>';

//==============================================================================

import {FeatureLayer, ImageLayer} from './styling.js';
//import {LayerSwitcher} from './layerswitcher.js';
import * as utils from './utils.js';

//==============================================================================

export class LayerManager
{
    constructor(map, switcher=false)
    {
        this._map = map;
        this._layers = new Map;

        // Add a layer switcher if option set

        if (switcher) {
            this._layerSwitcher = new LayerSwitcher({tipLabel: "Layers"});
            map.addControl(this._layerSwitcher);
        }
    }

    addLayer(layerId)
    //===============
    {
        const layerStyles = new utils.List;

        if (this._map.isSourceLoaded(`${layerId}-background`)) {
            layerStyles.append(ImageLayer.style(`${layerId}-background`, layerId));
        }

        layerStyles.extend(FeatureLayer.styles('features', layerId));

        for (const style of layerStyles) {
            this._map.addLayer(style)
        }

        this._layers.set(layerId, layerStyles);
    }

    get layers()
    //==========
    {
        return this._layers;
    }

    static tileUrl_(mapId, source, coord, ratio, proj)
    //================================================
    {
        return utils.absoluteUrl(`${mapId}/tiles/${source}/${coord[0]}/${coord[1]}/${-coord[2] - 1}`)
    }

    featureUrl_(source=null)
    //======================
    {
        return (source === null) ? null
                                 : utils.absoluteUrl(`${this._map.id}/features/${source}`);
    }

    lower(layerId)
    //============
    {
        /*
        const i = this._layers.findIndex(l => (l === layer));
        if (i > 0) {
            this._layers[i] = this._layers[i-1];
            this._layers[i-1] = layer;
            const featureLayer = this._featureLayerCollection.removeAt(i);
            this._featureLayerCollection.insertAt(i-1, featureLayer);
            const tileLayer = this._imageTileLayerCollection.removeAt(i);
            this._imageTileLayerCollection.insertAt(i-1, tileLayer);
            // Redraw map and switcher panel
            this._map.render();
            this._layerSwitcher.renderPanel();
        }
        */
    }

    raise(layerId)
    //============
    {
        /*
        const numLayers = this._featureLayerCollection.getLength();
        const i = this._layers.findIndex(l => (l === layer));
        if (i >= 0 && i < (numLayers-1)) {
            this._layers[i] = this._layers[i+1];
            this._layers[i+1] = layer;
            const featureLayer = this._featureLayerCollection.removeAt(i);
            this._featureLayerCollection.insertAt(i+1, featureLayer);
            const tileLayer = this._imageTileLayerCollection.removeAt(i);
            this._imageTileLayerCollection.insertAt(i+1, tileLayer);
            // Redraw map and switcher panel
            this._map.render();
            this._layerSwitcher.renderPanel();
        }
        */
    }
}

//==============================================================================
