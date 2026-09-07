---
name: seven-mark-system-proposals-from-the-2026-09-05-render
description: Seven mark-system proposals from the 2026-09-05 render-core review
area: rendering-and-displays
---

# Seven mark-system proposals from the 2026-09-05 render-core review

—
declined in the same review, each against the rule that the shape owns
geometry and picking, the display owns its data and the encode from data to
channels, and the installer owns only the diff. *A mark-level installer
(`installMarks`) on the marks subpath*: ADR-088 refused presets, and the
display-held `createEncodeMemo` was the right-sized cut. *`span.hitAt` as a
backwards channel scan*: channels are in feature order, and the pre-index hit
test walked half a million features per hover (`featurePainting.ts` history);
`hitNearest` over candidates the display narrows is what landed. *A
`containsPx` per-instance predicate*: rebuilds the bp mapper per instance.
*`MarkShape.antialiased` as a boolean on the shape*: a shader property one
level up, so the `//! coverage: analytic` directive reaches non-mark displays
too. *A `scale` slot on `defineMark`*: ADR-097 measured the refusal. *A text
mark painted by the mark backend inside the frame loop*:
[INTERACTION_PERF.md](../reference/INTERACTION_PERF.md) measured that any `fillText`
flushes the document's style recalc. *A positioned-label overlay component in
display-kit*: the shared half already exists in render-core — `OverlayCanvas` is the
dpr-prepared, pointer-inert, absolutely positioned canvas and `Ctx2D` with
`SvgCanvas` is the SVG emitter, which is why every label painter
(`drawAlignmentLabels`, `drawMafLabels`, `drawMafDeletionLabels`) is called
unchanged from the export path. What the eleven ~30-line wrappers hold is a
props interface, an empty-list early return and one draw call, and each is
the `observer` memo boundary that keeps a hover re-render from redrawing;
inlining the closure into the parent redraws every render without the React
Compiler, which `build:esm` ships without. A shared label record (`{x, y,
text, font, fill, align, opacity}`) would move colour resolution into
placement, making `computeVisibleLabels` palette-dependent, for a ~50-line
saving.
