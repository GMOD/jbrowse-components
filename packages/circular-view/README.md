# Concepts

## coordinate system

The circular view primarily uses polar coordinates, with the coordinate system origin at the
center of the figure.

## slices

Each circular view is divided into "slices", one or more per displayed region. Slices are roughly equivalent to the "blocks" in linear tracks, except they each have their own polar coordinate system. All drawing in the slice is done relative to the slice's coordinate system, which will have its own origin and figure radius.

Tracks that draw "around the circle" will want to use these slices to draw, which tracks that draw arcs or other whole-figure overlays will not.
