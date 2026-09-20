---
name: r-export
description: Export idiomatic R/ggplot2 code for a JBrowse visualization; the prototype's idiomatic-over-exact direction undercuts the render-IR ("one brain, N pens") framing this idea used to carry.
---

# R export

Export actual R plotting code corresponding to a JBrowse visualization, to
connect JBrowse to reproducible R/ggplot2 figures (`ggplot2`/Bioconductor).
Prototype work exists on the **`R_export4`** branch.

## The prototype's direction, and what it does to the render-IR framing

This idea used to be the standing candidate for a render IR: a "one brain, N
pens" layer where a new export target would be the third consumer that finally
justified generating draw logic once for every backend, the bar ADR-051 says
such a proposal must clear.

The prototype answers that in the negative (observed 2026-08-31). It tends
toward **idiomatic R code over exact representation**: the natural output is
`geom_rect`/`geom_segment` over a data frame with ggplot2's own scales, themes
and rasterization, not a replay of this repo's pixel decisions. An idiomatic
pen consumes track *semantics* (the data and the mapping), and ggplot2 then
makes its own choices about snapping, min widths, alpha ramps and
antialiasing, which is exactly the layer ADR-051 keeps per-backend on the two
in-tree renderers too.

Two consequences:

- **R export is not the render IR's third consumer.** What it shares with the
  existing backends is upstream of rendering: the worker output and the
  semantic decisions (which glyph kind, which color axis, a number the user
  reads). Those are already stated once, in the RPC payloads and the
  `//! js-export` layer.
- **The parity bar that does apply is the top tier only.** A figure exported to
  R should agree with the display on numbers a user reads and on semantic
  decisions; where a mark lands, to the pixel, is ggplot2's business, the same
  best-effort standard the Canvas2D backend already gets
  (SHADER_JS_CODEGEN.md §"What actually has to agree").

So a re-proposal of a draw-level IR cannot cite R export as its pull, and has
to bring a consumer that genuinely wants this repo's rasterization decisions
replayed. None is known.
