---
name: svg-sidebar-text-style
description: Each row display's export sidebar comes from one `svgSidebar` getter on TreeSidebarMixin and measures in the export's text (landed 2026-10-02). Three visual calls to Colin remain open — label-box fill, a 'left' track name on a sidebar track, export text size — with real exports in an artifact. Read before touching the multirow SVG sidebar or export font size.
---

# SVG sidebar: one props getter, measured in the export's text

Branch `svg-sidebar-cleanup` landed on 2026-10-02. The export SVG goldens it
moves (`vcf_cluster_snapshot.svg`, `wiggle_vector_snapshot.svg`) refresh on CI.

## What landed

- **Each row display states its export sidebar once.** `TreeSidebarMixin` has
  an overridable `svgSidebar` getter (undefined by default, like `rowBanding`)
  and one `svgSidebarWidth(text)` method over it. The five displays override
  the getter; their `renderSvg` hands it to `<SvgTreeSidebar sidebar text>`.
  Before, each wrote the props twice (getter + JSX) and they had drifted.
- **The sidebar measures in the export's text** (`ExportTextStyle` =
  `{fontSize, fontFamily}` in display-kit `types.ts`). Bug fixed: labels were
  measured in the Helvetica table but drawn in the export font, so a monospace
  export ran `Pan_troglodytes` ~17px into the plot. Row labels draw at
  `min(rowHeight, fontSize)`, band labels at 0.9×, the 120px cap is 10 ems, the
  band column is its font + 3. On screen nothing changes (12px default).
- LGV, synteny and breakpoint exports pass `{ ...opts, fontSize }` to
  `renderViewTracks` so the displays see the same resolved 13 the gutter math
  (`trackLabelLeftOffset` → `trackSidebarWidth(t, {fontSize, fontFamily})`)
  uses. **Expect golden drift**: export row labels go 12→13px, band 11→12px.
- Deleted `svgSidebarWidthOf` (display-kit); `LgvSvgExportable` declares
  `svgSidebarWidth?`. LGV `util.ts`'s duck types share `SidebarDisplay`.
- `leftAxisGutterWidth` is the constant `AXIS_GUTTER_WIDTH_PX` when a left axis
  draws, matching where `axisGutterLeft` puts it; it reserved the measured
  captioned width before, leaving a gap.
- `rowLabelsCarryText.ts` folded into `rowLabelsBoxWidth.ts`;
  `MIN_TEXT_ROW_HEIGHT` no longer exported.
- `SvgRowLabels` separators are one path; `SvgBandLabels`' hover rect is
  `fill="none" pointerEvents="all"` rather than the CSS-only `transparent`.

## Calls for Colin

The artifact [Export Sidebar Calls](https://claude.ai/artifact/BUhy7WhKEAFoTp37sc4vPN)
shows each with real exports. A throwaway jbrowse-web test made them:
`view.exportSvg({ rasterizeLayers: false, ...opts })` on
`volvox_microarray_multi_multirowxy` and on `volvox_test_vcf` clustered as a
matrix (VcfCluster.test.tsx's steps), then `rsvg-convert -w 1400`.
The artifact recommends light grey everywhere, the 'offset' fallback, and
ratios of one base size with the default left at 13.

1. **Strip fill**: the export now draws white label boxes beside a tree and
   light grey without one (the `opaque` split predates the gutter move,
   84c36b15a5 vs 7ca1de2499). One fill everywhere deletes `opaque` from three
   components. Options: white, light grey, current split.
2. **A 'left' track name on a sidebar track**: today raised above the rows,
   right-aligned 40px short of the body. Alternative: fall back to 'offset'
   like 'overlapping' does for `prefersOffset`, deleting `leftLabelRaised` and
   its branches (~30-40 lines).
3. **Export text size**: fonts read small. Proposal from the ggplot2
   comparison: one base size (`fontSize`, given a dialog control), every
   chrome text a ratio of it (`rel()`), feature labels left alone (they are
   laid out in the worker, like `geom_text`'s separate mm size). Later, size
   for a target page width (`ggsave(width=)`). Default size is the visual call.
   The captures show why: `fontSize` reaches the assembly name, scalebar, track
   names and row labels, while the refName, ruler ticks, axis ticks and legend
   stay fixed, so an 18px export mixes two size systems.

## Declined, with reasons

- Precompositing the strip's wash and tint into one fill: 15 lines to save one
  path; drop it, and call 1 may remove the distinction anyway.
- Caching the sidebar width per export: ~8 lookup-table passes per track,
  sub-millisecond.
- `TRACK_LABEL_GAP` (40) < axis gutter (50): collides only in 'left' mode on a
  no-sidebar track with a captioned axis; leave unless a capture shows it.
- maf's own `SvgBandLabels` name clash: rename only when editing that file.
