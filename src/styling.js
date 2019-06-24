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

const PAINT_STYLES = {
    'image-opacity': 0.5,
    'fill-color': '#fff',
    'fill-opacity': 0.4,
    'border-stroke-color': 'blue',
    'border-stroke-opacity': 0.1,
    'border-stroke-width': 0.5,
    'line-stroke-color': '#f00',
    'line-stroke-opacity': 0.1,
    'line-stroke-width': 0.5
};

//==============================================================================

class LineWidth
{
    static scale(width)   // width at zoom 0
    {
        return [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            0, width,
            7, width*128
        ];
    }
}

//==============================================================================

class FeatureFillLayer
{
    static style(id, source_id, layer_id)
    {
        return {
            'id': id,
            'source': source_id,
            'source-layer': layer_id,
            'type': 'fill',
            'filter': [
                '==',
                '$type',
                'Polygon'
            ],
            'paint': {
                'fill-color': PAINT_STYLES['fill-color'],
                'fill-opacity': [
                    "case",
                    [ "has", "feature-id" ],
                    0,
                    PAINT_STYLES['fill-opacity']
                ]
            }
        };
    }
}

//==============================================================================

class FeatureBorderLayer
{
    static style(id, source_id, layer_id)
    {
        return {
            'id': id,
            'source': source_id,
            'source-layer': layer_id,
            'type': 'line',
            'filter': [
                '==',
                '$type',
                'Polygon'
            ],
            'paint': {
                'line-color': PAINT_STYLES['border-stroke-color'],
                'line-opacity': [
                    "case",
                    [ "has", "feature-id" ],
                    1,
                    PAINT_STYLES['border-stroke-opacity']
                ],
                'line-width': LineWidth.scale(PAINT_STYLES['border-stroke-width'])
            }
        };
    }
}

//==============================================================================

class FeatureLineLayer
{
    static style(id, source_id, layer_id)
    {
        return {
            'id': id,
            'source': source_id,
            'source-layer': layer_id,
            'type': 'line',
            'filter': [
                '==',
                '$type',
                'LineString'
            ],
            'paint': {
                'line-color': PAINT_STYLES['line-stroke-color'],
                'line-opacity': PAINT_STYLES['line-stroke-opacity'],
                'line-width': LineWidth.scale(PAINT_STYLES['line-stroke-width'])
            }
        };
    }
}

//==============================================================================

export class FeatureLayer
{
    static styles(source_id, layer_id)
    {
        return [
            FeatureFillLayer.style(`${layer_id}-fill`, source_id, layer_id),
            FeatureBorderLayer.style(`${layer_id}-border`, source_id, layer_id),
            FeatureLineLayer.style(`${layer_id}-line`, source_id, layer_id)
        ];
    }
}

//==============================================================================

export class ImageLayer
{
    static style(source_id, layer_id)
    {
        return {
            'id': `${layer_id}-image`,
            'source': source_id,
            'type': 'raster',
            'paint': {
                'raster-opacity': PAINT_STYLES['image-opacity']
            }
        };
    }
}

//==============================================================================
