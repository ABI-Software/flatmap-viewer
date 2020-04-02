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

const FEATURE_SOURCE_ID = 'features';

//==============================================================================

export const PAINT_STYLES = {
    'background-opacity': 0.3,
    'layer-background-opacity': 0.5,
    'fill-color': '#fff',
    'border-stroke-width': 0.5,
    'line-stroke-opacity': 0,
    'line-stroke-width': 0.5
};

//==============================================================================

export function borderColour(layerActive=false)
{
    return [
        'case',
        ['boolean', ['feature-state', 'annotation-error'], false], 'pink',
        ['boolean', ['feature-state', 'highlighted'], false], 'green',
        'blue'
    ];
}

export function borderOpacity(layerActive=false)
{
    if (layerActive) {
        return [
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

//==============================================================================

export function lineColour(layerActive=false)
{
    return [
        'case',
        ['boolean', ['feature-state', 'annotation-error'], false], 'pink',
        ['boolean', ['feature-state', 'highlighted'], false], 'green',
        'red'
    ];
}

export function lineOpacity(layerActive=false)
{
    if (layerActive) {
        return [
            'case',
            ['boolean', ['feature-state', 'annotation-error'], false], 0.8,
            ['boolean', ['feature-state', 'highlighted'], false], 0.4,
            ['boolean', ['feature-state', 'selected'], false], 0,
            ['boolean', ['feature-state', 'annotated'], false], 0,
            0
        ];
    } else {
        return 0;
    }
}

//==============================================================================

class LineWidth
{
    static scale(width)   // width at zoom 3
    {
        return [
            "let", "linewidth", [
                'case',
                ['boolean', ['feature-state', 'annotation-error'], false], 4*width,
                ['boolean', ['feature-state', 'highlighted'], false], 2*width,
                ['boolean', ['feature-state', 'selected'], false], 3*width,
                ['boolean', ['feature-state', 'annotated'], false], width,
                0
            ],
            ["interpolate",
            ["exponential", 1.4],
            ["zoom"],
            3, ["var", "linewidth"],
            10, [ "*", 10, ["var", "linewidth"]]
            ]
        ];
    }
}

//==============================================================================

function lineWidth_(width, layerActive=false)
{
    if (layerActive) {
        return LineWidth.scale(width);
    }
    else {
        return 0;
    }
}

//==============================================================================

export class FeatureFillLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-fill`,
            'source': FEATURE_SOURCE_ID,
            'source-layer': sourceLayer,
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
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-border`,
            'source': FEATURE_SOURCE_ID,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                '==',
                '$type',
                'Polygon'
            ],
            'paint': {
                'line-color': borderColour(),
                'line-opacity': borderOpacity(),
                'line-width': lineWidth_(PAINT_STYLES['border-stroke-width'])
            }
        };
    }

    static lineWidth(layerActive=false)
    {
        return lineWidth_(PAINT_STYLES['border-stroke-width'], layerActive);
    }
}

//==============================================================================

export class FeatureLineLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-line`,
            'source': FEATURE_SOURCE_ID,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                '==',
                '$type',
                'LineString'
            ],
            'paint': {
                'line-color': lineColour(),
                'line-opacity': lineOpacity(),
                'line-width': lineWidth_(PAINT_STYLES['line-stroke-width'])
            }
        };
    }

    static lineWidth(layerActive=false)
    {
        return lineWidth_(PAINT_STYLES['line-stroke-width'], layerActive);
    }
}

//==============================================================================

export class ImageLayer
{
    static style(sourceLayer, opacity=0)
    {
        return {
            'id': `${sourceLayer}-image`,
            'source': `${sourceLayer}-image`,
            'type': 'raster',
            'paint': {
                'raster-opacity': opacity
            }
        };
    }
}

//==============================================================================
