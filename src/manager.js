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

import * as utils from './utils.js';

//==============================================================================

export class MapManager
{
    constructor()
    {
        this._idToSource = new Map();
        this._sourceToId = new Map();
    }

    async getMaps()
    //=============
    {
        const mapsQuery = await fetch(utils.makeUrlAbsolute('flatmap/'), {
            headers: { "Content-Type": "application/json; charset=utf-8" },
            method: 'GET'
        });
        if (!mapsQuery.ok) {
            const errMsg = 'Error requesting flatmaps...';
            console.log(errMsg);
            alert(errMsg);
            return;
        }
        const maps = await mapsQuery.json();
        for (const map of maps) {
            this._idToSource.set(map.id, map.source);
            this._sourceToId.set(map.source, map.id);
        }
    }

    mapId(source)
    //===========
    {
        return this._sourceToId.get(source);
    }

    source(mapId)
    //===========
    {
        return this._idToSource.get(mapId);
    }
}

//==============================================================================
