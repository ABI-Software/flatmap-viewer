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

import { FEATURE_SOURCE_ID } from './utils.js';

//==============================================================================

export const PAINT_STYLES = {
    'background-opacity': 0.8,
    'layer-background-opacity': 1.0,
    'fill-color': '#fff',
    'border-stroke-width': 0.5,
    'line-stroke-opacity': 0.7,
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
            'layout': {
                'fill-sort-key': ['get', 'scale']
            },
            'paint': {
                'fill-color': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], '#fcc',
                    ['boolean', ['feature-state', 'highlighted'], false], '#cfc',
                    PAINT_STYLES['fill-color']
                ],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 0.7,
                    ['boolean', ['feature-state', 'highlighted'], false], 0.5,
                    0.7
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
                'line-opacity': [   // borderOpacity(),
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 0.9,
                    ['boolean', ['feature-state', 'highlighted'], false], 0.9,
                    ['boolean', ['get', 'invisible'], false], 0.05,
                    0.01
                ],
                'line-width': 2 // lineWidth_(PAINT_STYLES['border-stroke-width'])
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
                'line-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 0.9,
                    ['boolean', ['feature-state', 'highlighted'], false], 0.9,
                    ['boolean', ['feature-state', 'visible'], false], 0.9,
                    ['boolean', ['get', 'invisible'], false], 0.001,
                    0.08
                ],
                'line-width': [   // borderOpacity(),
                    'case',
                    ['boolean', ['feature-state', 'visible'], false], 2,
                    ['boolean', ['get', 'invisible'], false], 1,
                    1
                ]
            }
        };
    }

    static lineWidth(layerActive=false)
    {
        return lineWidth_(PAINT_STYLES['line-stroke-width'], layerActive);
    }
}

//==============================================================================

export class FeatureLargeSymbolLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-large-symbol`,
            'source': FEATURE_SOURCE_ID,
            'source-layer': sourceLayer,
            'type': 'symbol',
            'minzoom': 3,
            //'maxzoom': 7,
            'filter': [
                'all',
                ['has', 'labelled'],
                ['has', 'label']
            ],
            'layout': {
                'visibility': 'visible',
                'icon-allow-overlap': true,
                'icon-image': 'label-background',
                'text-allow-overlap': true,
                'text-field': '{label}',
                'text-font': ['Open Sans Regular'],
                'text-line-height': 1,
                'text-max-width': 5,
                'text-size': 16,
                'icon-text-fit': 'both'
            },
            'paint': {
                'text-color': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], '#8300bf',
                    '#000'
                ]
            }
        };
    }
}

//==============================================================================

export class FeatureSmallSymbolLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-small-symbol`,
            'source': FEATURE_SOURCE_ID,
            'source-layer': sourceLayer,
            'type': 'symbol',
            'minzoom': 6,
            'filter': [
                'all',
                ['has', 'label'],
                ['>', 'scale', 5]
            ],
            'layout': {
                'visibility': 'visible',
                'icon-allow-overlap': true,
                'icon-image': 'label-background',
                'text-allow-overlap': true,
                'text-field': '{label}',
                'text-font': ['Open Sans Regular'],
                'text-line-height': 1,
                'text-max-width': 5,
                'text-size': {'stops': [[5, 8], [7, 12], [9, 20]]},
                'icon-text-fit': 'both'
            },
            'paint': {
                'text-color': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], '#8300bf',
                    '#000'
                ]
            }
        };
    }
}

//==============================================================================

export class ImageLayer
{
    static style(sourceLayer, opacity=0.8)
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
