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

function domContextMenu(items)
{
    const menuElement = document.createElement('ul');
    menuElement.className = 'flatmap-contextmenu';
    menuElement.setAttribute('type', 'context');

    for (const item of items) {
        if (item === '-') {
            menuElement.appendChild(document.createElement('hr'));
        } else {
            const menuItem = document.createElement('li');
            menuItem.className = 'flatmap-contextmenu-item';
            menuItem.setAttribute('id', item.id);
            menuItem.onclick = item.action;
            menuItem.textContent = item.prompt;
            menuElement.appendChild(menuItem);
        }
    }

    return menuElement;
}

/*
<ul>
  <li>prompt</li>
  <li>item 2</li>
</ul>
*/

//==============================================================================

export class ContextMenu
{
    constructor(flatmap, closeCallback)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;
        this._closeCallback = closeCallback;
        this._popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: true,
            className: 'flatmap-contextmenu-popup',
            maxWidth: 'none'
        });
        this._popup.on('close', this.popupClose_.bind(this));
    }

    hide()
    //====
    {
        this._popup.remove();
    }

    popupClose_(e)
    //============
    {
        this._closeCallback();
    }

    show(position, menuItems)
    //=======================
    {
        this._popup.setLngLat(position);
        this._popup.setDOMContent(domContextMenu(menuItems));
        this._popup.addTo(this._map);
    }
}

//==============================================================================
