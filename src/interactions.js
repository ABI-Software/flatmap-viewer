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

import {AnnotationControl, Annotator} from './annotation.js';
import {ContextMenu} from './contextmenu.js';
import {MessagePasser} from './messages.js';
import {LayerSwitcher} from './layerswitcher.js'
import {ToolTip} from './tooltip.js'

//==============================================================================

function domFeatureDescription(annotation)
{
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'flatmap-feature-tooltip';

    for (const value of annotation.annotation.split(/\s+/)) {
        const valueElement = document.createElement('div');
        valueElement.className = 'flatmap-feature-property';
        valueElement.textContent = value;
        tooltipElement.appendChild(valueElement);
    }

    return tooltipElement;
}

//==============================================================================

export class UserInteractions
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;

        this._highlightedFeature = null;
        this._modal = false;


        for (const [id, annotation] of Object.entries(flatmap.annotations)) {
            const feature = {
                id: id.split('-')[1],
                source: "features",
                sourceLayer: annotation.layer
            }
            this._map.setFeatureState(feature, { "annotated": true });
        }

        if (flatmap.annotatable) {
            this._annotator = new Annotator(flatmap, this);
        }

        this._map.addControl(new LayerSwitcher(flatmap, 'Select organ system'));

        // Display a tooltip at the mouse pointer

        this._tooltip = new ToolTip(flatmap);
        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));

        // Display a context menu on right-click

        this._contextMenu = new ContextMenu(flatmap);
        this._map.on('contextmenu', this.contextMenuEvent_.bind(this));

        // Setup callbacks
        //NB. Can be restricted to a layer...

        this._map.on('click', this.clickEvent_.bind(this));

        // Pass messages with other applications

        this._messagePasser = new MessagePasser(flatmap.id, json => this.processMessage_(json));
    }

    get annotating()
    //==============
    {
        return this._flatmap.annotatable && this._annotator.enabled;
    }

    get currentLayer()
    //================
    {
        return `${this._flatmap.id}/${this._flatmap.layerManager.activeLayerId}`;
    }

    activateLayer(layerId)
    //====================
    {
        this._flatmap.layerManager.activate(layerId, this.annotating);
    }

    processMessage_(msg)
    //==================
    {
        if (msg.action === 'activate-layer') {
            this.activateLayer(msg.resource);

            }

        }
    }

    highlightFeature_(feature)
    //========================
    {
        this.unhighlightFeatures_(false);
        this._map.setFeatureState(feature, { "highlighted": true })
        this._highlightedFeature = feature;
    }

    unhighlightFeatures_(reset=true)
    //==============================
    {
        if (this._highlightedFeature !== null) {
            this._map.removeFeatureState(this._highlightedFeature, "highlighted");
            if (reset) {
                this._highlightedFeature = null;
            }
        }
    }

    activeFeatures_(e)
    //================
    {
        const activeLayerId = this._flatmap.activeLayerId;
        return this._map.queryRenderedFeatures(e.point).filter(f => {
            return activeLayerId === f.sourceLayer
                && 'id' in f.properties;
            }
        );
    }

    mouseMoveEvent_(e)
    //================
    {
        if (this._modal) {
            return;
        }

        const features = this.activeFeatures_(e);

        // Highlight top feature

        for (const feature of features) {
            if (this.annotating || this._flatmap.hasAnnotationAbout(feature.properties.id)) {
                const annotation = this._flatmap.annotationAbout(feature.properties.id);
                this.highlightFeature_(feature);
                if (annotation) {
                    this._tooltip.show(e.lngLat, domFeatureDescription(annotation));
                }
                this._map.getCanvas().style.cursor = 'pointer';
                return;
            }
        }
        this._map.getCanvas().style.cursor = '';
        this._tooltip.hide();
        this.unhighlightFeatures_();
    }

    contextMenuEvent_(e)
    //==================
    {
        e.preventDefault();

        const features = this.activeFeatures_(e);

        for (const feature of features) {
            if (this.annotating || this._flatmap.hasAnnotationAbout(feature.properties.id)) {
                const id = feature.properties.id;


                this.highlightFeature_(feature);
                this._tooltip.hide();
                this._modal = true;

                this._contextMenu.show(e.lngLat, [
                    { id: id,
                      prompt: 'Query',
                      action: this.query_.bind(this)
                    },
                    '-',
                    { id: id,
                      prompt: 'Annotate',
                      action: this.annotate_.bind(this)
                    }
                ]);

                return;
            }
        }
    }

    annotate_(e)
    //==========
    {
        this._contextMenu.hide();
        this._annotator.showDialog(e.target.getAttribute('id'),
                                   () => { this._modal = false; });
    }

    query_(e)
    //=======
    {
        console.log(e);
        this._messagePasser.broadcast('query', 'xx', {});

        this._contextMenu.hide();
        this._modal = false;
    }

    clickEvent_(e)
    //============
    {
        const features = this.activeFeatures_(e);

        for (const feature of features) {
            if (this._flatmap.hasAnnotationAbout(feature.properties.id)) {
                const annotation = this._flatmap.annotationAbout(feature.properties.id);
                this._messagePasser.broadcast('select', feature.properties.id, annotation);
                return;
            }
        }
    }

}

//==============================================================================
