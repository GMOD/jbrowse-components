---
name: extra-large-text-svg-mode-for-pub-ready-figures
description: `BaseExportSvgDialog` exposes font family only, so a publication-ready text scale has to thread the path `fontFamily` takes and every explicit `fontSize` has to become relative first
---

# Extra large text SVG mode for pub-ready figures

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
