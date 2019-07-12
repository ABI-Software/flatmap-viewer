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

const FEATURE_SOURCE_ID = 'features';

//==============================================================================

class MapFeatureLayer
{
    constructor(map, layerId)
    {
        this._map = map;
        this._id = layerId;
        this._imageLayerId = `${layerId}-image`;
        this._map.addLayer(style.ImageLayer.style(this._imageLayerId, this._imageLayerId, 0));
        this._fillLayerId = `${layerId}-fill`;
        this._map.addLayer(style.FeatureFillLayer.style(this._fillLayerId, FEATURE_SOURCE_ID, layerId));
        this._borderLayerId = `${layerId}-border`;
        this._map.addLayer(style.FeatureBorderLayer.style(this._borderLayerId, FEATURE_SOURCE_ID, layerId));
        this._lineLayerId = `${layerId}-line`;
        this._map.addLayer(style.FeatureLineLayer.style(this._lineLayerId, FEATURE_SOURCE_ID, layerId));

        this._topLayerId = this._imageLayerId;
    }

    get id()
    //======
    {
        return this._id;
    }

    activate(annotating=false)
    //========================
    {
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity', 1);
        this._map.setPaintProperty(this._borderLayerId, 'line-opacity',
                                   style.borderOpacity(true, annotating));
        this._map.setPaintProperty(this._borderLayerId, 'line-width',
                                   style.FeatureBorderLayer.lineWidth(true, annotating));
        this._map.setPaintProperty(this._lineLayerId, 'line-opacity',
                                   style.lineOpacity(true, annotating));
        this._map.setPaintProperty(this._lineLayerId, 'line-width',
                                   style.FeatureLineLayer.lineWidth(true, annotating));
    }

    deactivate()
    //==========
    {
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity', 0);
        this._map.setPaintProperty(this._borderLayerId, 'line-opacity',
                                   style.borderOpacity());
        this._map.setPaintProperty(this._borderLayerId, 'line-width',
                                   style.FeatureBorderLayer.lineWidth());
        this._map.setPaintProperty(this._lineLayerId, 'line-opacity',
                                   style.lineOpacity());
        this._map.setPaintProperty(this._lineLayerId, 'line-width',
                                   style.FeatureLineLayer.lineWidth());
    }

    move(beforeLayer)
    //===============
    {
        const beforeTopLayerId = beforeLayer ? beforeLayer._topLayerId : undefined;

        this._map.moveLayer(this._imageLayerId, beforeTopLayerId);
        this._map.moveLayer(this._fillLayerId, beforeTopLayerId);
        this._map.moveLayer(this._borderLayerId, beforeTopLayerId);
        this._map.moveLayer(this._lineLayerId, beforeTopLayerId);
    }
}

//==============================================================================

class MapImageLayer
{
    constructor(map, layerId)
    {
        this._map = map;
        this._id = layerId;
        this._imageLayerId = `${layerId}-image`;
        this._map.addLayer(style.ImageLayer.style(this._imageLayerId, this._imageLayerId,
                                                  style.PAINT_STYLES['background-opacity']));
    }

    get id()
    //======
    {
        return this._id;
    }

    activate()
    //========
    {
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity',
                                   style.PAINT_STYLES['unselectable-opacity']);
    }

    deactivate()
    //==========
    {
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity',
                                   style.PAINT_STYLES['background-opacity']);
    }

    move(beforeLayer)
    //===============
    {
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
        this._activeLayers = [];
        this._activeLayerIds = [];
        this._selectableLayerId = '';
        this._selectableLayerCount = 0;
    }

    get activeLayerIds()
    //==================
    {
        return this._activeLayerIds;
    }

    addLayer(layer)
    //=============
    {
        const layers = layer.selectable ? new MapFeatureLayer(this._map, layer.id)
                                        : new MapImageLayer(this._map, layer.id)
        const layerId = `${this._flatmap.id}/${layer.id}`;

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

    activate(layerId, annotating=false)
    //=================================
    {
        const layer = this._layers.get(layerId);
        if (layer !== undefined) {
            layer.activate(annotating);
            if (this._activeLayers.indexOf(layer) < 0) {
                this._activeLayers.push(layer);
                this._activeLayerIds.push(layer.id);
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
                delete this._activeLayerIds[index];
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
