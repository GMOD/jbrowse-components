# Screenshot-review handoff (webgl-poc)

> **STATUS UPDATE:** the "REMAINING (not done)" items below have largely been
> completed in a later session — arc_display, compact, track_arcs, modifications1,
> cnv, horizontally_flip, breakpoint_split_view, sv_cgiab/cnv_show_all_regions,
> bigwig/whole_genome_coverage are all done + verified. See
> `SCREENSHOT_REVIEW_NEXT_STEPS.md` for the current authoritative state; only
> `multisv` (keep-decision), `alignments_sort_by_base`, and `rnaseq/compact_stacked`
> remain. Treat the sections below as historical.

Working through the "bad" verdicts in `website/scripts/screenshot-review.json`.
Specs live in `website/scripts/screenshot-specs.ts`; generator is
`website/scripts/generate-screenshots.ts`. **This doc supersedes the open items
in `SCREENSHOT_REVIEW_NEXT_STEPS.md` for the shots listed below.**

## How to regenerate + verify

```bash
cd products/jbrowse-web && NODE_ENV=production node scripts/build.ts   # only if app code changed
cd website
pnpm generate-screenshots --filter=<name> --exact
```
- The generator serves `products/jbrowse-web/build`; **any change under
  `plugins/` or `packages/` needs a jbrowse-web rebuild first** (the build
  resolves workspace packages from `src/`, confirmed via `main: src/index.ts`).
- PNGs land in `website/static/img/`. Default capture is 1500×800 @2x, so a shot
  is 3000×1600 — too big for a direct image view. Downscale to inspect:
  `convert static/img/<name>.png -resize 1400x /tmp/v.png` then view `/tmp/v.png`.
  To inspect fine detail (letters, indicator bars) crop first:
  `convert <name>.png -crop WxH+X+Y +repage /tmp/c.png`.
- On failure the generator writes `static/img/debug_<name>.png` — view it to see
  where the action sequence stalled.

## Two big learnings (READ before editing menu specs)

1. **Deep menu hover navigation is fragile.** A single hover that opens one
   submenu level is reliable (see `alignments_soft_clipped_menu`). A *second*
   hover into a sub-submenu frequently drifts — the menu re-renders and the
   hovered item jumps (often landing on "Color by..."). This broke
   `select_arc_display` (3 levels: Read connections → Show pair overlay → Arcs)
   and `modifications1` (Color by... → Modifications... → option). **Fix
   pattern:** open only ONE submenu level via hover, box a child item there, and
   if you need the *result* of selecting a deep option, preset it declaratively
   in `displaySnapshot` instead of clicking through. See the reworked
   `select_arc_display` spec for the template.
2. **Annotation `anchor: { text }` matches `element.textContent`** — it CANNOT
   anchor to an `<input>` value (those have empty textContent) and falls back to
   the top-left corner (0,0). This was the `bookmark_widget_edit_label` bug;
   anchor to a nearby stable label instead (e.g. a column header).
   Also: a single `closeMenusFirst` Escape only closes the *innermost* submenu —
   to fully dismiss a nested menu before a result frame, click a neutral element
   (e.g. the location input) instead.

---

## DONE + verified this session

### Code fixes (both rebuilt + visually verified)
- **`alignments_soft_clipped`** — was a **real regression** on webgl-poc: the
  rewrite drew soft-clip bases as colored boxes but never emitted per-base
  letters (only mismatches got letters). Fixed in
  `plugins/alignments/src/LinearAlignmentsDisplay/components/computeVisibleLabels.ts`:
  added a per-base soft-clip letter loop (reuses `type:'mismatch'` for contrast
  text) and suppressed the redundant `(S<len>)` summary when per-base letters
  render. Unit tests added in `computeVisibleLabels.test.ts` (6/6 pass). Verified
  letters now render (G A A C T G ...).
