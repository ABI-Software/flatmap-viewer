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

import * as utils from './utils.js';

//==============================================================================

export class QueryInterface
{
    constructor()
    {
        this._messagePasser = new MessagePasser('query-interface', json => this.processMessage_(json));
    }

    async processMessage_(msg)
    //========================
    {
        const sparql = (msg.action === 'query-node-edges') ? `PREFIX flatmap: <http://celldl.org/ontologies/flatmap/>
SELECT DISTINCT ?edge
    WHERE { ?edge a flatmap:Edge .
            ?edge ?route1 <${msg.resource}>
          }`
                     : (msg.action === 'query-node-nodes') ? `PREFIX flatmap: <http://celldl.org/ontologies/flatmap/>
SELECT DISTINCT ?edge ?node
    WHERE { ?edge a flatmap:Edge .
            ?edge ?route1 <${msg.resource}> .
            ?edge ?route2 ?node .
            ?node a flatmap:Node
          }`
                     : null;
        if (sparql) {
            const postQuery = await fetch(utils.makeUrlAbsolute('query'), {
                headers: { "Content-Type": "application/json; charset=utf-8" },
                method: 'POST',
                body: JSON.stringify({ sparql: sparql })
            });
            if (!postQuery.ok) {
                const errorMsg = `SPARQL query failed...`;
                console.log(errorMsg);
                alert(errorMsg);
                return;
            }
            const results = await postQuery.json();
            if ('error' in results) {
                const errorMsg = `SPARQL query failed: ${results.error}`;
                console.log(errorMsg);
                alert(errorMsg);
                return;
            }
            const features = [];
            for (const result of results.results.bindings) {
                const value = Object.entries(result)[0][1];
                features.push(value.value);
            }
            if (features.length) {
                this._messagePasser.broadcast('query-results', features);
            }
        }
    }
}

//==============================================================================
