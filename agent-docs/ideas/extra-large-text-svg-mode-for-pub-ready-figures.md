---
name: extra-large-text-svg-mode-for-pub-ready-figures
description: `BaseExportSvgDialog` exposes font family only, so a publication-ready text scale has to thread the path `fontFamily` takes and every explicit `fontSize` has to become relative first
---

# Extra large text SVG mode for pub-ready figures

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. A feature request with no reader waiting on it.

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.
