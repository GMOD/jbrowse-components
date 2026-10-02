---
name: svg-sidebar-text-style
description: Branch svg-sidebar-cleanup single-sources each row display's export sidebar (`svgSidebar` getter on TreeSidebarMixin) and measures it in the export's text; unlanded — autogen, verify, goldens and three visual calls to Colin remain. Read before touching the multirow SVG sidebar or export font size.
---

# SVG sidebar: one props getter, measured in the export's text

Branch `svg-sidebar-cleanup` (worktree `.claude/worktrees/svg-sidebar-cleanup`),
one WIP commit on e2f6785421. `pnpm typecheck` passes; the tree-sidebar,
wiggle, canvas multi-row, variants, marks, maf, LGV svgcomponents, display-kit
and display-ui suites pass.

## What the branch does

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

## To finish before landing

1. `pnpm autogen` (reExports JSON / workerReExports still list
   `svgSidebarWidthOf`, `MIN_TEXT_ROW_HEIGHT`; model docs gain `svgSidebar`),
   then `pnpm verify`.
2. Fix the comment in `packages/tree-sidebar/CLAUDE.md` §SVG export to name
   `svgSidebar` as the one source.
3. Refresh goldens the font change moves (web suites run on CI; fix forward).
4. `RenderSvgModel` fixtures in other suites may still spell old fields — the
   typecheck says not, but grep `showRowLabels` in `*renderSvg*.test.tsx`.

## Calls for Colin (as an artifact with screenshots — his ask)

Capture route that works: `rsvg-convert -w 1400 <golden>.svg`; a throwaway
jbrowse-web jest test calling `renderToSvg(view, opts)` on a multi-wiggle
(`volvox_microarray_multi_multirowxy`) and a clustered VCF matrix with tall
rows (VcfCluster.test.tsx shows the clustering steps) gives real exports.

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

## Declined, with reasons

- Precompositing the strip's wash and tint into one fill: 15 lines to save one
  path; drop it, and call 1 may remove the distinction anyway.
- Caching the sidebar width per export: ~8 lookup-table passes per track,
  sub-millisecond.
- `TRACK_LABEL_GAP` (40) < axis gutter (50): collides only in 'left' mode on a
  no-sidebar track with a captioned axis; leave unless a capture shows it.
- maf's own `SvgBandLabels` name clash: rename only when editing that file.
