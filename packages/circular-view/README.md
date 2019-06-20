# Concepts

## coordinate system

The circular view primarily uses polar coordinates, with a few different coordinate systems in use:

  * the "figure" coordinate system: polar, origin is the center of the whole figure, distances in pixels
  * the "slice" coordinate systemL polar, origin is at the tip of the current slice. distances in pixels


## slices

Each circular view is divided into "slices", one or more per displayed region. Slices are roughly equivalent to the "blocks" in linear tracks, except they each have their own polar coordinate system. All drawing in the slice is done relative to the slice's coordinate system, which will have its own origin and figure radius.

Tracks that draw "around the circle" will want to use these slices to draw, while tracks that draw arcs "across the circle" or other whole-figure overlays will probably not want to use these slices.

### Drawing subtleties

* Arcs drawn in a slice should be drawn centered on the figure origin, but the endpoints should be in the slice coordinate system.
