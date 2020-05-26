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

export class NavigationControl
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._map = undefined;
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
        this._container.className = 'mapboxgl-ctrl navigation-group';
        this._container.innerHTML = `<button id="flatmap-zoom-in" class="navigation-zoom-in" type="button" title="Zoom in" aria-label="Zoom in"></button>
<button id="flatmap-zoom-out" class="navigation-zoom-out" type="button" title="Zoom out" aria-label="Zoom out"></button>
<button id="flatmap-reset" class="navigation-reset" type="button" title="Reset" aria-label="Reset"></button>`;
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
        if        (e.target.id === 'flatmap-zoom-in') {
            this._map.zoomIn();
        } else if (e.target.id === 'flatmap-zoom-out') {
            this._map.zoomOut();
        } else if (e.target.id === 'flatmap-reset') {
            this._flatmap.resetMap();
        }
    }
}

//==============================================================================

export class NerveKey
{
    constructor()
    {
        this._map = undefined;
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
        this._container.className = 'mapboxgl-ctrl flatmap-nerve-key';

        this._legend = document.createElement('div');
        this._legend.id = 'nerve-key-text';
        this._legend.className = 'flatmap-nerve-grid';
        this._legend.innerHTML = `<div>CNS</div><div class="nerve-line nerve-cns"></div>
<div>Local circuit neuron</div><div class="nerve-line nerve-lcn"></div>
<div>Parasympathetic pre-ganglionic</div><div class="nerve-line nerve-para-pre"></div>
<div>Parasympathetic post-ganglionic</div><div class="nerve-line nerve-para-post"></div>
<div>Sensory (afferent) neuron</div><div class="nerve-line nerve-sensory"></div>
<div>Somatic lower motor</div><div class="nerve-line nerve-somatic"></div>
<div>Sympathetic pre-ganglionic</div><div class="nerve-line nerve-symp-pre"></div>
<div>Sympathetic post-ganglionic</div><div class="nerve-line nerve-symp-post"></div>`;

        this._button = document.createElement('button');
        this._button.id = 'nerve-key-button';
        this._button.className = 'control-button';
        this._button.title = 'Nerve paths legend';
        this._button.setAttribute('type', 'button');
        this._button.setAttribute('aria-label', 'Nerve paths legend');
        this._button.textContent = 'LGD';
        this._container.appendChild(this._button);

        this._container.addEventListener('click', this.onClick_.bind(this));
        return this._container;
    }

    onRemove()
    //========
    {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    onClick_(event)
    //=============
    {
        if (event.target.id === 'nerve-key-button') {
            this._button = this._container.removeChild(this._button)
            this._container.appendChild(this._legend);
        } else {
            this._legend = this._container.removeChild(this._legend);
            this._container.appendChild(this._button);
        }
        event.stopPropagation();
    }
}

//==============================================================================

export class PathControl
{
    constructor(ui)
    {
        this._ui = ui;
        this._map = undefined;
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
        this._container.className = 'mapboxgl-ctrl flatmap-path-control';
        this._container.innerHTML = `<button class="control-button" id="path-control-button"
                                      type="button" title="Show/hide paths" aria-label="Show/hide paths">PTH</button>`;
        this._container.onclick = this.onClick_.bind(this);
        return this._container;
    }

    onRemove()
    //========
    {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    onClick_(event)
    //=============
    {
        this._ui.togglePaths();
    }
}

//==============================================================================
