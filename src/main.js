import { MapManager } from './flatmap-viewer';

window.onload = async function() {
    const mapManager = new MapManager();

    const maps = await mapManager.latestMaps();
//    mapManager.loadMap('NCBITaxon:9606', 'map1', { annotatable: true });
    mapManager.loadMap('NCBITaxon:10114', 'map1', () => {}, {
//    mapManager.loadMap('NCBITaxon:9606', 'map1', {
        tooltips: true,
        //debug: true,
        //navigationControl: 'top-right',
        searchable: true,
        featureInfo: true
    });

    //mapManager.loadMap('demo', 'map2', { annotatable: true, debug: true });
};
