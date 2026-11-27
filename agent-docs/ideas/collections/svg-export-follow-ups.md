---
name: svg-export-follow-ups
description: "SVG export leftovers from the 2026-11 audit: sans-serif pileup label fits, labels cut at a scrolled track's top, a dotplot corner label, duplicated breakpoint values, thin golden coverage, circular callout text, raster rings, growing jbrowse-img pileups, the pinned-highlight box."
---

# SVG export follow-ups

Each is a known gap the 2026-11 export audit found and its fixes left open.
None waits on a decision; each is small and independent.

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

**Callout text is not counted in the circular figure's gutter.** A long
feature name can clip in a square circular export because neither
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

**`jbrowse-img` could let every alignments track grow to its reads.** A
headless figure has no scrollbar, and `applyTrackOpts.ts` already sets
`heightMode: 'grow'` when `sortAt` is given; it could default to it without
`sortAt` too. The export now ends a deep pileup on a whole row and captions the
rows it leaves out, which covers the reader; this would instead show them.

**The pinned-highlight box does not follow a label the export moved.**
`featureHighlightInk.ts` builds its label box from `placeFeatureLabels`, so a
pinned feature whose name the export shifted to end at the right edge is boxed
at the name's original position.
