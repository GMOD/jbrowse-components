- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- group by strand plugins/canvas



## Fused abortsignal+stoptoken?







## toggle off tooltips
for multivariantdisplay

## display mode -> rename to set feature height

## add option "hide this feature" to multisamplevariantdisplay, etc




## xref dotplot

On the dotplot, if you're zoomed all the way out and then place your mouse near the edge of the plot and scroll to zoom in, the plot "jumps" so the cursor isn't on the same region anymore. At all other zoom levels, the area under the cursor stays smoothly under it when zooming, it's just from the max zoomed out level, and is much more noticeable when the cursor is near the edge of the plot.


## dont do codeql so much ?

## quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping


## why

multiple generate-screenshots failed like this why
  • sv_cgiab/translocation_open_from_track
    click target not found: text "somatic-CNV"

  • multiwig/multi_renderer_types
    waitForText: never found visible text "Rendering type"

  • rnaseq/compact_stacked
    Waiting for selector `[[[{"name":"text","value":"ACTB"}]]]` failed

  • rnaseq/longread_isoseq
    Waiting for selector `[[[{"name":"text","value":"ACTB"}]]]` failed

  • trio-basic
    Waiting for selector `[[[{"name":"text","value":"chr1"}]]]` failed

  • trio-matrix
    Waiting for selector `[[[{"name":"text","value":"chr1"}]]]` failed


  Searched for 1 pattern

❯ the rendering type thing already fixed

  Read 1 file

That pattern — unrelated specs across totally different features all failing on "waiting for selector/text" — points to environmental contention, not a real regression. I confirmed this directly: when I reran trio-matrix alone, it passed cleanly (previously two other generate-screenshots processes were already listening on ports 3334 and 3335 in this shared worktree).

What's happening: each generate-screenshots invocation defaults to --concurrency 4 headless Chrome instances. With multiple people/agents running the script concurrently in this shared worktree, you can end up with 8-12+ Chrome instances competing for CPU/memory at once, plus several of the failing specs (sv_cgiab/translocation_open_from_track, the rnaseq ones) load real remote data over the network (NCBI FTP, etc.) rather than local demo fixtures — so under load, page settle/render and remote fetches blow past the readyTimeout/click-target waits, and specs fail non-deterministically depending on which run happened to be starved.

trio-basic and trio-matrix are almost certainly just contention casualties — worth a retry once other concurrent runs finish. Noted that multiwig/multi_renderer_types is already fixed on your end, so I'll leave that one alone. Want me to retry the remaining failures (sv_cgiab/translocation_open_from_track, rnaseq/compact_stacked, rnaseq/longread_isoseq, trio-basic) now on an unused port to confirm they're also just flakes?

## followups synteny


- grape/peach/cacao's own review note was a different request — "consistent coloring across levels" (the shared middle genome should color-match between the peach–grape and grape–cacao ribbons). That's a separate design task, still open.
- The comment in packages/synteny-core/src/SyntenyViewInit.ts:14 claims the "default grey blends ribbons into mud" — that's stale (default is red; the grey came from the palette). I left it since it was outside the chosen fix, but worth correcting.
- I didn't touch screenshot-review.json — the review tool manages its hash/status; re-run your review to flip multiway_synteny/ecoli_pangenome off "bad".

## gene


● I think I found it. The density-fade collapse path in packRef (layout.ts:575-578) pins sub-pixel features to row 0 without reserving label width and without stacking. Tiny genes like miRNAs (MIR6088,
  MIR769, etc. — ~70bp, sub-pixel at 5Mb) collapse onto one row, and their labels all draw at nearly the same x → the pile-up we see. Let me confirm densityFade and that collapsed features still emit
  labels.

  Searched for 1 pattern

● Confirmed. densityFade: layout.glyphType === 'Box' (glyphEmitters.ts:521) — gene-level boxes (what showOnlyGenes renders) all have densityFade=true. A sub-pixel-wide gene box (miRNA ~70bp = 0.03px at
  this 5Mb zoom) hits the collapses path in packRef, which pins it to row 0 without reserving label width and without stacking. So every tiny gene near the same spot dumps its label at the same x → the
  "RWMILZSLAS336P" pile-up. Meanwhile it still emits a floating label (not dropped, offset=0).

  The collapse path exists to keep dense label-less variant pileups (1px SNP boxes) on one row. The fix: don't collapse a sub-pixel feature that has a visible label — send it through the normal addRect
  path so its label width is reserved and it stacks like every other labeled gene.

  Read 1 file

● Update(plugins/canvas/src/LinearBasicDisplay/layout.ts)
  ⎿  Added 8 lines
      572        ext.endBp / bpPerPx,
      573        boxStartPx + MIN_RECT_WIDTH_PX * 2,
      574      )
      575 +    // A collapsed box reserves no horizontal label space, so a labeled sub-pixel
      576 +    // feature (e.g. a miRNA gene at whole-arm zoom) must NOT collapse: its label
      577 +    // still renders at the feature's left edge, and piling several onto row 0
      578 +    // paints their names on top of each other. Send it through addRect so its
      579 +    // label width is reserved and it stacks like every other labeled feature.
      580 +    const hasRenderedLabel =
      581 +      (labelInfoByFeatureId.get(id)?.maxLabelWidthPx ?? 0) > 0
      582      const collapses =
      583        isSubPixelFade(ext, bpPerPx) &&
      584 +      !hasRenderedLabel &&
      585        !intersectsMerged(boxStartPx, boxEndPx, solidSpansPx)
      586      if (collapses) {
      587        layoutMap.set(id, 0)

● Now let me add a test that proves the fix. Let me look at the existing layout test structure.

  Searched for 1 pattern, read 1 file

● Let me look at an existing densityFade collapse test and the label-setting pattern to model my new test.

  Read 1 file

● Now let me find the existing densityFade collapse test to place mine nearby and match conventions.
