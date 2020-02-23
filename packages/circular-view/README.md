# Concepts

## slices

A slice is a range in angle (theta) space. Start radians, end radians. The start is always less than or equal to the end. If the slice goes through the origin, the end coordinate may be greater than 2π.

Each circular view is divided into "slices", one or more per displayed region. Slices are roughly equivalent to the "blocks" in linear tracks, except they each have their own polar coordinate system. All drawing in the slice is done relative to the slice's coordinate system, which will have its own origin and figure radius.

Tracks that draw "around the circle" will want to use these slices to draw, while tracks that draw arcs "across the circle" or other whole-figure overlays will probably not want to use these slices.

## sections

A section is a range in both angle (theta) and radius (rho) space. Start and end in theta have the same rules as slices.