- **`alignment_clipping_indicators`** — **real regression**: the inverted
  clip/insertion bars above coverage were capped at a fixed `Math.min(maxCount*2,
  20)` px instead of scaling with track height. Restored origin/main's
  "half the coverage drawing height" scaling in BOTH paths:
  - `packages/alignments-core/src/rendererUtils.ts` `drawInterbaseSegments` —
    added a `coverageHeight` param; `interbaseHeight = coverageLayout(coverageHeight).effectiveH / 2`.
  - `plugins/alignments/src/LinearAlignmentsDisplay/renderers/GpuAlignmentsRenderer.ts`
    — `f[U.interbaseHeight] = coverageLayout(state.coverageHeight).effectiveH / 2`.
  - Updated both callers (`features/interbase/drawCanvas.ts`,
    `plugins/maf/.../drawMafCoverage.ts`). `alignments-core` tests pass (55/55).
  Verified bars now scale into the coverage band. **Scaling-equivalence note:**
  pixel height = `(count / max(maxDepth,1)) * (coverageHeight−10)/2`, where
  `maxDepth` = region max coverage depth (worker `interbaseCoverage.ts`). This
  reproduces origin/main's `getScale({range:[0,height/2], linear})` exactly in
  the common **autoscale** case. Caveat: origin/main scaled by the *coverage
  domain max*, so if a track uses a **manually-fixed** coverage score-max
  (not autoscale), bar heights could differ slightly from origin/main; the new
  path is always data-max-relative. Triangle-row offset (4.5px Canvas2D /
  9px-from-bottom GPU) was unchanged and is orthogonal.

### Spec/annotation tweaks (verified)
- `alignments_center_line` — loc → `ctgA:1000-1100`, track → `volvox_bam`,
  smaller window (1100×650); removes the soft-clip distraction the reviewer hit.
- `alignments_center_line_menu` — box highlight on "Show center line"; needed a
  defensive final `hover` on the item to keep the *view* menu's submenu open.
- `alignments_soft_clipped_menu` — box highlight on "Show soft clipping".
- `add_track_form` — smaller window (1000×720).
- `add_track_tracklist` — replaced the numbered badges that *covered* the icons
  with box rings + "Track selector"/"Add track" text labels beside them.
- `alignments/group_by_strand` — `showLegend:false` on both split tracks
  (legend was redundant since the tracks are already strand-split + colored).
- `alignments/select_arc_display` — now a two-stage figure on `volvox_sv_cram`:
  (top) track menu → Read connections → "Show pair overlay" boxed (arcs preset
  via `readConnections:'arc'`); (bottom) the clean arc result. Single-hover only.
- `bookmark_widget_create` / `bookmark_widget_open` — circle → `box` annotation
  (reviewer wanted a square around the menu item).
- `bookmark_widget_edit_label` — instruction text moved from top-left to beside
  the widget (anchored to the "Bookmark link" column header).
- `dotplot_menu` — confirmed it now shows the dotplot **view** menu (the spec was
  already corrected; this just re-verified + regenerated).
- `alignments/read_cloud` — switched from `linkedReads:'normal'` ("view as
  pairs") to `readConnections:'samplot'` + `readConnectionsDown:true` (the actual
  "Read cloud" mode, drawn below coverage). **Needs an eyeball to confirm it
  matches the reviewer's mental model** — samplot mode draws flat lines at
  Y=|tlen| for discordant pairs *over the ordinary pileup*, so the regular reads
  still show; if the reviewer wanted ONLY the cloud, more work is needed.

---

## REMAINING (not done)

### `modifications1` — EDITED but failing, needs menu fix
Loc zoomed to `20:19,757,000-19,762,000` (good — fixes the regionTooLarge that
left the submenu stuck on "Loading modifications..."). BUT the action sequence
(`Color by...` → `Modifications...` → box "All modification types") **times out
waiting for "Modifications..."** — the exact menu label needs checking in
`plugins/alignments/src/LinearAlignmentsDisplay/menus/colorBy.ts` (the entry may
be "Methylation"/"Modifications" without the ellipsis, and gating on
`modificationsReady`), and it is a 3-level menu so it will also hit the
hover-drift problem above. Recommend: single-hover to open the Color-by submenu
and box the modifications entry there, rather than drilling a 3rd level.

