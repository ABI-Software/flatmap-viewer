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

import * as style from './styling.js';
import * as utils from './utils.js';

//==============================================================================

class MapFeatureLayer
{
    constructor(flatmap, layer)
    {
        this._map = flatmap.map;
        this._id = layer.id;
        this._styleLayerIds = [];

        this.addStyleLayer_(style.BodyLayer.style);

        if (flatmap.details['image_layer']) {
            this.addImageLayer_();
        }

        this.addStyleLayer_(style.FeatureDividerLineLayer.style);
        this.addStyleLayer_(style.FeatureFillLayer.style);
        this.addStyleLayer_(style.FeatureDividerBorderLayer.style);
        this.addStyleLayer_(style.FeatureBorderLayer.style);

        this.addStyleLayer_(style.FeatureLineLayer.style);
        this.addStyleLayer_(style.FeatureLineLayer.style, 'pathways');
        this.addStyleLayer_(style.FeatureLineDashLayer.style, 'pathways');
        this.addStyleLayer_(style.NervePolygonLayer.style, 'pathways');
        this.addStyleLayer_(style.FeatureNerveLayer.style, 'pathways');

        this.addStyleLayer_(style.FeatureLargeSymbolLayer.style);
        if (!flatmap.options.tooltips) {
            this.addStyleLayer_(style.FeatureSmallSymbolLayer.style);
        }
    }

    get id()
    //======
    {
        return this._id;
    }

    addImageLayer_()
    //==============
    {
        const styleLayer = style.ImageLayer.style(this._id);
        if (styleLayer) {
            this._map.addLayer(styleLayer);
            this._styleLayerIds.push(styleLayer.id);
            return styleLayer.id;
        }
        return null;
    }

    addStyleLayer_(styleFunction, source='features', ...args)
    //=======================================================
    {
        const styleLayer = styleFunction(`${this._id}-${source}`, ...args);
        if (styleLayer) {
            this._map.addLayer(styleLayer);
            this._styleLayerIds.push(styleLayer.id);
            return styleLayer.id;
        }
        return null;
    }

    move(beforeLayer)
    //===============
    {
        const beforeTopStyleLayerId = beforeLayer ? beforeLayer.topStyleLayerId : undefined;
        for (const styleLayerId of this._styleLayerIds) {
            this._map.moveLayer(styleLayerId, beforeTopStyleLayerId);
        }
    }
}

//==============================================================================

export class LayerManager
{
    constructor(flatmap, switcher=false)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;
        this._layers = new Map;
        this._mapLayers = new Map;
        this._activeLayers = [];
        this._activeLayerNames = [];
        this._selectableLayerId = '';
        this._selectableLayerCount = 0;
    }

    get activeLayerNames()
    //====================
    {
        return this._activeLayerNames;
    }

    addLayer(layer)
    //=============
    {
        this._mapLayers.set(layer.id, layer);

        const layers = new MapFeatureLayer(this._flatmap, layer);
        const layerId = this._flatmap.mapLayerId(layer.id);
        this._layers.set(layerId, layers);

        if (layer.selectable) {
            this._selectableLayerId = layerId;
            this._selectableLayerCount += 1;
        }
    }

    get layers()
    //==========
    {
        return this._layers;
    }

    get selectableLayerCount()
    //========================
    {
        return this._selectableLayerCount;
    }

    get lastSelectableLayerId()
    //=========================
    {
        return this._selectableLayerId;
    }

    layerQueryable(layerName)
    //========================
    {
        const layer = this._mapLayers.get(layerName);
        return layer['queryable-nodes'];
    }

    activate(layerId)
    //===============
    {
        const layer = this._layers.get(layerId);
        if (layer !== undefined) {
            layer.activate();
            if (this._activeLayers.indexOf(layer) < 0) {
                this._activeLayers.push(layer);
                this._activeLayerNames.push(layer.id);
            }
        }
    }

    deactivate(layerId)
    //=================
    {
        const layer = this._layers.get(layerId);
        if (layer !== undefined) {
            layer.deactivate();
            const index = this._activeLayers.indexOf(layer);
            if (index >= 0) {
                delete this._activeLayers[index];
                this._activeLayers.splice(index, 1);
                delete this._activeLayerNames[index];
                this._activeLayerNames.splice(index, 1);
            }
        }
    }

    makeUppermost(layerId)
    //====================
    {
        // position before top layer
    }

    makeLowest(layerId)
    //=================
    {
        // position after bottom layer (before == undefined)
    }


    lower(layerId)
    //============
    {
        // position before second layer underneath...
    }

    raise(layerId)
    //============
    {
        // position before layer above...
    }
}

//==============================================================================
