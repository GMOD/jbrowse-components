---
status: Accepted
summary: "The picture per zoom level works at any scale. A `bin` step's `step` may be `auto`, resolved before the RPC to the 1/2/5 rung above four pixels of bp and keyed into the fetch, so a zoom inside a rung refetches nothing and a 1,600x sweep in 64 steps costs 11 refetches. And the mark display opts into the byte gate and composes `DensityTierMixin`: past the budget a mark declaring `source: 'density'` draws the adapter's sidecar as its own layer, through the same bar shape, y scale, axis, hover and export the features draw through. The stand-in is declared rather than inferred from a bin-and-count transform, the sidecar's rows are drawn unresampled, and a bin opens nothing"
---

# ADR-117: The density tier is a mark layer

## Status

Accepted (2026-09-10). Takes
[ADR-112](adr-112-a-layer-owns-its-transform-and-its-zoom-range.md)'s declined
zoom-following bin, which
[ADR-113](adr-113-one-scale-rule-in-one-place.md) re-declined on the same terms,
and joins the mark display to
[ADR-102](adr-102-the-density-tier-swaps-on-the-gates-verdict.md)'s density
tier, which ADR-112's Consequences named as the thing that would close the seam.
[MARK_ENCODING.md](../reference/MARK_ENCODING.md) and
[REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md) are the operational
docs, `website/docs/config_guides/mark_display.md` the public one.

## Context

ADR-112's multiscale picture — a binned count zoomed out, the features zoomed
in — held only inside the fetch budget and only at the zoom the author wrote
the bin for. Two limits, one seam:

- **The bin width was a constant.** A config wanting three resolutions wrote
  three marks with three ranges, and each one's bars were the width the author
  guessed for the zoom they guessed the reader would be at.
- **Past the byte gate there was no picture at all.** The mark display did not
  even opt into the gate: `gateEnabled` was false, so a whole-chromosome view
  of a BED downloaded whatever the index quoted. With the gate on it would show
  the banner, which is the honest answer only for a track with nothing else to
  draw — and ADR-102 already built the something else, a `make-density` bigWig
  on the adapter's `densityAdapter` slot that five displays read in the
  banner's place.

The bin ADR-112 declined is what joins them: a width that follows the zoom is
the declared form of what the tier mixins do imperatively, and a display that
composes the tier has a summary to draw once the detail fetch is refused.

## Decision

### `bin` takes `step: "auto"`

The slot admits a number or the string, through a `types.union` model on a
`number` slot; the wire's `BinStep.step` stays a number, resolved on the main
thread before the RPC.

**The ladder is four pixels of bp, snapped up to the next 1/2/5 rung** —
1, 2, 5, 10, 20, 50 bp and so on, an axis's own tick ladder
(`plugins/marks/src/LinearMarkDisplay/autoBin.ts`). Four pixels is a bar the
eye reads as a bar, and it puts ~250 instances on a 1000px view whatever the
zoom. Snapping is the whole mechanism: the resolved width is a term of
`rpcProps()`, so it is a fetch input, and every bp/px inside a rung resolves to
one width. A zoom step inside a rung refetches nothing; one across it refetches
at the width the new zoom asks for, the way wiggle picks a summary level.

**Measured** (`model.test.ts`, "a zoom sweep refetches once per rung"): 64
zoom steps of 1.125x — 1 to 1,600 bp/px — cross **11 rungs**, so 53 of the 64
leave the fetch's inputs alone. A fixed `step` keys on nothing that moves, and
the same sweep costs it zero.

### The mark display gates, and composes the density tier

`gateEnabled` is `true` and the schema spreads
`regionTooLargeConfigSchemaFields` beside `densityTierConfigSchemaFields`, so
the display is byte-gated like the four other feature displays and carries the
tier's two slots and its track-menu tri-state. Its budget is the base 1 Mb,
recorded in `scripts/gatedBudgets.ts`; BAM, CRAM and VCF declare 5 Mb, which
outranks it.

