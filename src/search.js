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

import MiniSearch from 'minisearch';

//==============================================================================

export class SearchControl
{
    constructor(index)
    {
        this._index = index;
    }

    onAdd(map)
    //========
    {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl search-control';

        this._input = document.createElement('input');
        this._input.id = 'search-control-input';
        this._input.setAttribute('type', 'search');
        this._input.setAttribute('visible', 'false');
        this._input.setAttribute('placeholder', 'Search...');

        this._button = document.createElement('button');
        this._button.id = 'search-control-button';
        this._button.className = 'control-button';
        this._button.title = 'Search flatmap';
        this._button.setAttribute('type', 'button');
        this._button.setAttribute('aria-label', 'Search flatmap');
        // https://iconmonstr.com/magnifier-6-svg/
        this._button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" id="search-control-icon" viewBox="0 0 24 24">
    <path d="M21.172 24l-7.387-7.387c-1.388.874-3.024 1.387-4.785 1.387-4.971 0-9-4.029-9-9s4.029-9 9-9 9 4.029 9 9c0 1.761-.514 3.398-1.387 4.785l7.387 7.387-2.828 2.828zm-12.172-8c3.859 0 7-3.14 7-7s-3.141-7-7-7-7 3.14-7 7 3.141 7 7 7z"/>
</svg>`;
        this._container.appendChild(this._button);

        this._container.onclick = this.onClick_.bind(this);
        return this._container;
    }

    getDefaultPosition()
    //==================
    {
        return 'top-right';
    }

    onRemove()
    //========
    {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    searchMap_(search=true)
    //=====================
    {
        this._input = this._container.removeChild(this._input);
        this._input.setAttribute('visible', 'false');
        const text = this._input.value;
        if (search && text !== '') {
            this._index.search(text);
        }
    }

    onKeyDown_(e)
    //===========
    {
        if (e.key === 'Enter') {
            this.searchMap_();
        } else if (e.key === 'Escape') {
            this.searchMap_(false);
        }
    }

    onClick_(e)
    //=========
    {
        const targetId = ('rangeTarget' in e) ? e.rangeTarget.id : e.target.id; // FF has rangeTarget
        if (['search-control-button', 'search-control-icon'].includes(targetId)) {
            if (this._input.getAttribute('visible') === 'false') {
                this._container.appendChild(this._input);
                this._container.appendChild(this._button);
                this._input.setAttribute('visible', 'true');
                this._input.onkeydown = this.onKeyDown_.bind(this);
                this._input.value = '';
                this._index.clearResults();
                this._input.focus();
            } else {
                this.searchMap_();
            }
        }
    }
}

//==============================================================================

// The properties of a feature we index and show

export const indexedProperties = [
    'label',
    'models'
];

//==============================================================================

export class SearchIndex
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._searchEngine =  new MiniSearch({
            fields: ['text'],
            storeFields: ['text'],
            tokenize: (string, _fieldName) => string.split(' ')
        });
        this._featureIds = [];
    }

    indexMetadata(featureId, metadata)
    //================================
    {
        const textSeen = [];
        for (const prop of indexedProperties) {
            if (prop in metadata) {
                const text = metadata[prop];
                if (!textSeen.includes(text)) {
                    this.addTerm_(featureId, text);
                    textSeen.push(text);
                }
            }
        }
    }

    addTerm_(featureId, text)
    //=======================
    {    if (text) {
            this._searchEngine.add({
                id: this._featureIds.length,
                text: text
            });
            this._featureIds.push(featureId);
        }
    }

    clearResults()
    //============
    {
        this._flatmap.clearSearchResults();
    }

    search(text)
    //==========
    {
        const results = this._searchEngine.search(text, {
            prefix: true
        });
        this._flatmap.showSearchResults(results.map(result => this._featureIds[result.id]));
    }
}

//==============================================================================
