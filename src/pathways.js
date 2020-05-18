/******************************************************************************

Flatmap viewer and annotation tool

Copyright (c) 2020  David Brooks

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

export class Pathways
{
    constructor(flatmap)
    {
        this._pathFeatures = flatmap.pathways['path-features'];
        const nodePaths = flatmap.pathways['node-paths'];
        this._nodeStartPaths = nodePaths['start-paths'];
        this._nodeThroughPaths = nodePaths['through-paths'];
        this._nodeEndPaths = nodePaths['end-paths'];
    }

    isNode(id)
    {
        return id in this._nodeStartPaths
            || id in this._nodeThroughPaths
            || id in this._nodeEndPaths;
    }

    pathFeatures(nodeId)
    {
        const lines = new Set();
        if (nodeId in this._nodeStartPaths) {
            for (const path of this._nodeStartPaths[nodeId]) {
                if (path in this._pathFeatures) {
                    for (const line of this.__pathFeatures[path]) {
                        lines.add(line);
                    }
                }
            }
        }
        if (nodeId in this._nodeThroughPaths) {
            for (const path of this._nodeThroughPaths[nodeId]) {
                if (path in this.__pathFeatures) {
                    for (const line of this.__pathFeatures[path]) {
                        lines.add(line);
                    }
                }
            }
        }
        if (nodeId in this._nodeEndPaths) {
            for (const path of this._nodeEndPaths[nodeId]) {
                if (path in this.__pathFeatures) {
                    for (const line of this.__pathFeatures[path]) {
                        lines.add(line);
                    }
                }
            }
        }
        return lines.values();
    }
}

//==============================================================================
