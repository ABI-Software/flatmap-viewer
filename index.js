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

import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import 'mapbox-gl-inspect/dist/mapbox-gl-inspect.css';
import MapboxInspect from 'mapbox-gl-inspect';

//==============================================================================

function loadMap(mapId, htmlElementId)
{
    const map = new mapboxgl.Map({
        container: htmlElementId,
        hash: true,
        style: {
            version: 8,
            sources: {
                vectorSource: {
                    type: 'vector',
                    url: `/${mapId}/`
                }
            },
            zoom: 7,
            center: [1.35, 1.95],
            layers: []
        }
    });

    map.addControl(new mapboxgl.NavigationControl({showCompass: false}));
    map.dragRotate.disable();

    var inspect = new MapboxInspect({
        popup: new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
        }),
        showInspectMap: true
        //showInspectButton: true
    });
    map.addControl(inspect);
}

//==============================================================================

window.loadMap = loadMap;

//==============================================================================
