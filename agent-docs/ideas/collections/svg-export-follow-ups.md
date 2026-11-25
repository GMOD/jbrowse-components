---
name: svg-export-follow-ups
description: "Small SVG export leftovers from the 2026-11 audit, none needing a ruling: SvgCanvas signatures that let dropped calls compile, pileup label fits measured in sans-serif, feature labels cut at a scrolled track's top, the dotplot export's font held on the view model, a dotplot corner label beside a tick, the breakpoint plugin's copies of two display-kit values, thin golden coverage, callout text outside the circular figure gutter."
---

# SVG export follow-ups

Each is a known gap the 2026-11 export audit found and its fixes left open.
None waits on a decision; each is small and independent.

**`SvgCanvas` accepts calls it then drops.** `clip(..._args: unknown[])` and
`drawImage(..._args: unknown[])` (`packages/core/src/util/SvgCanvas.ts`) let
`ctx.clip(path2d)`, `ctx.clip('evenodd')` and `drawImage` compile against
`Ctx2D`; in vector mode they clip to the current path or draw nothing.
`clearRect` is a silent no-op (`features/gap/mark.ts` records being bitten).
`fillStyle` is typed to take a `CanvasGradient`, which would serialize as
`[object CanvasGradient]`. No caller hits any of them today; only
`circular-view/ringShape.ts` uses `drawImage`, behind a guard. Narrowing
`clip()` to no arguments and the style setters to `string`, and removing the
other two from the type, turns each into a compile error. It needs a typecheck
loop over every draw function.

**Pileup label fits are measured in sans-serif.** The mismatch letters and
indel counts now export as text in the export's font, but
`computeVisibleLabels` and the model getter still fit them with
`labelFont`'s sans-serif (`packages/alignments-core/src/labelConstants.ts`).
Only monospace measures differently, and the fade's 1.135 slack covers it, so
nothing overflows today. Exact measurement needs a family threaded through
those two.

**A feature label can still be cut at the top of a scrolled track.** The
export drops a label that would cross the view's left or bottom edge. A
feature's label stack that would cross the right edge moves left as one, its
widest line anchored by its end at the edge. Where that would carry it past
its region's start or onto another feature, nothing moves, and only the lines
the edge cuts are dropped (`labelsWithinEdges`, `forEachExportLabel`,
`labelPositioning.ts`).
`exactCullBand` still admits a label from a feature scrolled just above the
top. The records band's labels (`paintFeatureBand.ts`) do not go through
`labelsWithinEdges` at all.

**The dotplot export holds its font on the view model.** `renderToSvg` calls
`model.setAxisFontFamily(fontFamily)` and resets it in a `finally`, so the
axis borders are laid out in the export's font. Only monospace measures
differently, so only a monospace export re-lays out the on-screen view. The
dotplot is not behind `exportLaidOut`'s queue, so two overlapping exports with
different fonts would reset each other's. Putting the dotplot export behind
the same queue closes it.

**A dotplot axis label pinned at the viewport corner sits beside a tick.**
In `dotplot_snapshot.svg` the rotated `ctgA` on the horizontal axis, pinned at
the plot's left edge, ends right at a tick mark. The refName labels now clear
the ticks at region starts; the pinned label has no such rule.

**The breakpoint plugin copies two display-kit values.**
`@jbrowse/display-kit` is not a dependency of
`plugins/breakpoint-split-view`, so `overlayLevel` (`util.ts`) spells
`exportedHeight` as `height - svgControlsStrip.height`, and
`CONNECTION_KEY_INSET` (`svgcomponents/pageSubject.ts`) copies display-kit's
unexported `GUTTER_INSET`. Adding the workspace dependency lets the first
import `exportedHeight`; the second also needs display-kit to export the
inset or a key-gutter helper that takes legend entries.

**Golden coverage is thin where the export is most intricate.** The
alignments vector golden is an 80 bp ungrouped pileup. No golden covers
grouped sections, read arcs, junctions, methylation, the multi-way synteny
display, an LD triangle with an index SNP, a circular view with its key on,
or a ring (the circular golden runs in jsdom, which cannot decode an image,
so it holds no ring; only `ringSvg.test.tsx` covers that path). The
rasterized alignments test asserts only that an `<image` exists.

**Callout text is not counted in the circular figure's gutter.** This adds
the cause to "a long name can clip in a square export" in
[circular-view-open-items](circular-view-open-items.md): neither
`figureGutterPx` nor `fitLayout`'s `calloutPx` measures callout text
(`ringCallouts.ts`, `rulerLabels.ts`). A callout near 3 or 9 o'clock runs
level, about 48 px past the ruler arc, with about 37 px before the figure
edge on a one-contig circle. Measuring `ringCallouts(...)` in the export font
and widening the figure to the widest fixes it.

**Ring export is always raster and nothing says so.** A ring is one PNG
warped onto its annulus (`warpRing`), with `rasterizeLayers` forced inside the
strip (`ringSvg.tsx`), so the dialog's rasterize checkbox and
`jb2export --noRasterize` do nothing for rings. By design; the dialog could
say it.

**A `renderRegion.ts` comment may be out of date.** The comment over
`RenderErrorSources` (`products/jbrowse-img/src/renderRegion.ts`) says the
circular view never awaits its assembly and would hang on a failed load. The
audit read `CircularView.error` as folding assembly errors in now; nobody has
checked whether the extra `assembly.error` read is still needed.
