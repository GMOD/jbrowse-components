---
name: a-far-link-with-a-low-apex-draws-flat-not-as-legs
description: Zoomed inside a long intron, a sashimi junction used to draw a flat line overhead and now draws nothing, because the link mark turns any pair wider than three canvas widths into a circle's legs at its feet. A valued dome whose apex is far below its half-width is flat across the view, and the mark has no kind that draws it.
---

# A far link with a low apex draws flat, not as legs

A real regression from [ADR-222](../../architecture-decision-records/adr-222-sashimi-arcs-are-link-marks.md),
recorded under its Known limits. At volvox `spliced.bam`, `ctgA:35,000-39,000`,
the view sits inside a 25 kb intron: the SVG overlay drew the junction as a
line across the top of the coverage band, and the link mark draws nothing,
since both legs are off screen.

`linkIsFar` (`packages/render-core/src/shaders/linkMark.slang`) switches a
pair wider than `LINK_FAR_SCREEN_WIDTHS` canvas widths to a true circle built
from each foot, so a radius in the millions of px cancels nothing in float32.
For the read-connections band that is the same picture, since an arc's apex is
its half-width. For a dome whose `y` names an apex inside the band, the
ellipse is thousands of px wide and tens tall, and on screen that is a flat
line at the apex.

Two ways to draw it:

- **In the mark.** A far pair whose apex is below its half-width draws as the
  `line` kind at the apex height, with a stem at each foot the canvas holds.
  The shader, its JS twins, the painter, the ink and the hit test each gain
  the case, and the mark display's `link` with a `y` changes with it.
- **In the alignments feed.** A second pair of sashimi marks under
  `linkShape: 'line'` draws the junctions currently far. Membership depends on
  the zoom, so the feed gains a zoom-tier stage, and the dome mark still draws
  each far junction's legs to the band's clip, above the line.

The call is which, or neither. The mark is the better home: the mark display
has the same blind spot for any `link` with a `y`.
