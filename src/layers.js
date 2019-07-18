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
        this._topLayerId = null;
        this._backgroundLayers = [];
        for (const l of layer.backgroundLayers) {
            const backgroundImage = new MapImageLayer(map, l, this._id);
            this._backgroundLayers.push(backgroundImage);
            if (this._topLayerId === null) {
                this._topLayerId = backgroundImage.imageLayerId;
            }
        }
        this._imageLayerId = `${layer.id}-image`;
        this._map.addLayer(style.ImageLayer.style(this._imageLayerId, this._imageLayerId, 0));
        if (this._topLayerId === null) {
            this._topLayerId = this._imageLayerId;
        }
        this._fillLayerId = `${layer.id}-fill`;
        this._map.addLayer(style.FeatureFillLayer.style(this._fillLayerId, FEATURE_SOURCE_ID, layer.id));
        this._borderLayerId = `${layer.id}-border`;
        this._map.addLayer(style.FeatureBorderLayer.style(this._borderLayerId, FEATURE_SOURCE_ID, layer.id));
        this._lineLayerId = `${layer.id}-line`;
        this._map.addLayer(style.FeatureLineLayer.style(this._lineLayerId, FEATURE_SOURCE_ID, layer.id));

    }

    get id()
    //======
    {
        return this._id;
    }

    setBorderProperties_(layerActive=false, annotating=false)
    //=======================================================
    {
        this._map.setPaintProperty(this._borderLayerId, 'line-color',
                                   style.borderColour(layerActive, annotating));
        this._map.setPaintProperty(this._borderLayerId, 'line-opacity',
                                   style.borderOpacity(layerActive, annotating));
        this._map.setPaintProperty(this._borderLayerId, 'line-width',
                                   style.FeatureBorderLayer.lineWidth(layerActive, annotating));
    }

    setLineProperties_(layerActive=false, annotating=false)
    //=====================================================
    {
        this._map.setPaintProperty(this._lineLayerId, 'line-color',
                                   style.lineColour(layerActive, annotating));
        this._map.setPaintProperty(this._lineLayerId, 'line-opacity',
                                   style.lineOpacity(layerActive, annotating));
        this._map.setPaintProperty(this._lineLayerId, 'line-width',
                                   style.FeatureLineLayer.lineWidth(layerActive, annotating));
    }

    activate(annotating=false)
    //========================
    {
        for (const l of this._backgroundLayers) {
            l.activate();
        }
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity', 1);
        this.setBorderProperties_(true, annotating);
        this.setLineProperties_(true, annotating);
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
        const beforeTopLayerId = beforeLayer ? beforeLayer._topLayerId : undefined;

        for (const l of this._backgroundLayers) {
            this._map.moveLayer(l.imageLayerId, beforeTopLayerId);
        }
        this._map.moveLayer(this._imageLayerId, beforeTopLayerId);
        this._map.moveLayer(this._fillLayerId, beforeTopLayerId);
        this._map.moveLayer(this._borderLayerId, beforeTopLayerId);
        this._map.moveLayer(this._lineLayerId, beforeTopLayerId);
    }
}

//==============================================================================

class MapImageLayer
{
    constructor(map, layer, topId='')
    {
        this._map = map;
        this._id = layer.id;
        if (topId === '') {
            this._imageLayerId = `${layer.id}-image`;
        } else {
            this._imageLayerId = `${topId}-${layer.id}-image`;
        }
        this._map.addLayer(style.ImageLayer.style(this._imageLayerId, `${layer.id}-image`,
                                                  style.PAINT_STYLES['background-opacity']));
    }

    get id()
    //======
    {
        return this._id;
    }

    get imageLayerId()
    //================
    {
        return this._imageLayerId;
    }

    activate()
    //========
    {
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity',
                                   style.PAINT_STYLES['layer-background-opacity']);
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
        const layers = layer.selectable ? new MapFeatureLayer(this._map, layer)
                                        : new MapImageLayer(this._map, layer)

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

    activate(layerId, annotating=false)
    //=================================
    {
        const layer = this._layers.get(layerId);
        if (layer !== undefined) {
            layer.activate(annotating);
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
