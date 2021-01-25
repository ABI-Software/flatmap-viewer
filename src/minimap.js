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

/* Based on https://github.com/aesqe/mapboxgl-minimap
 *
 * MIT License
 *
 * Copyright (c) 2019 Bruno Babic
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

//==============================================================================

'use strict';

//==============================================================================

import mapboxgl from 'mapbox-gl';

//==============================================================================

const DEFAULTS = {
    fillColor: '#DDD',
    fillOpacity: 0.3,
    lineColor: "#08F",
    lineOpacity: 1,
    lineWidth: 1,
    position: 'bottom-left',
    width: 320
};

//==============================================================================

// if parent map zoom >= 18 and minimap zoom >= 14, set minimap zoom to 16

const ZOOMLEVELS = [
    [18, 14, 16],
    [16, 12, 14],
    [14, 10, 12],
    [12,  8, 10],
    [10,  6,  8]
];

//==============================================================================

export class MinimapControl
{
    constructor(flatmap, options)
    {
        this._flatmap = flatmap;
        this._map = undefined;
        this._container = null;

        // In case parent map background is changed before minimap loads

        this._background = null;
        this._opacity = null;
        this._loaded = false;

        // Check user configurable settings

        this._options = Object.assign({}, DEFAULTS);
        if (typeof options === 'object') {
            if ('position' in options) {
                this._options.position = options.position;
            }
            if ('width' in options) {
                this._options.width = options.width;
            }
        }

        this._ticking = false;
        this._lastMouseMoveEvent = null;
        this._isDragging = false;
        this._isCursorOverFeature = false;
        this._previousPoint = [0, 0];
        this._currentPoint = [0, 0];
        this._trackingRectCoordinates = [[[], [], [], [], []]];
    }

    getDefaultPosition()
    //==================
    {
        return this._options.position;
    }

    onAdd(map)
    //========
    {
        this._map = map;

        // Create the container element

        const container = document.createElement('div');
        container.className = 'mapboxgl-ctrl-minimap mapboxgl-ctrl';
        container.id = 'mapboxgl-minimap';
        this._container = container;

        // Set the size of the container

        const mapCanvasElement = map.getCanvas();
        let width = DEFAULTS.width;
        if (typeof this._options.width === 'string') {
            width = parseInt(this._options.width);
            if (this._options.width.indexOf('%') > 0) {
                width = width*mapCanvasElement.width/100;
            }
        } else if (typeof this._options.width === 'number') {
            width = this._options.width;
        }
        container.setAttribute('style', `width: ${width}px; height: ${width*mapCanvasElement.height/mapCanvasElement.width}px;`);

        // Ignore context menu events

        container.addEventListener('contextmenu', this._preventDefault);

        // Create the actual minimap

        this._miniMap = new mapboxgl.Map({
            attributionControl: false,
            container: container,
            style: map.getStyle(),
            bounds: map.getBounds()

        });

        // Finish initialising once the map has loaded

        this._miniMap.on('load', this.load_.bind(this));

        return this._container;
    }

    onRemove()
    //========
    {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
        this._container = null;
    }

    load_()
    //=====
    {
        const opts = this._options;
        const parentMap = this._map;
        const miniMap = this._miniMap;

        // Disable most user interactions with the minimap

        const interactions = [
            'dragPan', 'scrollZoom', 'boxZoom', 'dragRotate',
            'keyboard', 'doubleClickZoom', 'touchZoomRotate'
        ];
        interactions.forEach(i => miniMap[i].disable());

        // Set background if specified (defaults is the parent map's)

        if (this._background !== null) {
            miniMap.setPaintProperty('background', 'background-color', this._background);
        }
        if (this._opacity !== null) {
            miniMap.setPaintProperty('background', 'background-opacity', this._opacity);
        }

        // Fit minimap to its container

        miniMap.resize();
        miniMap.fitBounds(this._flatmap.bounds);

        const bounds = miniMap.getBounds();
        this.convertBoundsToPoints_(bounds);

        miniMap.addSource('trackingRect', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {
                    'name': 'trackingRect'
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': this._trackingRectCoordinates
                }
            }
        });

        miniMap.addLayer({
            'id': 'trackingRectOutline',
            'type': 'line',
            'source': 'trackingRect',
            'layout': {},
            'paint': {
                'line-color': opts.lineColor,
                'line-width': opts.lineWidth,
                'line-opacity': opts.lineOpacity
            }
        });

        // needed for dragging
        miniMap.addLayer({
            'id': 'trackingRectFill',
            'type': 'fill',
            'source': 'trackingRect',
            'layout': {},
            'paint': {
                'fill-color': opts.fillColor,
                'fill-opacity': opts.fillOpacity
            }
        });

        this._trackingRect = this._miniMap.getSource('trackingRect');

        this.update_();

        parentMap.on('move', this.update_.bind(this));

        miniMap.on('mousemove', this.mouseMove_.bind(this));
        miniMap.on('mousedown', this.mouseDown_.bind(this));
        miniMap.on('mouseup', this.mouseUp_.bind(this));

        miniMap.on('touchmove', this.mouseMove_.bind(this));
        miniMap.on('touchstart', this.mouseDown_.bind(this));
        miniMap.on('touchend', this.mouseUp_.bind(this));

        this._miniMapCanvas = miniMap.getCanvasContainer();
        this._miniMapCanvas.addEventListener('wheel', this.preventDefault_);
        this._miniMapCanvas.addEventListener('mousewheel', this.preventDefault_);
    }

    mouseDown_(e)
    //===========
    {
        if (this._isCursorOverFeature) {
            this._isDragging = true;
            this._previousPoint = this._currentPoint;
            this._currentPoint = [e.lngLat.lng, e.lngLat.lat];
        }
    }

    mouseMove_(e)
    //===========
    {
        this._ticking = false;

        const miniMap = this._miniMap;
        const features = miniMap.queryRenderedFeatures(e.point, {
            layers: ['trackingRectFill']
        });

        // don't update if we're still hovering the area
        if (!(this._isCursorOverFeature && features.length > 0)) {
            this._isCursorOverFeature = features.length > 0;
            this._miniMapCanvas.style.cursor = this._isCursorOverFeature ? 'move' : '';
        }

        if (this._isDragging) {
            this._previousPoint = this._currentPoint;
            this._currentPoint = [e.lngLat.lng, e.lngLat.lat];

            const offset = [
                this._previousPoint[0] - this._currentPoint[0],
                this._previousPoint[1] - this._currentPoint[1]
            ];

            const newBounds = this.moveTrackingRect_(offset);

            this._map.fitBounds(newBounds, {
                duration: 80,
                noMoveStart: true
            });
        }
    }

    mouseUp_()
    //========
    {
        this._isDragging = false;
        this._ticking = false;
    }

    moveTrackingRect_(offset)
    //=======================
    {
        const source = this._trackingRect;
        const data = source._data;
        const bounds = data.properties.bounds;

        bounds._ne.lat -= offset[1];
        bounds._ne.lng -= offset[0];
        bounds._sw.lat -= offset[1];
        bounds._sw.lng -= offset[0];

        this.convertBoundsToPoints_(bounds);
        source.setData(data);

        return bounds;
    }

    setTrackingRectBounds_(bounds)
    //============================
    {
        const source = this._trackingRect;
        const data = source._data;

        data.properties.bounds = bounds;
        this.convertBoundsToPoints_(bounds);
        source.setData(data);
    }

    convertBoundsToPoints_(bounds)
    //============================
    {
        const ne = bounds._ne;
        const sw = bounds._sw;
        const trc = this._trackingRectCoordinates;

        trc[0][0][0] = ne.lng;
        trc[0][0][1] = ne.lat;
        trc[0][1][0] = sw.lng;
        trc[0][1][1] = ne.lat;
        trc[0][2][0] = sw.lng;
        trc[0][2][1] = sw.lat;
        trc[0][3][0] = ne.lng;
        trc[0][3][1] = sw.lat;
        trc[0][4][0] = ne.lng;
        trc[0][4][1] = ne.lat;
    }

    update_(e)
    //========
    {
        if (this._isDragging) {
            return;
        }

        const parentBounds = this._map.getBounds();
        this.setTrackingRectBounds_(parentBounds);

        this.zoomAdjust_();
    }

    zoomAdjust_()
    //===========
    {
        const miniMap = this._miniMap;
        const parentMap = this._map;
        const miniZoom = parseInt(miniMap.getZoom(), 10);
        const parentZoom = parseInt(parentMap.getZoom(), 10);
        let found = false;

        ZOOMLEVELS.forEach(function(zoom) {
            if (!found && parentZoom >= zoom[0]) {
                if (miniZoom >= zoom[1]) {
                    miniMap.setZoom(zoom[2]);
                }

                miniMap.setCenter(parentMap.getCenter());
                found = true;
            }
        });
    }

    preventDefault_(e)
    //================
    {
        e.preventDefault();
    }

    /**
     * Sets the minimap's background colour.
     *
     * @param      {string}  colour  The colour
     */
    setBackgroundColour(colour)
    //=========================
    {
        if (this._loaded) {
            this._miniMap.setPaintProperty('background', 'background-color', colour);
        } else {
            this._background = colour;
        }
    }

    /**
     * Sets the minimap's background opacity.
     *
     * @param      {number}  opacity  The opacity
     */
    setBackgroundOpacity(opacity)
    //===========================
    {
        if (this._loaded) {
            this._miniMap.setPaintProperty('background', 'background-opacity', opacity);
        } else {
            this._opacity = opacity;
        }
    }
}
