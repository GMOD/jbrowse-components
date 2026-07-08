## Alignments / canvas

- Read cloud: show "read bars" on the reads themselves (currently just horizontal lines).
- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

## MAF canvas "Loading" placeholder never clears with a 2nd track

`gallery/celegans_26way` (screenshot-review.json): a MAF display's
coverage/conservation canvas has a real gap where no alignment block covers the
region (genuinely empty, not a bug on its own) — normally paints blank. Add any
second track to the same view and that gap instead shows a permanently stuck
"Loading" placeholder. Reproduced 3/3, independent of track order, unaffected by
raising settleMs 90000->180000 in the screenshot generator (so it's not slow,
it's stuck) — the display's "-done" test-id fires quickly regardless, so
`waitForDisplaysDone` doesn't catch it. Likely: the empty-region draw path skips
clearing/overwriting the placeholder text when there's no data to draw. Not
investigated further.

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


## add extra large text svg mode for pub ready figures






## deploy example-site to branch



## follow ups

- Push the shorthand one step further: refNameAliases/cytobands still require the full { adapter: { type: 'RefNameAliasAdapter', uri: '...' } } wrapper — a refNameAliases: { uri: '...' } shorthand (defaulting adapter.type) would trim that the same way, and it's the same preProcessSnapshot idiom already in place there.
- The riskier "auto-detect adapter type from extension" idea we discussed and deferred (fasta: 'foo.fa.gz' → infer BgzipFastaAdapter) is still on the table if you want maximal terseness, but I'd only do it if you're fine with implicit magic.
3

## occasionally mouseover on gene glyph does not show cursor pointer with mouseover shading



## add fit to height to jbrowse-img

## autofit height for lineargenomeview example-site demo

## human demo as main data in example-site demo

## mouseover sequencefeaturepanel connect to linaergenomeview3


## audit

const baseState = model.renderState
  if (
    !baseState ||
    model.sourceSections.every(s => s.laidOutPileupMap.size === 0)
  ) {
    return null
  }

## serialized entire nextstrain into json, do not want. that may have emulated the preexisting sarscov2 pattern but that is bad. just upload normal flatfiles to s3://jbrowse.org/demos/nextstrain
