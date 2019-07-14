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
    'layer-background-opacity': 0.5,
    'fill-color': '#fff',
    'fill-opacity': 0,
    'border-stroke-color': [ 'case', ['boolean', ['feature-state', 'highlighted'], false], 'green', 'blue' ],
    'border-stroke-width': 0.5,
    'line-stroke-color': [ 'case', ['boolean', ['feature-state', 'highlighted'], false], 'green', 'red' ],
    'line-stroke-opacity': 0,
    'line-stroke-width': 0.5
};

//==============================================================================

export function borderOpacity(layerActive=false, annotating=false)
{
    if (layerActive) {
        return annotating ? 1 : [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 1,
            ['boolean', ['feature-state', 'highlighted'], false], 1,
            ['boolean', ['feature-state', 'annotated'], false], 1,
            0
        ];
    } else {
        return 0;
    }
}

export function lineOpacity(layerActive=false, annotating=false)
{
    if (layerActive) {
        return annotating ? 1 : [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 0,
            ['boolean', ['feature-state', 'highlighted'], false], 0.4,
            ['boolean', ['feature-state', 'annotated'], false], 0,
            0
        ];
    } else {
        return 0;
    }
}

export function lineWidth(width, layerActive=false, annotating=false)
{
    if (layerActive) {
        return LineWidth.scale(width, annotating)
    }
    else {
        return 0;
    }
}

//==============================================================================

class LineWidth
{
    static scale(width, annotating=false)   // width at zoom 0
    {
        return [
            "let", "linewidth", [
                'case',
                ['boolean', ['feature-state', 'selected'], false], 3*width,
                ['boolean', ['feature-state', 'highlighted'], false], 2*width,
                ['boolean', ['feature-state', 'annotated'], false], width,
                annotating ? width : 0
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
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'highlighted'], false], 0.5,
                    0
                ]
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
                'line-opacity': lineOpacity(),
                'line-width': lineWidth(PAINT_STYLES['border-stroke-width'])
            }
        };
    }

    static lineWidth(layerActive=false, annotating=false)
    {
        return lineWidth(PAINT_STYLES['border-stroke-width'], layerActive, annotating);
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
                'line-opacity': lineOpacity(),
                'line-width': lineWidth(PAINT_STYLES['line-stroke-width'])
            }
        };
    }

    static lineWidth(layerActive=false, annotating=false)
    {
        return lineWidth(PAINT_STYLES['line-stroke-width'], layerActive, annotating);
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
