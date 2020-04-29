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

import mapboxgl from 'mapbox-gl';

//==============================================================================

import { indexedProperties } from './search.js';

//==============================================================================

export class InfoControl
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._map = undefined;
        this._active = false;
    }

    get active()
    //==========
    {
        return this._active;
    }

    getDefaultPosition()
    //==================
    {
        return 'top-right';
    }

    onAdd(map)
    //========
    {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl info-control';
        // https://iconmonstr.com/info-6-svg/
        this._container.innerHTML = `<button class="control-button" id="info-control-button">
     <svg xmlns="http://www.w3.org/2000/svg" id="info-control-icon" viewBox="0 0 24 24">
       <path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-.001 5.75c.69 0 1.251.56 1.251 1.25s-.561 1.25-1.251 1.25-1.249-.56-1.249-1.25.559-1.25 1.249-1.25zm2.001 12.25h-4v-1c.484-.179 1-.201 1-.735v-4.467c0-.534-.516-.618-1-.797v-1h3v6.265c0 .535.517.558 1 .735v.999z"/>
     </svg>
    </button>`;
        this._container.onclick = this.onClick_.bind(this);
        return this._container;
    }

    onRemove()
    //========
    {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    onClick_(e)
    //=========
    {
        const targetId = ('rangeTarget' in e) ? e.rangeTarget.id : e.target.id; // FF has rangeTarget
        if (['info-control-button', 'info-control-icon'].includes(targetId)) {
            const button = document.getElementById('info-control-button');
            if (!this._active) {
                this._active = true;
                button.classList.add('control-button-active');
            } else {
                this._active = false;
                button.classList.remove('control-button-active');
            }
        }
    }

    featureInformation(features, location)
    //====================================
    {
        // Get all features if the control is active otherwise just the highlighted ones

        const featureList = (this._active || this._flatmap.options.debug) ? features
                            : features.filter(feature => this._map.getFeatureState(feature)['highlighted']);

        if (featureList.length === 0) {
            return '';
        }

        let html = '';
        if (this._flatmap.options.debug) {
            // See example at https://docs.mapbox.com/mapbox-gl-js/example/queryrenderedfeatures/

            // Limit the number of properties we're displaying for
            // legibility and performance
            const displayProperties = [
                'type',
                'properties',
                'id',
                'layer',
                'source',
                'sourceLayer',
                'state'
            ];

            // Do we filter for smallest properties.area (except lines have area == 0)
            // with lines having precedence... ??

            const displayFeatures = featureList.map(feat => {
                const displayFeat = {};
                displayProperties.forEach(prop => {
                    displayFeat[prop] = feat[prop];
                });
                return displayFeat;
            });

            const content = JSON.stringify(
                displayFeatures,
                null,
                2
            );

            html = `<pre class="info-control-features">${JSON.stringify(location)}\n${content}</pre>`;
        } else {
            const displayValues = new Map();
            for (const feature of featureList) {
                if (!displayValues.has(feature.properties.id)) {
                    const values = {};
                    indexedProperties.forEach(prop => {
                        if (prop in feature.properties) {
                            values[prop] = feature.properties[prop];
                        }
                    });
                    displayValues.set(feature.properties.id, values);
                }
            }

            const htmlList = [];

            if (this._flatmap.options.showPosition) {
                const position = location;
                htmlList.push(`<span class="info-name">Position:</span>`);
                htmlList.push(`<span class="info-value">(${position.lng}, ${position.lat})</span>`);
            }

            for (const values of displayValues.values()) {
                for (const prop of indexedProperties) {
                    if (prop in values) {
                        htmlList.push(`<span class="info-name">${prop}:</span>`);
                        htmlList.push(`<span class="info-value">${values[prop]}</span>`);
                    }
                }
            }
            if (htmlList.length === 0) {
                return;
            }

            html = `<div id="info-control-info">${htmlList.join('\n')}</div>`;
        }
        return html;
    }
}

//==============================================================================
