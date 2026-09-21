---
name: multiway-review-plan
description: A 2026-09-20 review of MultiWaySyntenyDisplay, validated by a second agent, and the seven-step plan now being built from it — a re-anchor bug (the old genome's pivot and flip carry onto the new anchor), a per-lane rebuild measured at 90 of 90 cells for one lane's commit, gene colour as the FeatureColor channel with a `cluster` field, the contig drawn as a line, a Flip lane control, and animated same-contig lane jumps. Read before touching the display while the steps land; delete when step 7 lands.
---

# MultiWaySyntenyDisplay: review findings and the plan being built

A review on 2026-09-20 read `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/`
(`MW/` below) against
[MULTIWAY_SYNTENY_DISPLAY.md](../reference/MULTIWAY_SYNTENY_DISPLAY.md), the
parked follow-ups in
[multiway-synteny-lgv-track](../ideas/collections/multiway-synteny-lgv-track.md),
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) and the gggenomes R
package (`~/src/vendor/gggenomes`). A second agent then tried to refute every
finding and step, reproduced the two it could with tests, and corrected three
steps. This file is the plan as corrected, and the state of each step. Delete it
when step 7 lands, after filing what the last section lists.

## Findings

| id | finding | verdict |
| --- | --- | --- |
| F1 | Re-anchoring carries the old anchor's lane decisions. After a navigation the display still holds the old genome's features, so the next settle re-decides under the new anchor from the old genome's groups, and that decision's pivot and flip carry. Reproduced: every group slips 150 px, and an inverted lane stays forward with every ribbon crossed | confirmed, narrow: only where both genomes spell the contig alike and the old window's coordinates fall inside the new one. No shipped demo is exposed |
| F2 | `MW/ribbonColorConfigSchema.ts:48` says strand is "against the anchor"; below the first gutter the colour is the two joined lanes' relative strand, as the legend and the menu help already say | confirmed |
| F3 | `MW/laneDrag.ts:14-18` documents `laneOrderAfterDrop` but sits on `sameLaneOrder` | confirmed |
| F4 | One lane's gene commit rebuilds every lane: at 44 lanes × 30 genes, 90 of 90 glyph/box cells re-created, 1,325 `color` and 1,320 `utrColor` jexl evaluations, 47–67 ms commit-to-cells under jsdom | confirmed, measured |
| F5 | `MW/afterAttach.ts` imports values (`declaredLanesOf`, `specsCoverMate`, `staleLaneSpecs`, `starAnchorOf`) from `model.ts`, which lazy-imports it | confirmed, harmless at runtime |
| F6 | The anchor lane's gene fetch sends one region per static block (`laneGenesFetchSpecs`), so a straddling gene comes back twice | confirmed |
| G1 | Gene colour is a plain slot; its key is read back off drawn colours (`laneColorKey`), one of the two keys GRAMMAR_OF_GRAPHICS.md names as having no channel behind it | confirmed |
| G2 | Every lane's baseline runs the whole canvas, so a contig's end draws the same as a stretch nothing aligns to (gggenomes draws the sequence itself, `geom_seq`) | confirmed |
| G3 | Orientation is automatic only; the 17p measurement puts five of eight lanes within three points of even (gggenomes has `flip()` beside `sync()`) | confirmed |

## Decisions Colin made on 2026-09-20

- The field that colours a gene by its ortholog group is **`cluster`**
  (gggenomes' word). `group` collides with `ribbonColor`'s declared-column
  examples, `DeclaredLane.group` and a GFF `group` attribute.
- Gene colour and ribbon colour share **one "Color by..." menu with Genes and
  Ribbons subheaders**.
- Step 7 **animates and changes no decision rule**. The orientation-vote
  regression it would make more visible is filed, not fixed, this pass.

## The plan

One commit per step; each step's definition of done is `pnpm verify`,
`pnpm test-related` (read the suite counts it prints), `pnpm typecheck`,
`pnpm autogen` after a slot description or schema change (a regenerated file
keeps only what the step explains), and `pnpm build:esm` where an exported
surface changes. The `jbrowse-web` suites run on CI. Nothing in the
reference doc's "what not to touch" list changes.

1. **F1: stamp the features with their anchor.** The commit receives the fetch
   arguments; record the anchor the fetch asked for beside `features`, and treat
   the features as absent under any other anchor. Stamping the decisions instead
   was tried and still slipped 150 px. Test through `setDisplayedRegions`: the
   test harness's `reanchor` does not move the anchor, since `testAssembly()`
   labels every name volvox. Cover the Undo, which is a second trigger. The fix
   also removes the old genome's groups drawing on the new axis until the
   refetch lands.
2. **Cleanups.** F2's text (autogen then rewrites
   `website/docs/config/RibbonColor.md` and `typeDocs.generated.json`), F3's
   comment, F5's helpers into `MW/laneFetch.ts` (the tests' imports move too),
   F6 through `mergeContiguousRegions`.
