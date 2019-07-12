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

const mapEndpointPath = window.location.pathname.endsWith('/') ? window.location.pathname + 'flatmap/'
                                                               : (window.location.pathname + '/flatmap/');
const mapEndpointBase = window.location.origin + mapEndpointPath;

const queryEndpointPath = window.location.pathname.endsWith('/') ? window.location.pathname + 'query'
                                                                 : (window.location.pathname + '/query');
const queryEndpointBase = window.location.origin + queryEndpointPath;

//const MAP_ENDPOINT = 'https://mapcore-demo.org/current/data-portal/map/flatmap/';
const MAP_ENDPOINT = 'https://celldl.org/flatmaps/demo/flatmap/';
const QUERY_ENDPOINT = 'https://celldl.org/flatmaps/demo/query';

//==============================================================================

export function mapEndpoint(relativePath='')
//==========================================
{
    const url = new URL(relativePath, mapEndpointBase);
//    const url = new URL(relativePath, MAP_ENDPOINT);
    return url.href;
}

//==============================================================================

export function queryEndpoint(relativePath='')
//============================================
{
    const url = new URL(relativePath, queryEndpointBase);
    return url.href;
}

//==============================================================================
