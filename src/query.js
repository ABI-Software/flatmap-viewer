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

const N3 = require('n3');

//==============================================================================

import {mapEndpoint} from './endpoints.js';
import {MessagePasser} from './messages.js';

//==============================================================================

export class QueryInterface
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._store = new N3.Store();
        this._parser = new N3.Parser();
        this.loadStore_().then(() => {
            this._engine = Comunica.newEngine();
            // We only now are ready to start accepting queries...
            this._messagePasser = new MessagePasser('query-interface', json => this.processMessage_(json));
        }, err => console.log(err));
    }

    async loadStore_()
    //================
    {
        return new Promise(async(resolve, reject) => {
            const response = await fetch(mapEndpoint(`flatmap/${this._flatmap.id}/annotations`), {
                 method: 'GET'
            });
            if (!response.ok) {
                reject(new Error(`Missing RDF for ${this._flatmap.id} map...`));
            } else {
                const rdf = await response.text();
                this._parser.parse(rdf, (error, quad, prefixes) => {
                    if (error) {
                        console.log('RDF error:', error);
                    } else if (quad) {
                        this._store.addQuad(quad);
                    } else {
                        resolve(prefixes);
                    }
                });
            }
        });
    }


    async processMessage_(msg)
    //========================
    {
        const sparql = (msg.action === 'flatmap-query-node-single') ? `PREFIX flatmap: <http://celldl.org/ontologies/flatmap/>
SELECT DISTINCT ?edge
    WHERE { ?edge a flatmap:Edge .
            ?edge ?route1 <${msg.resource}>
          }`
                     : (msg.action === 'flatmap-query-node-connected') ? `PREFIX flatmap: <http://celldl.org/ontologies/flatmap/>
SELECT DISTINCT ?edge ?node
    WHERE { ?edge a flatmap:Edge .
            ?edge ?route1 <${msg.resource}> .
            ?edge ?route2 ?node .
            ?node a flatmap:Node
          }`
                     : null;
        if (sparql) {
            const queryResult = await this._engine.query(sparql, {
                sources: [{
                    type: 'rdfjsSource',
                    value: this._store
                }]
            })
            const features = [];
            queryResult.bindingsStream.on('data', data => {
                for (const d of data.values()) {
                    features.push(d.value);
                }
            });
            queryResult.bindingsStream.on('end', () => {
                // We remove any duplicates before broadcasting the results array
                this._messagePasser.broadcast('flatmap-query-results', [... new Set(features)]);
            });
        } else {
            this._messagePasser.broadcast('flatmap-query-results', []);
        }
    }
}

//==============================================================================
