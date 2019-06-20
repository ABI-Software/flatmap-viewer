
Implementation
==============

Layers
------

Each organ layer consists of three ``mapbox-gl`` layers, namely:

* a raster image
* polygon shapes
* linestrings.

Anatomical features have a property attribute named ``id`` (this is not the same as a feature's ID attribute, which all features have).

1. Dim organs by placing opaque features over them?
2. But then un-dimming (by making feature transparent) will only show parts of the
   organ that are not obscured by other organs.
3. Instead have a separate raster for each organ.

Use style expressions.

::

    map.setPaintProperty()
    map.setFeatureState()
    map.fitBounds()

    map.showTileBoundaries()


Annotation mode
---------------

Web server needs to update annotations in both Turtle and the map's Powerpoint sources. We need to set the path to ``pptx`` in the metadata saved in ``mbtiles`` file.
