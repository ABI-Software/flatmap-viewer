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

export const PAINT_STYLES = {
    'background-opacity': 0.2,
    'fill-color': '#fff',
    'fill-opacity': 0,
    'border-stroke-color': 'blue',
    'border-stroke-width': 1.5,
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
            "let", "linewidth", [
                'case',
                ['boolean', ['feature-state', 'highlighted'], false], 2*width,
                ['has', 'feature-id'], width,
                0
            ],
            ["interpolate",
            ["exponential", 1.3],
            ["zoom"],
            0, ["var", "linewidth"],
            7, [ "*", 10, ["var", "linewidth"]]
            ]
        ];
    }
}

//==============================================================================

export class FeatureFillLayer
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
                'fill-opacity': PAINT_STYLES['fill-opacity']
            }
        };
    }
}

//==============================================================================

export class FeatureBorderLayer
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
                'line-opacity': FeatureBorderLayer.lineOpacity(),
                'line-width': FeatureBorderLayer.lineWidth()
            }
        };
    }

    static lineOpacity(layerActive=false)
    {
        if (layerActive) {
            return [
                'case',
                ['boolean', ['feature-state', 'highlighted'], false], 1,
                ['has', 'feature-id'], 1,
                0
            ];
        } else {
            return 0;
        }
    }

    static lineWidth(layerActive=false)
    {
        if (layerActive) {
            return LineWidth.scale(PAINT_STYLES['border-stroke-width'])
        }
        else {
            return 0;
        }
    }
}

//==============================================================================

export class FeatureLineLayer
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

export class ImageLayer
{
    static style(id, source_id, opacity=0)
    {
        return {
            'id': id,
            'source': source_id,
            'type': 'raster',
            'paint': {
                'raster-opacity': opacity
            }
        };
    }
}

//==============================================================================
