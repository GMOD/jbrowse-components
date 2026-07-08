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
`waitForDisplaysDone` doesn't catch it.

Static investigation (2026-07): the "Loading" text is the **shared
`DisplayLoadingOverlay`** (MAF uses `DisplayChrome`), not a coverage-canvas draw
— so `displayPhase` is stuck at `loading` while `canvasDrawn` is true (the
`-done` testid keys off `canvasDrawn`, the overlay off `displayPhase ===
'loading'` = `!isReady || !viewportWithinLoadedData`, so the two legitimately
disagree). Ruled out the data-commit hypotheses: the worker always returns
`regionData` (empty `blocks: []` still present), so `setRpcData` /
`setLoadedRegion` / `isCacheValid` all commit unconditionally for an empty
region — `loadedRegions`/`rpcDataMap` stay truthful.

Found + fixed one real defect in the area: `fetchMafRegions` took the sample set
from `results[0]` blindly, so on a **sample-discovery** track an empty region as
`needed[0]` clobbered the discovered rows with `[]` (and churned
`orderedSampleIds` → refetch). Now picks the first region that actually
discovered samples (`pickSamplesResult`, unit-tested). This is a candidate for
the stuck-loading (empty region → `[]` samples → `orderedSampleIds` churn), but
NOT confirmed as the full cause. The "only with a 2nd track" trigger is
unexplained and may not reproduce reliably — it could be an
environmental/screenshot-generator fluke rather than a real MAF-model bug. If it
recurs, get a live repro (celegans MAF + any 2nd track at a MAF-gap locus) and
check whether the sample-pick fix already cleared it before hunting further.

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


