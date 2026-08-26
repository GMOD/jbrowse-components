---
name: the-read-clouds-parked-row-is-clipped-by-the-band-edge
description: a parked read-cloud connection is centred on the band's zero anchor, which IS a band edge, so 2.5 of its 5 px survive — in both renderers identically, so nothing diverges. Leave it flush, inset it, or give the row its own glyph is a visual call, and an inset means the shaders learning that a shape sits somewhere other than where its `yBp` says.
---

# The read cloud's parked row is clipped by the band edge

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Both backends lose the same half, so nothing diverges,
and an inset means the shaders learning that a shape sits somewhere other than
where its `yBp` says.

A read-cloud connection the view cannot place draws as one mark on the band's
zero anchor (`ARC_SHAPE_FLAT_UNPLACED` — see
[reference/ARC_BAND.md](../reference/ARC_BAND.md), "The read cloud draws a bar
only between two places on screen"). The anchor IS a band edge —
`arcAnchorY` returns `arcsTop` in down mode and `arcsTop + arcsH` in up mode —
and both renderers clip to the band rect, so a mark centred on it loses half of
itself.

Measured: `ARC_MARKER_PX` is 5, so 2.5 px survive. The marks read as thin
coloured dashes lying on the band's edge rather than as squares. On HG002 300x
at `chr1:2,010,000-2,022,000` that is three of them, in the insert-size and
orientation colours, hard against the coverage band above.

**It is not a divergence.** Canvas2D clips through `withClip` and the GPU
through `devicePxBand`'s scissor, so both backends lose the same half. Whatever
is decided here keeps them agreeing for free.

## The call

Nothing is obviously right, which is why this is filed rather than fixed:

- **Leave it flush.** A mark sitting ON the baseline is arguably what "parked at
  y=0" should look like, and a row of coloured ticks along the band edge reads
  as a lane rather than as clipped squares.
- **Inset it by half a marker**, so the square is whole. This is the one that
  costs something — see below.
- **Give the row its own glyph** rather than the endpoint square the plotted
  marks use, on the grounds that it is not a point on the axis at all.

## Why an inset is not a one-liner

The parked mark's Y is `yBp = 0` resolved through `arcBandDestY`, which is
`alignmentsUniforms.slang`'s and is what `arcFlat.slang` and `arcMarker.slang`
both read. So an inset cannot be expressed as a `yBp`: `arcYFraction` is
logarithmic and floors at 1, and any value large enough to move the mark a few
px depends on `arcsYDomainBp`, which changes with the data.

The 8 px `ARC_HEIGHT_MARGIN` is no help either — `arcAvailH` subtracts it at the
FAR edge, so the anchor edge has no reserved room. Moving the anchor itself is
not on: it is insert size 0, and `computeInsertSizeTicks` places the ruler
against the same `arcAnchorY`.

So an inset means the shaders learning that this shape sits somewhere other than
where its `yBp` says — a per-instance bit or a uniform, `pnpm gen:shaders`, and
the Canvas2D and SVG mirrors — plus `arcMark`, since the hit test and the hover
highlight resolve through it. Half a day, and it wants the visual call first.
