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

export const PATH_TYPES = [
    { type: "cns", label: "CNS"},
    { type: "lcn", label: "Local circuit neuron"},
    { type: "para-pre", label: "Parasympathetic pre-ganglionic"},
    { type: "para-post", label: "Parasympathetic post-ganglionic"},
    { type: "sensory", label: "Sensory (afferent) neuron"},
    { type: "somatic", label: "Somatic lower motor"},
    { type: "symp-pre", label: "Sympathetic pre-ganglionic"},
    { type: "symp-post", label: "Sympathetic post-ganglionic"}
];

//==============================================================================

function reverseMap(mapping)
//==========================
{
    const reverse = {};
    for (const [key, values] of Object.entries(mapping)) {
        for (const value of values) {
            if (value in reverse) {
                reverse[value].add(key);
            } else {
                reverse[value] = new Set([key]);
            }
        }
    }
    return reverse;
}

//==============================================================================

export class Pathways
{
    constructor(flatmap)
    {
        this._pathLines = flatmap.pathways['path-lines'];    // pathId: [lineIds]
        this._pathNerves = flatmap.pathways['path-nerves'];  // pathId: [nerveIds]

        this._linePaths = reverseMap(this._pathLines);       // lineId: [pathIds]
        this._nervePaths = reverseMap(this._pathNerves);     // nerveId: [pathIds]

        const nodePaths = flatmap.pathways['node-paths'];
        this._nodeStartPaths = nodePaths['start-paths'];      // nodeId: [pathIds]
        this._nodeThroughPaths = nodePaths['through-paths'];  // nodeId: [pathIds]
        this._nodeEndPaths = nodePaths['end-paths'];          // nodeId: [pathIds]

        this._typePaths = flatmap.pathways['type-paths'];     // nerve-type: [pathIds]

        const featureIds = new Set();
        for (const paths of Object.values(this._nodeStartPaths)) {
            this.addFeatures_(featureIds, paths);
        }
        for (const paths of Object.values(this._nodeThroughPaths)) {
            this.addFeatures_(featureIds, paths);
        }
        for (const paths of Object.values(this._nodeEndPaths)) {
            this.addFeatures_(featureIds, paths);
        }
        this._allFeatureIds = featureIds;
    }

    addFeatures_(featureSet, paths)
    //=============================
    {
        for (const path of paths) {
            if (path in this._pathLines) {
                this._pathLines[path].forEach(lineId => featureSet.add(lineId));
                this._pathNerves[path].forEach(nerveId => featureSet.add(nerveId));
            }
        }
    }

    allFeatureIds()
    //=============
    {
        return this._allFeatureIds;
    }

    featureIdsForLines(lineIds)
    //=========================
    {
        const featureIds = new Set();
        for (const lineId of lineIds) {
            if (lineId in this._linePaths) {
                this.addFeatures_(featureIds, this._linePaths[lineId]);
            }
        }
        return featureIds;
    }

    featureIdsForNerve(nerveId)
    //=========================
    {
        const featureIds = new Set();
        if (nerveId in this._nervePaths) {
            this.addFeatures_(featureIds, this._nervePaths[nerveId]);
        }
        return featureIds;
    }

    isNode(id)
    //========
    {
        return id in this._nodeStartPaths
            || id in this._nodeThroughPaths
            || id in this._nodeEndPaths;
    }

    pathFeatureIds(nodeId)
    //====================
    {
        const featureIds = new Set();
        if (nodeId in this._nodeStartPaths) {
            this.addFeatures_(featureIds, this._nodeStartPaths[nodeId]);
        }
        if (nodeId in this._nodeThroughPaths) {
            this.addFeatures_(featureIds, this._nodeThroughPaths[nodeId]);
        }
        if (nodeId in this._nodeEndPaths) {
            this.addFeatures_(featureIds, this._nodeEndPaths[nodeId]);
        }
        return featureIds;
    }

    typeFeatureIds(pathType)
    //======================
    {
        const featureIds = new Set();
        if (pathType in this._typePaths) {
            this.addFeatures_(featureIds, this._typePaths[pathType]);
        }
        return featureIds;
    }
}

//==============================================================================