3. **G3: Flip lane.** A volatile pin stated against the anchor's order and keyed
   to the contig it was set on, dropped when the drawn contig changes (the way
   the contig pin lapses) and on an anchor change through step 1's stamp. Menu
   items beside the contig ones. The pin beats the vote and the deadband and
   survives a pan on its contig.
4. **G2: the contig as a line.** A mate lane reads its contig's length by
   canonical name (`lane.canon(frame.refName)`) from `assembly.regions`, which is
   undefined until the assembly loads, so the full-width divider stays the
   fallback for a genome the session does not hold or has not loaded yet. The
   anchor lane takes its extent from the view's displayed regions through
   `axisSpan`. Before/after screenshot.
5. **G1: gene colour as `FeatureColor`, with `cluster`.** A bare jexl string
   still lands in `value`, but `readConfObject(conf, 'color', { feature })` then
   returns the object without error, so the three call sites read
   `['color', 'value']`; `value` has no default, so goldenrod has to be
   supplied. `buildLaneCells` decides each gene's claiming cluster before it
   packs the gene's colour (today the claim is recorded after,
   `MW/multiwayGeometry.ts:664-674`), by bp rather than px so edge clipping
   cannot change a colour. Key through `derivedColorScale` when a field paints,
   `laneColorKey` only for a jexl `value`. The tutorial and demo configs
   (`demos/ecoli_orthologs/config.json`, `demos/primate_orthologs/config.json`)
   move as a separate docs step with a redeploy and a reshoot.
6. **F4: reuse a lane's cells.** Keyed on the lane object, its held genes and the
   colour settings; the lane stack does not read `laneGenes`, so one lane's
   commit repacks that lane alone. After step 5, which changes the colour path.
7. **Animate a same-contig lane jump.** A re-alignment, a rung change or a flip
   on one contig is affine in the lane's px, so it runs as a per-lane map in the
   render state and uploads nothing. Ribbons take the upper lane's map on the
   top edge and the lower lane's on the bottom through `ribbonParams` and
   `computeTransform` (a mirror is fine; a scale of exactly 0 gives NaN, so
   clamp); ticks take their lane's map on both edges; glyph layers take theirs
   through their block. Corrections from the validation:
   - The new cells are culled to the new frame, so the first frame is not the
     old picture: cull to the union of the two frames while a transition runs.
     The t=0 test checks drawn content, not the map's arithmetic.
   - Readiness has to reach what raster captures read (the app phase and
     `data-display-drawn`, used by `@jbrowse/capture`, the website figures and
     the browser-test helpers). `dataSuperseded` holds only the SVG export.
   - Clock the transition on wall time in the model, so a stalled React frame
     loop cannot latch it.
   - Snap on a contig change, an anchor change, a first decision, a jump whose
     frames share nothing on screen, and wherever `animationAllowed` says no.
   - Hoist `easeInOutCubic` and `morphClockMs` from canvas's `yMorph.ts` into
     core beside `animationAllowed`, rather than importing across plugins.
   - The `synteny/multiway_zoom_out` video changes.

## Who is building what

At most three agents at once, each in its own worktree, landed by the
coordinator one at a time (rebase, re-test, fast-forward). Several steps touch
`MW/model.ts`, so the landing order matters more than the start order.

| step | agent | state |
| --- | --- | --- |
| 1, then 3 | Opus | not started |
| 5, then 6 | Opus | not started |
| 2 | Sonnet (mechanical) | not started |
| 4 | Opus, once step 2 lands | waiting |
| 7 | Opus, once steps 1 and 3 land | waiting |

## Filing when this closes

- The landed steps go into the reference doc's "Findings that have landed"
  block.
- The 2026-09-06 orientation-vote regression — drawn flip oscillations 0 on
  every lane on 2026-09-02, 0/0/3/2/2/2 after — goes into the ideas file's
  "Lane stability, measured" section as the thing step 7 makes more visible.
- The stability table's rung and slip columns have been stale since
  2026-09-08 (peach rung changes 7 → 8, with a new oscillation); re-run
  `benches/multiwayLaneStability.probe.ts` and regenerate the record.
- G4 (a Match anchor scale mode), G5 (per-zoom collinear block ribbons, which
  answers that parked idea's hover-unit blocker) and G6 (ribbon label colours
  assigned in first-seen order, which is synteny-core-wide) stay unfiled
  until Colin agrees to them.
