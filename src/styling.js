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

export const VECTOR_TILES_SOURCE = 'vector-tiles';

//==============================================================================

export class BackgroundLayer
{
    static style(backgroundColour)
    {
        return {
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': backgroundColour
            }
        };
    }
}

//==============================================================================

export class BodyLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-body`,
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'fill',
            'filter': [
                'all',
                ['==', '$type', 'Polygon'],
                ['==', 'models', 'UBERON:0013702']
            ],
            'paint': {
                'fill-color': '#F0F0F0',
                'fill-opacity': 1
            }
        };
    }
}

//==============================================================================

export class FeatureFillLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-fill`,
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'fill',
            'filter': [
                'all',
                ['==', '$type', 'Polygon'],
                ['!=', 'models', 'UBERON:0013702']
            ],
            'layout': {
                'fill-sort-key': ['get', 'scale']
            },
            'paint': {
                'fill-color': 'white',
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 0.2,
                    ['boolean', ['feature-state', 'highlighted'], false], 0.3,
                    0.01
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
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                '==',
                '$type',
                'Polygon'
            ],
            'paint': {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 'blue',
                    ['boolean', ['feature-state', 'highlighted'], false], 'red',
                    '#444'
                ],
                'line-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 0.9,
                    ['boolean', ['feature-state', 'highlighted'], false], 0.9,
                    ['boolean', ['get', 'invisible'], false], 0.05,
                    0.3
                ],
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'highlighted'], false], 6,
                    ['boolean', ['get', 'invisible'], false], 0.5,
                    2
                ]
            }
        };
    }
}

//==============================================================================

export class FeatureDividerBorderLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-divider-border`,
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                 'all',
                 ['!has', 'label'],
                 ['==', '$type', 'Polygon']
            ],
            'paint': {
                'line-color': '#444',
                'line-opacity': 0.8,
                'line-width': [
                    'let', 'width', 0.1,
                    [ 'interpolate',
                        ['exponential', 2],
                        ['zoom'],
                         2, ["*", ['var', 'width'], ["^", 2, -1]],
                        10, ["*", ['var', 'width'], ["^", 2,  5]]
                    ]
                ]
            }
        };
    }
}

export class FeatureDividerLineLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-divider-line`,
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                 'all',
                 ['==', '$type', 'LineString']
            ],
            'paint': {
                'line-color': '#444',
                'line-opacity': 0.8,
                'line-width': [
                    'let', 'width', 0.1,
                    [ 'interpolate',
                        ['exponential', 2],
                        ['zoom'],
                         2, ["*", ['var', 'width'], ["^", 2, -1]],
                        10, ["*", ['var', 'width'], ["^", 2,  5]]
                    ]
                ]
            }
        };
    }
}

//==============================================================================

export class FeatureLineLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-line`,
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                 'all',
                 ['==', '$type', 'LineString'],
                 ['==', 'type', 'line']
            ],
            'paint': {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'hidden'], false], '#CCC',
                    ['==', ['get', 'kind'], 'cns'], '#9B1FC1',
                    ['==', ['get', 'kind'], 'lcn'], '#F19E38',
                    ['==', ['get', 'kind'], 'para-pre'], '#3F8F4A',
                    ['==', ['get', 'kind'], 'somatic'], '#98561D',
                    ['==', ['get', 'kind'], 'sensory'], '#2A62F6',
                    ['==', ['get', 'kind'], 'symp-pre'], '#EA3423',
                    'red'
                ],
                'line-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 0.9,
                    ['boolean', ['feature-state', 'highlighted'], false], 0.9,
                    ['boolean', ['feature-state', 'hidden'], false], 0.3,
                    ['boolean', ['get', 'invisible'], false], 0.001,
                    0.9
                ],
                'line-width': [
                    'let', 'width', ['case',
                        ['boolean', ['feature-state', 'active'], false], 0.8,
                        ['boolean', ['feature-state', 'highlighted'], false], 0.6,
                        0.4],
                    [ 'interpolate',
                        ['exponential', 2],
                        ['zoom'],
                         2, ["*", ['var', 'width'], ["^", 2, 1]],
                        10, ["*", ['var', 'width'], ["^", 2, 4]]
                    ]
                ]
            }
        };
    }
}

//==============================================================================

export class FeatureLineDashLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-line-dash`,
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                 'all',
                 ['==', '$type', 'LineString'],
                 ['==', 'type', 'line-dash']
            ],
            'paint': {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'hidden'], false], '#CCC',
                    ['==', ['get', 'kind'], 'para-post'], '#3F8F4A',
                    ['==', ['get', 'kind'], 'symp-post'], '#EA3423',
                    'red'
                ],
                'line-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 1.0,
                    ['boolean', ['feature-state', 'highlighted'], false], 0.9,
                    ['boolean', ['feature-state', 'hidden'], false], 0.3,
                    ['boolean', ['get', 'invisible'], false], 0.001,
                    0.9
                ],
                'line-dasharray': [3, 2],
                'line-width': [
                    'let', 'width', ['case',
                        ['boolean', ['feature-state', 'active'], false], 0.8,
                        ['boolean', ['feature-state', 'highlighted'], false], 0.6,
                        0.4],
                    [ 'interpolate',
                        ['exponential', 2],
                        ['zoom'],
                         2, ["*", ['var', 'width'], ["^", 2, 1]],
                        10, ["*", ['var', 'width'], ["^", 2, 4]]
                    ]
                ]
            }
        };
    }
}

//==============================================================================

export class FeatureNerveLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-nerve`,
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                 'all',
                 ['==', '$type', 'LineString'],
                 ['==', 'type', 'nerve']
            ],
            'paint': {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], '#222',
                    ['boolean', ['feature-state', 'highlighted'], false], '#222',
                    ['boolean', ['feature-state', 'hidden'], false], '#CCC',
                    '#888'
                ],
                'line-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'active'], false], 0.9,
                    ['boolean', ['feature-state', 'highlighted'], false], 0.9,
                    ['boolean', ['feature-state', 'hidden'], false], 0.3,
                    ['boolean', ['get', 'invisible'], false], 0.001,
                    0.9
                ],
                'line-dasharray': [2, 1],
                'line-width': [
                    'let', 'width', ['case',
                        ['boolean', ['feature-state', 'active'], false], 0.8,
                        ['boolean', ['feature-state', 'highlighted'], false], 0.7,
                        0.6],
                    [ 'interpolate',
                        ['exponential', 2],
                        ['zoom'],
                         2, ["*", ['var', 'width'], ["^", 2, -1]],
                        10, ["*", ['var', 'width'], ["^", 2,  6]]
                    ]
                ]
            }
        };
    }
}

//==============================================================================

export class NervePolygonLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-nerve-polygon`,
            'source': VECTOR_TILES_SOURCE,
            'source-layer': sourceLayer,
            'type': 'fill',
            'filter': [
                 'all',
                 ['==', '$type', 'Polygon'],
                 ['==', 'type', 'nerve']
            ],
            'paint': {
                'fill-color': 'white',
                'fill-opacity': 0.01
            }
        };
    }
}

//==============================================================================

export class FeatureLargeSymbolLayer
{
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-large-symbol`,
            'source': VECTOR_TILES_SOURCE,
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
            'source': VECTOR_TILES_SOURCE,
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
    static style(sourceLayer)
    {
        return {
            'id': `${sourceLayer}-image`,
            'source': `${sourceLayer}-image`,
            'type': 'raster'
        };
    }
}

//==============================================================================
