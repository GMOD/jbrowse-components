---
name: hic-absent-bin-on-a-ratio
description: On a Hi-C ratio field a bin the file lists no contacts for draws as the page behind the matrix, which on a white-middle diverging ramp reads as a ratio of 1 rather than as depleted. The call is whether to keep it blank, as Juicebox does, or paint the triangle's background in a color of its own.
metadata:
  area: rendering
  category: visual-call
  order: 1
  first_move: "capture hic/observed_expected both ways, blank and with the triangle under the `unknown` color, and pick"
---

# What an absent bin paints on a Hi-C ratio

A sparse `.hic` lists only cells with contacts. On `observed` an absent cell is
a zero, and the juicebox ramp's transparent low end draws it as the page, which
is what a zero should look like.

On `observed/expected` and `observed/control` the ramp is `redblue` reversed,
white at a ratio of 1. An absent cell still draws as the page, so a region with
no contacts at all, the most depleted a cell can be, reads as "no change". The
`hic/observed_expected` figure shows it below the chr8 diagonal, where the
long-range bins thin out.

- **Keep it blank.** Juicebox does; the reader learns that white is both 1 and
  no data.
- **Paint the triangle first** in the color object's `unknown` color (the slot
  exists on the shared color object, unused by Hi-C), so absent cells read
  apart from 1. Every painter has to fill the same triangle, and the SVG export
  with it, or the export disagrees with the figure.

The observed/control join already draws a cell one file lacks as a 0 in that
file, so this is only cells neither file lists.
