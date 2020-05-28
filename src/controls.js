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
        this._container.className = 'mapboxgl-ctrl';
        this._container.id = 'flatmap-nerve-key';

        this._legend = document.createElement('div');
        this._legend.id = 'nerve-key-text';
        this._legend.className = 'flatmap-nerve-grid';
        this._legend.innerHTML = `<div kind="cns">CNS</div><div kind="cns" class="nerve-line nerve-cns"></div>
<div kind="lcn">Local circuit neuron</div><div kind="lcn" class="nerve-line nerve-lcn"></div>
<div kind="para-pre">Parasympathetic pre-ganglionic</div><div kind="para-pre" class="nerve-line nerve-para-pre"></div>
<div kind="para-post">Parasympathetic post-ganglionic</div><div kind="para-post" class="nerve-line nerve-para-post"></div>
<div kind="sensory">Sensory (afferent) neuron</div><div kind="sensory" class="nerve-line nerve-sensory"></div>
<div kind="somatic">Somatic lower motor</div><div kind="somatic" class="nerve-line nerve-somatic"></div>
<div kind="symp-pre">Sympathetic pre-ganglionic</div><div kind="symp-pre" class="nerve-line nerve-symp-pre"></div>
<div kind="symp-post">Sympathetic post-ganglionic</div><div kind="symp-post" class="nerve-line nerve-symp-post"></div>`;

        this._button = document.createElement('button');
        this._button.id = 'nerve-key-button';
        this._button.className = 'control-button';
        this._button.title = 'Nerve paths legend';
        this._button.setAttribute('type', 'button');
        this._button.setAttribute('aria-label', 'Nerve paths legend');
        this._button.setAttribute('legend-visible', 'false');
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
            if (this._button.getAttribute('legend-visible') === 'false') {
                this._container.appendChild(this._legend);
                this._button.setAttribute('legend-visible', 'true');
                this._legend.focus();
            } else {
                this._legend = this._container.removeChild(this._legend);
                this._button.setAttribute('legend-visible', 'false');
            }
        } else {
            const pathType = event.target.getAttribute('kind');
            if (pathType) {
                this._ui.showPaths(pathType);
            }
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
        this._container.className = 'mapboxgl-ctrl';
        this._container.id = 'flatmap-path-control';
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
