---
name: extra-large-text-svg-mode-for-pub-ready-figures
description: The export's `fontSize` option reaches the assembly name, scalebar and track names but not the refName, ruler, axis ticks or legend, so a larger px size mixes two size systems; page width already scales all of them
---

# Extra large text SVG mode for pub-ready figures

The page-width export covers the publication case for the linear genome,
linear synteny and breakpoint split views: a page width such as 183 mm with a
text size in pt scales the whole document, so every label keeps its ratio to
the track labels (`pageLayout.ts`, `figureSize.ts`). What is still open is the
px `fontSize` option below, which jb2export and `exportSvg` callers can set and
which reaches only part of the chrome.

The dotplot and circular views still export at screen size. A dotplot page
needs its own anchor (the axis labels, not track labels) and a rule for its
height; a circle needs its radius solved against its label gutter. Stating a
physical width on the root without relaying out would print a wide window's
labels near 3 pt, the problem page width exists to fix.

Moved out of [TODO.md](../../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. A feature request with no reader waiting on it.

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.

## The 2026-10-02 captures and proposal

Exports of a multi-wiggle and a clustered VCF matrix at `fontSize` 13 and 18
([Export Sidebar Calls](https://claude.ai/artifact/BUhy7WhKEAFoTp37sc4vPN), call
3) show the split: the option reaches the assembly name, scalebar, track names
and the tree-sidebar row and band labels, while the refName, ruler ticks, axis
ticks and legend stay fixed, so an 18px export mixes two size systems.

The proposal from the ggplot2 comparison: one base size with a dialog control,
every chrome text a fixed ratio of it (`rel()`), feature labels left alone since
the worker lays them out (like `geom_text`'s separate size), and later a size for
a target page width (`ggsave(width=)`). Colin deferred it on 2026-10-02 as a
whole-export change, not a sidebar fix.

## What a page-width dotplot and circle need (2026-11 audit)

Notes from the export audit, for whoever builds either.

- **Dotplot.** The anchor is the axis text (`AXIS_LABEL_FONT`) and the axis
  borders sized from it, with the height set as the plot's px plus the
  horizontal border so the plot stays square. `jb2export dotplot --width`
  exports at screen size and lets the rasterizer shrink the PNG, so its text
  already prints smaller than asked.
- **Circle.** Run `fitLayout` against a page-sized box to get the zoom, apply
  it to the view under the export queue with a restore (as `exportLaidOut`
  does for width), and wait on the rings again, since a ring's strip zoom is
  the view's. Pass the page's `rasterScale`, and thread a text scale through
  the fixed px label constants in `rulerLabels.ts`, `ringCallouts.ts` and
  `RingAxes.tsx`. The same change stops a zoomed-in view exporting the whole
  circle at that zoom, up to about 10,000 px square.
