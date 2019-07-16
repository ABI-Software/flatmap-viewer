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

/*
 *  From https://docs.google.com/document/d/1pZX97DWejksMtsbfzSAvf-5vLYoYLf3VVNDyvQd-obQ/edit?ts=5bad9acc#
 *
 *  We need to change the name of the query broadcast channel from ‘sparc-portal’
 *  to ‘sparc-mapcore-channel’ with parameters:
 *
 *      * action - describes the message, for dataset searching we have ‘query-data’,
 *                 also ‘scaffold-show’, ‘data-viewer-show’, ‘flatmap-show’, as well as
 *                 app. specific actions (all flatmap ones are prefixed `flatmap-`)
 *      * data - message specific data
 *      * resource - the resource itself (UBERON id, URI) in the context of the action
 *      * sender - some identifier for the sender e.g. ‘flatmap’, ‘scaffold’, ‘data-viewer’.
 */

//==============================================================================

import BroadcastChannel from 'broadcast-channel';

//==============================================================================

const SPARC_CHANNEL = 'sparc-mapcore-channel';

//==============================================================================

export class MessagePasser
{
    constructor(localId, callback)
    {
        this._localId = localId;
        this._callback = callback;
        this._channel = new BroadcastChannel(SPARC_CHANNEL);
        this._channel.addEventListener('message', this.callback.bind(this));
    }

    broadcast(action, resource, data={})
    {
        data['local-sender'] = this._localId;
        this._channel.postMessage({
            "sender": 'flatmap',
            "action": action,
            "resource": resource,
            "data": data
        });
    }

    callback(msg)
    {
        this._callback(msg);
    }
}

//==============================================================================
