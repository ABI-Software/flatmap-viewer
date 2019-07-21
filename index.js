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

// Load the SPARQL query engine we use. NB. It's not `npm` compatible and doing
// this is one way to ensure things work

const COMUNICA_SPARQL_RDFJS = 'http://rdf.js.org/comunica-browser/versions/1/packages/actor-init-sparql-rdfjs/comunica-browser.js';

const comunicaScript = document.createElement('script');
document.head.appendChild(comunicaScript);
comunicaScript.setAttribute('src', COMUNICA_SPARQL_RDFJS);

//==============================================================================

import {MapManager} from './src/flatmap.js';

const mapManager = new MapManager();

window.loadMap = mapManager.loadMap.bind(mapManager);

//==============================================================================
