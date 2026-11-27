---
name: the-dotplot-export-holds-its-font-on-the-view-model
description: The dotplot SVG export sets its font on the live view model and resets it afterwards, outside the export queue the other views use, so two overlapping exports in different fonts reset each other's.
---

# The dotplot export holds its font on the view model

`renderToSvg`
([SVGDotplotView.tsx](../../../plugins/dotplot-view/src/DotplotView/svgcomponents/SVGDotplotView.tsx))
calls `model.setAxisFontFamily(fontFamily)` and resets it in a `finally`, so the
axis borders are laid out in the export's font. Only monospace measures
differently from the screen font, so only a monospace export re-lays out the
on-screen view while it runs.

The linear genome, linear synteny and breakpoint split views export through
`exportLaidOut`
([pageLayout.ts](../../../plugins/linear-genome-view/src/LinearGenomeView/svgcomponents/pageLayout.ts)),
which queues overlapping exports. The dotplot does not, so two overlapping
exports with different fonts reset each other's.

## The change

Put the dotplot export behind the same `exportLaidOut` queue.
