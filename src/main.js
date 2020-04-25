import { MapManager } from './flatmap-viewer';

window.onload = async function() {
    const mapManager = new MapManager({
        images: [
            {
                id: 'label-background',
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAmCAIAAADbSlUzAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAJOgAACToAYJjBRwAAACVSURBVFhH7dixDoJAEIThfXqMBcYKrTQ+jkYSStDYkVhZINxyEshJcZXJtC7FfNlmur9eyXb7Vqf6+bI9HUKyWkt5e4RlOF9ycerjsqbqpfefuKzNJawBWIOxBmMNxhqMNRhrMNZgrMFYg7EGYw3GGow1GGuw5dU07y4ua22nUlb3uKxd80IOx1Pjxp+f4P/P+ZButl+YrbXnPs+YmAAAAABJRU5ErkJggg==',
                options: {
                    content: [21, 4, 28, 33],
                    stretchX: [[21, 28]],
                    stretchY: [[4, 33]]
                }
            }
        ]
    });

    const maps = await mapManager.latestMaps();

    const options = [];
    const selector = document.getElementById('map-selector');
    for (const map of Object.values(maps)) {
        const option = ('describes' in map) ? map.describes : map.id;
        const text = ('describes' in map) ? `${map.id} -- ${map.describes}` : option;
        options.push(`<option value="${option}">${text}</option>`);
    }
    options.sort()
    selector.innerHTML = options.join('');

    let currentMap = null;
    const loadMap = (id) => {
        if (currentMap !== null) {
            currentMap.close();
        }
        mapManager.loadMap(id, 'map-canvas', () => {}, {
            tooltips: true,
            //debug: true,
            //navigationControl: 'top-right',
            searchable: true,
            featureInfo: true
        }).then(map => { currentMap = map; });
    };

    selector.onchange = (e) => loadMap(e.target.value);

    selector.options[0].selected = true;
    loadMap(selector.options[0].value);
};
