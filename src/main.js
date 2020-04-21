import { MapManager } from './flatmap-viewer';

window.onload = function() {
    const mapManager = new MapManager();

//    mapManager.loadMap('NCBITaxon:9606', 'map1', { annotatable: true });
    mapManager.loadMap('NCBITaxon:10114', 'map1', () => {}, {
//    mapManager.loadMap('NCBITaxon:9606', 'map1', {
        //tooltips: true,
        //debug: true,
        navigationControl: 'top-right',
        searchable: true,
        featureInfo: true,
        zoom: 6,
        center: [4.737, -3.422]
    });

    //mapManager.loadMap('demo', 'map2', { annotatable: true, debug: true });
};
