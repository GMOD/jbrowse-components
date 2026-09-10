---
status: Accepted
summary: "The grammar's transform stage is a typed step list — filter, formula, bin, aggregate, coverage — run in the worker, shared on the request and then per layer, so a binned density and the raw features share one fetch; a mark declares the zoom range it draws in, and the display folds only the drawing marks into its shared domain, legend, row count and skipped chip. Bin width is fixed in config; window, sample and a zoom-following bin are declined until a config asks"
---

# ADR-112: A layer owns its transform and its zoom range

## Status

Accepted (2026-09-10). Fills the transform row of
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md), which
[ADR-107](adr-107-the-quantitative-class-is-authored-in-config.md) left at
one step kind, and adds the layer row's semantic zoom.

## Context

`CoreEncodeFeatures` ran one transform kind, `filter`, over the fetched list
and every layer encoded the same result. "Count features per 10 kb" — the
first thing a reader asks of any BED once the view is wider than its
features — had no declared form: it was a BigWig computed offline, or a
display written by hand. GenomeSpy's `aggregate` and `coverage` transforms
and Vega-Lite's `bin` say it in config, and GenomeSpy's `multiscale` layer
draws the summary zoomed out and the rows zoomed in from one spec.

Two things in the tree made the declared form cheap. The encoder already
walks a `Feature[]` it does not own, so a step that answers a different
`Feature[]` composes in front of it with no change to the loop. And
`defineMark` already has `enabled(state)` as the one gate for the draw, the
hover and the highlight, so a zoom range per mark is a predicate over the
render state rather than a new mechanism.

## Decision

- **`TransformStep` is a union by `type`** — `filter`, `formula`, `bin`,
  `aggregate`, `coverage` — and `runTransforms`
  (`packages/core/src/util/featureTransforms.ts`) walks it in order, each
  step reading what the last answered. `bin` writes the bin's edges over
  `start` and `end` by default, so an `aggregate` grouped by those two is a
  density whose bars span the bins with the encoding's `x`/`x2` defaults
  untouched. `aggregate` keys its groups by raw field values through one
  `Map` per groupby field. A `formula` or `bin` answers a `DerivedFeature`
  over the input; an `aggregate` or `coverage` answers a `MadeFeature` that
  carries only what it wrote.
- **A layer has its own steps.** `LayerRequest.transform` runs after the
  request's shared `transform`, so one fetch serves a binned layer and a raw
  one. The mark display sends its `jexlFilters` as the shared steps and each
  mark's `transform` slot as the layer's.
- **A mark declares the zoom range it draws in**: `minBpPerPx` and
  `maxBpPerPx` on the `marks` entry, 0 for no bound, checked by
  `markDrawsAt` against `bpPerPx` in the render state through `enabled`.
  The display's `markVisible` is the same predicate on the main thread, and
  the shared y domain, the legend, the span row count and the skipped chip
  fold only the marks it admits — without that, a density's counts would
  set the axis the features draw against.
- **Every layer is encoded per region whatever the zoom.** The bin layer is
  300 instances at a million features and the raw layer's encode is the
  cost it was, so the worker is not told the zoom and the fetch is keyed on
  nothing that moves per frame.
- **Measured** (`reference/MARK_ENCODING.md` §"The transform stage"): bin
  and count per 10 kb is 3.3x the bare encode per input feature and hands
  the GPU 300 instances in place of a million; coverage is 5.6x with 1.6
  output runs per input.

## Consequences

- A `marks` entry can be a density, a coverage or a derived field over any
  feature adapter, and two entries with complementary ranges are a
  multiscale picture. The config docs, the JSON schema and the manifest
  see the step schema because `transform` is a typed sub-schema array like
  `marks`, never `frozen`.
- A click on a binned bar opens the bin: `selectFeature` reads the features
  back over the hit's span, runs the shared steps and the mark's own over
  them again on the main thread, and matches the hit's span exactly or, for a
  coverage run the narrower read-back widens, by containment. A run's depth
  survives that because no edge falls inside a run, so every feature the
  read-back returns covers all of it.
- A layer's transform steps stay in the mark display's own config model;
  `CoreEncodeFeatures` takes them from any caller.
- A bin summarizes what the fetch admits. Past the byte budget a region draws
  the banner, not a density: the density tier
  ([ADR-102](adr-102-the-density-tier-swaps-on-the-gates-verdict.md)) reads
  a `make-density` sidecar in the banner's place, and the mark display does
  not compose it. The zoom-following bin declined below is what would join
  the two, and it would need a summary the adapter can serve.

## Rejected alternatives

- **A fused `bin` step with its own aggregates.** One step is what most
  configs would write, but it is a third spelling beside Vega-Lite's and
  GenomeSpy's, and the two-step form is one line longer.
- **`bin` writing `binStart`/`binEnd` by default**, Vega-Lite's spelling.
  Every consumer would then set `x: 'binStart', x2: 'binEnd'`, and the
  aggregate's extent would be the members' rather than the bin's. `as` keeps
  the names for a config that wants both.
- **A string key per feature in `aggregate`.** Measured 305 ns per feature
  against 123 for the trie of Maps.
- **`SimpleFeature` for a step's output.** Its constructor cost more than the
  encode of what it built: coverage measured 742 ns per input feature against
  396 with a data-backed feature whose id is computed on demand.
- **Skipping a layer's encode when the view is outside its range.** The
  worker would need the zoom, the fetch would be keyed on it, and the saving
  is the raw layer's encode at wide zoom, which the display already paid
  before this ADR.
- **A bin width that follows the zoom.** The declared form of what the tier
  mixins do imperatively, resolved before the RPC and keyed into the fetch
  the way wiggle's summary levels are. Not built until a config asks; three
  marks with three ranges say it today.
- **`window` and `sample`.** No consumer.
