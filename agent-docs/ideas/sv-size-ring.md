---
name: sv-size-ring
description: The SV inspector's circle can only encode a record's two endpoints, so a deletion and a duplication of any size both land on one point; a ring placing local events at a radius set by log10(span) would give the 80% of a callset that a chord cannot draw somewhere to be.
---

# A size ring for the SV inspector's local events

A chord runs between a record's two ends. That is the right primitive for a
translocation and there is no version of it that works for a deletion, because
at whole-genome scale a deletion's two ends are the same point. The circle
therefore has nothing to say about most of a real callset:

| C-GIAB HG008-T somatic benchmark, 210 PASS calls | |
| --- | --- |
| interchromosomal | 26 |
| intrachromosomal | 184 |
| ends ≥ 1 px apart at the inspector's ~4.7 Mb/px | 39 |
| median DEL span | 172 bp |
| median DUP span | 148 kb |
| median INS span | 0 |

The spokes those 171 records used to draw are gone (`chordControlRadius`), and
the legend now counts them so the reader knows they exist. Neither puts them on
the plot.

## The shape

An inner ring, concentric with the chords. A local event is a mark at its own
angle — which it already has, unambiguously — placed at a radius set by
`log10(span)`, floor at the ring's inner edge and cap at its outer one. A 172 bp
deletion and a 4.5 Mb duplication then sit at visibly different radii instead of
both being nothing. Colour is already decided: `svChordColor`, the same scale the
chords and the legend use.

This is the standard Circos idiom and it is worth taking as such rather than
inventing: readers of cancer genomes arrive already able to read it.

## What has to be decided first

- **Mark, not arc.** A 172 bp event has no angular width either, so a "ribbon
  along the rim" degenerates exactly the way the chord did. It wants a dot or a
  tick, sized by class rather than by span.
- **Where the ring lives.** `radiusPx` in the SV inspector is ~143 px at the
  default geometry and the chords already own the interior. Taking a band out of
  it makes the chords worse. This probably wants [the fixed-pixel circle
  geometry](../TODO.md) fixed first, which is most of a doubling of usable
  radius for free.
- **Whether it belongs to `ChordVariantDisplay` or beside it.** The display is
  named for the primitive it draws and its config slots are all stroke colours.
  A second mark type on the same features is either a second display on the
  track or an honest rename.

## Why it is not in `TODO.md`

Nobody has committed to it, and the two entries above it in value — the empty
drill-downs, and a circle that can hold a second callset — are both plain
missing-wiring rather than a visual design. Read this before re-proposing it.
