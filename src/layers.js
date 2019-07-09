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
    constructor(map, layer)
    {
        this._map = map;
        this._id = layer.id;
        const backgroundId = `${layer.id}-background`;
        if (this._map.isSourceLoaded(backgroundId)) {
            this._backgroundLayerId = backgroundId;
            this._map.addLayer(style.ImageLayer.style(this._backgroundLayerId,
                                                      `${layer.id}-background`,
                                                      layer.selectable ? 0 : style.PAINT_STYLES['no-select-opacity']));
        } else {
            this._backgroundLayerId = null;
        }
        this._fillLayerId = `${layer.id}-fill`;
        this._map.addLayer(style.FeatureFillLayer.style(this._fillLayerId, FEATURE_SOURCE_ID, layer.id));
        this._borderLayerId = `${layer.id}-border`;
        this._map.addLayer(style.FeatureBorderLayer.style(this._borderLayerId, FEATURE_SOURCE_ID, layer.id));
        this._lineLayerId = `${layer.id}-line`;
        this._map.addLayer(style.FeatureLineLayer.style(this._lineLayerId, FEATURE_SOURCE_ID, layer.id));

        this._topLayerId = (this._backgroundLayerId !== null) ? this._backgroundLayerId
                                                              : this._fillLayerId;
    }

    get id()
    //======
    {
        return this._id;
    }

    activate(annotating=false)
    //========================
    {
        if (this._backgroundLayerId) {
            this._map.setPaintProperty(this._backgroundLayerId, 'raster-opacity', 1);
        }
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
        if (this._backgroundLayerId) {
            this._map.setPaintProperty(this._backgroundLayerId, 'raster-opacity', 0);
        }
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

        if (this._backgroundLayerId !== null) {
            this._map.moveLayer(this._backgroundLayerId, beforeTopLayerId);
        }
        this._map.moveLayer(this._fillLayerId, beforeTopLayerId);
        this._map.moveLayer(this._borderLayerId, beforeTopLayerId);
        this._map.moveLayer(this._lineLayerId, beforeTopLayerId);
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
        this._activeLayer = null;
        this._selectableLayerId = '';
        this._selectableLayerCount = 0;
    }

    get activeLayerId()
    //=================
    {
        return this._activeLayer ? this._activeLayer.id : '';
    }

    addBackgroundLayer()
    //==================
    {
        if (this._map.isSourceLoaded('background')) {
            this._map.addLayer(style.ImageLayer.style('background', 'background',
                                                      style.PAINT_STYLES['background-opacity']));
        }
    }

    addLayer(layer)
    //=============
    {
        const featureLayer = new MapFeatureLayer(this._map, layer);
        const layerId = `${this._flatmap.id}/${layer.id}`;

        this._layers.set(layerId, featureLayer);

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
        if (layerId === '' || layer !== undefined) {
            if (this._activeLayer !== null) {
                this._activeLayer.deactivate();
            }
            if (layerId === '') {
                this._activeLayer = null;
            } else {
                layer.activate(annotating);
                this._activeLayer = layer;
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
