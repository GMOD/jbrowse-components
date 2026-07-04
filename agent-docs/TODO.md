## Alignments / canvas

- Read cloud: show "read bars" on the reads themselves (currently just horizontal lines).
- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

## Display height

Rename "display mode" to "set feature height" — see the display-height-system
redesign options in [OTHER_IDEAS.md](OTHER_IDEAS.md).

## Fused AbortSignal + stopToken

See [REQUEST_ABORT_PLAN.md](REQUEST_ABORT_PLAN.md) — proposal, not implemented.

## Dotplot edge-zoom jump

Zoomed all the way out, then scrolling to zoom in near the edge of the plot
makes the plot "jump" so the cursor is no longer over the same region. At every
other zoom level the area under the cursor stays put; only reproduces from the
max-zoomed-out level, and is more noticeable near the plot edge.

## Synteny follow-ups

- `multiway_synteny/ecoli_pangenome` screenshot review is marked "bad" ("why
  are the synteny curves grey here?") — the default-color comment it was
  reacting to was stale (default is red, not grey; fixed in
  `SyntenyViewInit.ts`). Regenerate the screenshot and re-review to flip the
  status.
- `multiway_synteny/grape_peach_cacao` screenshot review is marked "bad":
  wants consistent coloring for the same block across levels (the shared
  middle genome should color-match between the peach–grape and grape–cacao
  ribbons). Separate design task, still open.

## more subtle search highlight

## per group (plugins/alignments group by) vertical drag resize not working well

## per group yscalebar weird in plugins/alignments

## move set max layout height out of set feature height

## make menu item divider for 'Use default "Compact" for alignments track'

## improve quickstart_desktop

## no resize handle on non-first group

## make option for 'fit to display height' for plugins/alignments and plugins/canvas?
