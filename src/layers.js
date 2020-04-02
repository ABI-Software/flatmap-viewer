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
    constructor(map, layer)
    {
        this._map = map;
        this._id = layer.id;
        this._styleLayerIds = [];

        this._imageLayerId = this.addStyleLayer_(style.ImageLayer.style, style.PAINT_STYLES['layer-background-opacity']);
        this.addStyleLayer_(style.FeatureFillLayer.style);

        this._borderLayerId = this.addStyleLayer_(style.FeatureBorderLayer.style);

        this._lineLayerId = this.addStyleLayer_(style.FeatureLineLayer.style);

        this.addStyleLayer_(style.FeatureLargeSymbolLayer.style);
        this.addStyleLayer_(style.FeatureSmallSymbolLayer.style);
    }

    get id()
    //======
    {
        return this._id;
    }

    addStyleLayer_(styleFunction, ...args)
    //====================================
    {
        const styleLayer = styleFunction(this._id, ...args);
        if (styleLayer) {
            this._map.addLayer(styleLayer);
            this._styleLayerIds.push(styleLayer.id);
            return styleLayer.id;
        }
        return null;
    }

    setBorderProperties_(layerActive=false)
    //=====================================
    {
        this._map.setPaintProperty(this._borderLayerId, 'line-color',
                                   style.borderColour(layerActive));
        this._map.setPaintProperty(this._borderLayerId, 'line-opacity',
                                   style.borderOpacity(layerActive));
        this._map.setPaintProperty(this._borderLayerId, 'line-width',
                                   style.FeatureBorderLayer.lineWidth(layerActive));
    }

    setLineProperties_(layerActive=false)
    //===================================
    {
        this._map.setPaintProperty(this._lineLayerId, 'line-color',
                                   style.lineColour(layerActive));
        this._map.setPaintProperty(this._lineLayerId, 'line-opacity',
                                   style.lineOpacity(layerActive));
        this._map.setPaintProperty(this._lineLayerId, 'line-width',
                                   style.FeatureLineLayer.lineWidth(layerActive));
    }

    activate()
    //========
    {
        for (const l of this._backgroundLayers) {
            l.activate();
        }
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity', 1);
        this.setBorderProperties_(true);
        this.setLineProperties_(true);
    }

    deactivate()
    //==========
    {
        for (const l of this._backgroundLayers) {
            l.deactivate();
        }
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity', 0);
        this.setBorderProperties_();
        this.setLineProperties_();
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

        const layers = new MapFeatureLayer(this._map, layer);
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
