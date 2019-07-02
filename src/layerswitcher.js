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

import {MessagePasser} from './messages.js';
//  Broadcast's an 'activate-layer LAYER_ID' message


//==============================================================================

function newOption(value, prompt)
{
    const option = document.createElement('option');
    option.setAttribute('value', value);
    option.textContent = prompt;
    return option;
}

//==============================================================================

export class LayerSwitcher
{
    constructor(flatmap, prompt='Select layer')
    {
        this._flatmap = flatmap;
        this._prompt = prompt;
        this._messagePasser = new MessagePasser(flatmap.id, json => this.processMessage_(json));
    }

    onAdd(map)
    //========
    {
        this._map = map;

        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';

        const features = this._map.getSource('features');
        const featureDescriptions = new Map();
        for (const layer of this._flatmap.layers) {
            featureDescriptions.set(layer.id, layer.description);
        }

        const selector = document.createElement('select');
        selector.onchange = this.selectionChanged_.bind(this);
        selector.appendChild(newOption('', `${this._prompt}:`));
        for (const layer of this._flatmap.layers) {
            const description = featureDescriptions.get(layer.id);
            if (description !== '') {
                selector.appendChild(newOption(`${this._flatmap.id}/${layer.id}`, description));
            }
        }

        this._container.appendChild(selector);
        return this._container;
    }

    onRemove()
    //========
    {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    getDefaultPosition()
    //==================
    {
        return 'top-left';
    }

    processMessage_(msg)
    //==================
    {
        if (msg.action === 'activate-layer') {
            // change selected status of option with ID === msg.resource
            for (const option of this._container.children[0].children) {
                if (option.value === msg.resource) {
                    if (option.selected) {
                        break;   // No change
                    }
                    option.selected = true;
                } else if (option.selected
                        && msg.resource.startsWith(`${this._flatmap.id}/`)) {
                    option.selected = false;
                }
            }
        }
    }

    selectionChanged_(e)
    //==================
    {
        this._messagePasser.broadcast('activate-layer', e.target.value);
    }
}

//==============================================================================