### `alignments_sort_by_base` — analyzed, NOT edited
Reviewer wants the right-click→"Sort by base at position" *workflow* shown
(ideally capturing the right-click on the SNP), not just the declarative result.
The read context menu (`model.ts` `contextMenuItems`, ~line 2119) shows a
`<base>` submenu → "Sort by base at position" when a mismatch base (`cigarHit`)
is right-clicked. The view is centered on the SNP (loc centered on pos 14481 with
`showCenterLine`), so a right-click at the horizontal view center hits it — but
the *row* (y) for a mismatch base must be found empirically (canvas-drawn, no
DOM). Suggest a two-stage: stage 1 right-click at view-center on a read row with
a mismatch (annotate the menu), stage 2 the sorted result.

### Remote human-data regens (config_demo.json has the data; network works)
- `alignments/arc_display` — reviewer: use a realistic dataset, e.g. SKBR3
  sniffles VCF (`breast_cancer_sniffles_hg19`) + SKBR3 illumina
  (`SKBR3_550bp...cram`) around `chr1:72,548,824-72,163,654` (note: reviewer's
  coords look reversed/hg19-vs-hg38 — sanity-check the locus).
- `alignments_track_arcs` — reviewer: pick a gene WITHOUT overlapping fwd/rev
  sashimi arcs (current ACTB at chr7:5,562,000-5,575,000 has confusing
  bidirectional arcs). Find a single-strand gene in the RNA-seq track.
- `alignments/compact` — reviewer: use HG002 illumina hs37d5 2x250
  (`HG002.hs37d5.2x250`, assembly hg19), toggle compact, capture the "Set feature
  height → Compact" submenu open with Compact highlighted.
- `rnaseq/compact_stacked` — reviewer: "not clear compact mode is used"; make the
  compact featureHeight:3/spacing:0 more obviously compact (or annotate).

### Declarative rebuilds of re-share items (user opted IN to attempting these)
All five currently load server-side `share-XXXX` sessions that can't be edited
offline. Try rebuilding each as a self-contained `sessionSpec(...)` where the
data exists in `config_demo.json` / a public config:
- `breakpoint_split_view` — reviewer just wants the over-tall page CROPPED;
  it's a remote share link (`viewportHeight:1200`). Either lower the viewport /
  add a `crop`, or rebuild as a sessionSpec breakpoint-split view.
- `cnv` — needs COLO829 whole-genome coverage bigWig; per next-steps doc it does
  NOT exist in config_demo.json → may be genuinely re-share-only. Verify.
- `multisv` — 1000-genomes multi-sample SV; reviewer wants the track selector
  hidden (re-share or rebuild). Caption tension noted in next-steps §1.
- `horizontally_flip` — before/after composite; use `geneGlyphMode:'longestCoding'`.
- `sv_cgiab/cnv_show_all_regions` — CGIAB remote, slow; launch-view flow.

### Doc caption follow-ups (text, not images)
Reviewer notes that imply prose edits (find the `.md` that embeds each figure):
- `alignments_center_line` — tell users they can right-click a specific SNP to
  sort, not only sort on the center line.
- `add_track_tracklist` — mention File → Open track also works; update captions
  now that badges are text labels not "1"/"2".
- `alignments/group_by_strand` — reviewer also floated adding a "group by
  haplotype" example using config_demo human data (enhancement, not required).

### Explicitly LEFT ALONE (per user)
- `inverted_duplication` — empty review note; user said leave it.
- `skbr3_translocation` — curated:true on purpose (next-steps §4).

## Verdict bookkeeping
`screenshot-review.json` is gitignored and was NOT modified. After the next agent
finishes + the user re-reviews, clear verdicts via `pnpm review-screenshots-web`.
</content>
</invoke>
