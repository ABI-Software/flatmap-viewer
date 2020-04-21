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

//==============================================================================

// Icon used as label background.id
//
// ``id`` and ``options`` fields are passed directly to map.addImage()

export const LABEL_BACKGROUNDS = [
    {
        id: 'label-background',
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAmCAYAAAD9XArwAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSotUROwg4pChioIFURFHrUIRKoRaoVUHk0s/hCYNSYqLo+BacPBjserg4qyrg6sgCH6AODk6KbpIif9LCi1iPTjux7t7j7t3gFArMc0KjAGabpupRFzMZFfE4CsC6EEIIxiWmWXMSlISbcfXPXx8vYvxrPbn/hxdas5igE8knmGGaROvE09t2gbnfeIIK8oq8TnxqEkXJH7kuuLxG+eCywLPjJjp1BxxhFgstLDSwqxoasSTxFFV0ylfyHisct7irJUqrHFP/sJwTl9e4jrNASSwgEVIEKGggg2UYCNGq06KhRTtx9v4+12/RC6FXBtg5JhHGRpk1w/+B7+7tfIT415SOA50vDjOxyAQ3AXqVcf5Pnac+gngfwau9Ka/XAOmP0mvNrXoEdC9DVxcNzVlD7jcAfqeDNmUXclPU8jngfcz+qYs0HsLdK56vTX2cfoApKmr5A1wcAgMFSh7rc27Q629/Xum0d8PfM1yq13h+DEAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfkBBEJExO2pF7NAAAAqUlEQVQ4y+3OIQ6CYBiH8ef9MDhxc8yABjeP4LwAx3BWTwE3oHkMrBa7JJN3YBogfQkjr0HcDCg0C0/+7f2/AjghycLFj0ECYMarHPRcUoQx25uEJMsR/lUQj4YUtQ+K9aC+1IgABPFc/NjUcy1JYD5++tXM0LEe9rCHPfwXzDu43ChV2qaUKjWWLFLUfkdqLVnkXDiWK4LDkMlckCkwfs8p1cmSbfbs7k+jIi/gASaPYQAAAABJRU5ErkJggg==',
        options: {
            content: [4, 4, 5, 33],
            stretchX: [[4, 5]],
            stretchY: [[4, 33]]
        }
    },
    {
        id: 'inactive-label',
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAmCAYAAAD9XArwAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSotUROwg4pChioIFURFHrUIRKoRaoVUHk0s/hCYNSYqLo+BacPBjserg4qyrg6sgCH6AODk6KbpIif9LCi1iPTjux7t7j7t3gFArMc0KjAGabpupRFzMZFfE4CsC6EEIIxiWmWXMSlISbcfXPXx8vYvxrPbn/hxdas5igE8knmGGaROvE09t2gbnfeIIK8oq8TnxqEkXJH7kuuLxG+eCywLPjJjp1BxxhFgstLDSwqxoasSTxFFV0ylfyHisct7irJUqrHFP/sJwTl9e4jrNASSwgEVIEKGggg2UYCNGq06KhRTtx9v4+12/RC6FXBtg5JhHGRpk1w/+B7+7tfIT415SOA50vDjOxyAQ3AXqVcf5Pnac+gngfwau9Ka/XAOmP0mvNrXoEdC9DVxcNzVlD7jcAfqeDNmUXclPU8jngfcz+qYs0HsLdK56vTX2cfoApKmr5A1wcAgMFSh7rc27Q629/Xum0d8PfM1yq13h+DEAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfkBBEJEyeXEKp4AAAAwklEQVQ4y+3ULU/DUBhA4XO/2rUgwV1ZBWLJBP9fI0gQuMktWcJSwUq79n68qAoSGnCYHv3oowBD09jz88t1CpGcBQCtFYWz3D3tNuz3EXgojqdWLt0gKWWZSynLpRvkeGqFpinVuf2QsnDc3mz4qe7zyjgF9BQidVWyVF2VTCGicxa0VotQa0XOguaPrXCFK1zhv8D5VkvNt9POGvphXIT9MOKsAbyvfl2z95UCCrw3769vfYjp2+ydNdxvH2sOh/QFh8F7PWWiL5EAAAAASUVORK5CYII=',
        options: {
            content: [4, 4, 5, 33],
            stretchX: [[4, 5]],
            stretchY: [[4, 33]]
        }
    },
    {
        id: 'rounded-rectangle',
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAGmSURBVDiNldPBitpAGAfwv5mMmy85JCistD5Ai/gCPYovYJENCPZQF8VD36HXUkrfQws9R8WLF58gh2h2W2PpoeTWxBgzMr1spd3uUvOHOQ2//3yHb4C/UyGi95Zl3XLOUwASgFRVNTVN8ysRfQTwFA+FMdYhoqjf7+9ns5kMgkCGYSjDMJTb7VbO53M5HA4PRBRzzl//g8vlcrxYLE7osbNcLmWlUok459cAULgb+2YymRi1Wu3B6e7H9300Go1dkiTPGRG97Xa7LzqdjnqWBlAqlRBFEVzXNZRisXhl2/bFufh3bNvmAF4WOOd73/cvDMPIVSCEQLVaFUqWZbkxAKiqCsaYVHLLe1E452kcx7mhEALH47Gg6Lr+3fO83AXr9Rq6rofK4XD4NB6P07wFo9Eok1J+LgC41DTt1nEco16vn4VXqxWazeYuSZJnCoAfWZZdt9vtneu6/8We56HVasVCiDcAvp0uGGM2Ef3s9Xp7x3HkZrM57X8QBHI6ncrBYJASUcQYe/XYA5eapr2zLOuGc77H3XfmnKemaX4hog8AnvwJfgHMKs1jQ++4tQAAAABJRU5ErkJggg==',
        options: {
            content: [3, 3, 13, 13],
            stretchX: [[7, 9]],
            stretchY: [[7, 9]]
        }
    }
];

//==============================================================================
