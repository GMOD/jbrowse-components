---
name: extra-large-text-svg-mode-for-pub-ready-figures
description: thread a scale the way `fontFamily` threads
metadata:
  area: SVG export
  category: ready
---

# Extra large text SVG mode for pub-ready figures

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.
