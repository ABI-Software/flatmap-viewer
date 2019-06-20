=====================================
Viewing and Interacting with Flatmaps
=====================================

Flatmap layers
==============

A flatmap is made up of a number of stacked ``layers``. The bottom layer is the map's background (a raster image, rendered as almost translucent). On top of the background are a number of ``organ system`` layers. Within each organ system, those shapes and lines that have been identified as representing anatomical entities are called ``features``.

Organ layer states
------------------

An organ layer is either ``active`` or ``inactive``. When inactive, the layer is visually dimmed and its features do not respond to mouse interactions; when active, the layer is highlighted and brought to the top of the flatmap's layer stack, and its features respond to mouse movements and clicks. Some features, including those not in the active layer, may also be ``highlighted``, to say show a neural pathway that is the result of a knowledgebase query.

Styles
~~~~~~

* layer active/inactive
* feature interactive/non-interactive
* feature highlighted/non-highlighted


Annotation
----------

Features are identified by giving them an ID and anatomical class, and optionally, other properties, using the name field of the feature object in the organ layer's Powerpoint slide. At map generation time this information is extracted as an RDF file (in ``Turtle``), able to be loaded into the knowledgebase. It is also made available to the map viewer.

Interactive annotation
~~~~~~~~~~~~~~~~~~~~~~

Authors/experts are able to annotate features directly in the web-browser, using a special map viewing mode. In this mode, all shapes and lines of the active organ layer are interactive and, via a pop-up menu, can have annotations added and modified. Annotations are saved in the map's RDF annotation file as well is in the Powerpoint source for the map.


User Interactions
=================

* Initial display just shows dimmed background image.
* Receiving an ``activate-organ(id)`` message will brighten the organ layer and
  enable its features (so that they highlight on mouse over).
* Right click to show details for the feature.
* Clicking on a feature broadcasts a ``feature-selected(id, type)`` message.
* Or click to show details, right click for context menu and query??
* Receiving a ``highlight-features(list_of_features_id)`` message will highlight the features.


Information and State
---------------------

* Info pane on LHS when an object is clicked (pin dropped) c.f. Google Maps.
* Current selection (i.e. organ system) is sticky if species is changed.
* Flatmap manager for a set of flatmaps (by species).

