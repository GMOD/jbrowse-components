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

## Config quick-edits mutate shared hydrated nodes

A compensating fix is shipped (evict the dirtied hydration node on delta drop);
the deeper fix — never mutate the shared base-config node in place — would remove
the whole bug class. See
[CONFIG_EDIT_INPLACE_MUTATION.md](CONFIG_EDIT_INPLACE_MUTATION.md) — proposal,
not implemented.

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



## more accurate cgiab

look at wakhan, pycnv

## more typescript improvements to cascadingmenu

## add extra large text svg mode for pub ready figures



## add dynamic nextstrain or more nextstrain demos



## deploy example-site to branch

# dotplot

in plugins/dotplot-view we have the idea of allocating space for refname labels. but in the hg19
  vs hg38 screenshot that we have in generate-screenshots the margins for refname labels on the axes
  are quite large maybe even oversized. can you check

## audit context menu code for e.g. alignments

## follow ups


- jbrowse-react-circular-genome-view's examples-site has the same verbose pattern in 4 files (Volvox.tsx, Managed.tsx, ShowTrack.tsx, Human.tsx) — worth the same cleanup for consistency across products.
- website/docs/tutorials/embed_linear_genome_view.md (the main "embedding" tutorial, not examples-site) still shows the old verbose form — likely the highest-traffic doc a new user reads, so it's the most valuable one to update even though it's outside what you scoped today.
- Push the shorthand one step further: refNameAliases/cytobands still require the full { adapter: { type: 'RefNameAliasAdapter', uri: '...' } } wrapper — a refNameAliases: { uri: '...' } shorthand (defaulting adapter.type) would trim that the same way, and it's the same preProcessSnapshot idiom already in place there.
- The riskier "auto-detect adapter type from extension" idea we discussed and deferred (fasta: 'foo.fa.gz' → infer BgzipFastaAdapter) is still on the table if you want maximal terseness, but I'd only do it if you're fine with implicit magic.
3

## occasionally mouseover on gene glyph does not show cursor pointer with mouseover shading


## only show 6ma methylation in chromatin_accessibility_6ma
