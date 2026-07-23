# @jbrowse/plugin-arc

Two LGV display types that draw arcs. Both are **main-thread SVG** — no RPC
worker, no GPU backend, no `RenderLifecycleMixin`. `afterAttach` runs a
`{ delay: 1000 }` autorun that fetches every feature into one `self.features`
array (`shared/fetchArcFeatures.ts`); the components render `<Arc>` SVG paths
positioned with `view.bpToPx` each frame.

## The two display types

| Display                  | An arc connects                                                                                    | Track               | Notes                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `LinearArcDisplay`       | a single feature's own `start → end` (one refName)                                                 | `FeatureTrack`      | `displayMode` = `arcs` (bezier) or `semicircles`; intra-feature span                                         |
| `LinearPairedArcDisplay` | two independent endpoints `k1`/`k2`, **each with its own refName + coord** (a breakend ↔ its mate) | `VariantTrack` (SV) | spans across displayed regions / chromosomes; draws mate-direction ticks; click opens `VariantFeatureWidget` |

Mnemonic: **Arc = one locus** (start↔end); **PairedArc = two loci**
(breakend↔mate, translocations/SVs).

Shared scaffolding lives in `src/shared/`: `ArcDisplayModel.ts` (the union prop
type), `BaseDisplayComponent.tsx` (chrome), `afterAttach.ts`,
`fetchArcFeatures.ts`. Per-display `model.ts` / `components/Arcs.tsx` /
`renderSvg.tsx` differ only in geometry + which widget a click opens.

## Chrome: shares the DisplayChrome _concept_, not the component

Because arc has no GPU backend it can't wrap `DisplayChrome`, but it must not
re-encode the terminal-state precedence by hand. `BaseDisplayComponent.tsx`:

- derives the phase from the shared
  `computeDisplayPhase({ renderError: undefined, regionTooLarge, error }, () => model.loading)`
  (arc has no `renderError` GPU phase),
- renders the shared banners `DisplayErrorBar` / `DisplayLoadingOverlay` /
  `TooLargeMessage` (from `@jbrowse/plugin-linear-genome-view`) — so arc looks
  identical to every GPU display; `error` and `loading` overlay the
  still-mounted SVG, `tooLarge` replaces the subtree.

Don't reintroduce arc-local loading/error components — that was the drift this
removed. See `agent-docs/reference/DISPLAYCHROME.md` for the whole adoption map.

### `reload()` must clear `error`

`fetchArcFeatures` early-returns while `self.error` is set, so a stuck error
never refetches on its own. Both models override `reload()` (which the shared
`DisplayErrorBar` retry calls) to `setError(undefined)`, which re-fires the
error-gated fetch autorun. Without the override the base no-op `reload()` leaves
the retry button dead.

## Readiness / testid

`svgReady`
(`isDataCurrent(loadedRegionSignature, currentRegionSignature(self))`, or error,
or too-large) is arc's first-paint flag — the SVG-export terminal gate and the
`arc-display${svgReady ? '-done' : ''}` testid browser tests wait on. It's the
SVG analogue of GPU `canvasDrawn`. The `loadedRegionSignature` compare (a
region-key string, the single-array analog of `loadedRegions`) is the staleness
signal: an export fired right after a pan/zoom waits for fresh arcs instead of
capturing stale ones. `isDataCurrent` (`@jbrowse/core/util`) is the shared
freshness predicate — dotplot + synteny gate on the same rule.

## Too-large gating

Byte-only, like `LinearAlignmentsDisplay`: `CoreGetRegionByteEstimate` byte
estimate short-circuits an over-budget region before the feature download;
force-load raises `userByteSizeLimit` (`RegionTooLargeMixin`) so a forced fetch
isn't re-blocked; `alwaysRender` adapters never gate.
