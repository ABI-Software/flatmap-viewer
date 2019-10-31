import { MapManager } from './flatmap-viewer';

window.onload = function() {
    const mapManager = new MapManager();

    mapManager.loadMap('NCBITaxon:9606', 'map1');
    mapManager.loadMap('demo', 'map2', { annotatable: true, debug: true });
};