**The stand-in is declared, not inferred.** A mark carries
`source: 'features' | 'density'`, and the density one is what the sidecar's
bins are drawn as. Inferring it from a `bin`-and-`aggregate`-`count` transform
was the alternative and is refused: a config that says "count per 10 kb" and a
sidecar that answers "features per sidecar bin" are different quantities, and
the inference would promise the first and draw the second wherever the widths
disagreed — silently, since both are counts. The declared spelling also reaches
the marks inference cannot key on: a `coverage` mark, or a mean, whose author
knows the sidecar is the right zoomed-out reading.

**The bins arrive as a layer, not as a second renderer.** `densityPayloads`
builds one `MarkRegionData` per region — the sidecar's intervals as `x`/`x2`,
its levels as `y`, the mark's constant colour packed once, a Flatbush over the
same `(x, y, x2, y)` the encoder builds — and `rpcDataMap` answers it while the
tier stands in. Everything downstream is the path the features already take:
the shared y domain folds the bins' extremes, the axis and the shapes read the
declared scale, the hover reads the Flatbush and the tooltip names the mark's
`y` field, `coarseTierDisplayPhase` / `coarseTierSvgReady` swap the phase and
the export gate, and `renderSvg` paints the same `markList`.

**The sidecar's rows are drawn as they are read.** A bigWig's zoom level at the
view's bp/px is what a wiggle track of the same file would draw, so the bars
are its intervals — no resample onto screen bins. `densityToUniformBins` exists
for the coverage band, whose GPU packing is fixed-width, and reads as a mean
per pixel where this reads as a peak; a bar per row is what every other bigWig
in the app draws.

**A mark that is not the density is off past the budget**, its layer empty, and
a corner chip says so: "the adapter's density sidecar is drawn in the features'
place; N other marks draw nothing". With no density mark drawing at this zoom
`coarseTierMode` is `never`, so the tier neither reads nor stands in and the
banner is the answer it always was.

**A bin opens nothing.** `selectFeature` reads the features back over the hit's
span and runs the mark's steps over them again (ADR-112); past the budget that
read-back is the download the gate refused. It returns early, and the context
menu drops its one item.

## Consequences

- One `marks` entry is now a picture at every scale: `{ shape: 'bar',
  source: 'density', transform: [{ type: 'bin', step: 'auto' }, …] }` bins to
  the zoom inside the budget and draws the sidecar outside it, over one y axis.
- The mark display bannering a too-large region is new behaviour for a track
  that previously downloaded it. That is the gate every other feature display
  has had, and `forceLoad` / the Force-load button are the way through.
- A track with a `densityAdapter` gets the tier's track menu — Automatic /
  Features only / Density only, and Force-load where the band replaced the
  banner.
- `auto` puts a term that moves with the zoom into `rpcProps()`, which ADR-102
  warned about for a *tier choice*: crossing a threshold mid-gesture fires
  `SettingsInvalidate` and drops every loaded region. Here that is the
  behaviour asked for — the bins really are different — and the ladder is what
  bounds how often it happens.

## Rejected alternatives

- **Inferring the density stand-in from the transform.** Above: two quantities
  spelled alike, and the wrong one drawn without a message.
- **Resampling the sidecar onto screen-pixel bins** the way the coverage band
  does. It costs an allocation per region per zoom and changes the reading from
  peak to mean, and the tree already draws every other bigWig row for row.
- **A `bin` width from the density tier's own zoom bucket** (one per doubling
  of bp/px). The bucket is a cache key, not a width: doublings drift from
  round numbers immediately, and a bar of 8,192 bp is a bar nobody asked for.
  The 1/2/5 ladder costs the same refetch count and reads.
- **Keying the auto width on `zoomFetchKey` rather than `rpcProps()`.** That
  path exists to keep a zoom-varying term out of the settings cache key, but a
  bin width is not a rendering parameter — the worker's answer differs — so the
  refetch it forces is the correct one.
- **A `stringEnum` or `frozen` slot for `step`.** `frozen` drops the slot out
  of the config docs and the JSON schema, which is what a `marks` sub-schema
  exists not to do; a second slot (`stepMode`) says one thing in two places.
