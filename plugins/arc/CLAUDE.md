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
type), `ArcFetchModel.ts` (fetch/gating), `BaseDisplayComponent.tsx` (chrome),
`afterAttach.ts`, `fetchArcFeatures.ts`, `renderArcSvg.tsx` (the whole SVG
export, parameterized by which `<Arcs>` paints). Per-display `model.ts` /
`components/Arcs.tsx` differ only in geometry + which widget a click opens.

## Chrome: shares the DisplayChrome _concept_, not the component

Because arc has no GPU backend it can't wrap `DisplayChrome`, but it must not
re-encode the terminal-state precedence by hand. `BaseDisplayComponent.tsx`:

- derives the phase from the shared
  `computeDisplayPhase({ renderError: undefined, regionTooLarge, error }, () => model.isLoading)`
  (arc has no `renderError` GPU phase),
- renders the shared banners `DisplayErrorBar` / `DisplayLoadingOverlay` /
  `TooLargeMessage` (from `@jbrowse/plugin-linear-genome-view`) — so arc looks
  identical to every GPU display; `error` and `loading` overlay the
  still-mounted SVG, `tooLarge` replaces the subtree.

Don't reintroduce arc-local loading/error components — that was the drift this
removed. See `agent-docs/reference/DISPLAYCHROME.md` for the whole adoption map.

### `reload()` must invalidate `dataLoaded`, not just bump the counter

`GlobalFetchMixin.reload()` clears `error` + `fetchCanceled` and bumps
`reloadCounter`. That is enough for LD/HiC, whose `shouldFetch` doesn't look at
loaded data — but arc's is `!regionTooLarge && !dataLoaded`, so once a fetch
commits, `shouldFetch` is false and a counter bump refires the autorun into a
no-op. `ArcFetchModel` therefore overrides `reload()` to also drop
`loadedRegionSignature`. `features` deliberately survives, so the stale arcs
stay on screen under the loading overlay instead of blanking.

(The counter itself only works because `installGlobalFetchAutorun` reads it
_above_ its gate — read under the gate it falls out of the MobX dependency set
on the very run that settles into "nothing to fetch". See ARCHITECTURE.md, "The
global-fetch trigger list must be read unconditionally".)

## Readiness / testid

Two separate flags, don't conflate them. `svgReady` (`dataLoaded` =
`isDataCurrent(loadedRegionSignature, currentRegionSignature(self))`, or error,
or too-large) is the **SVG-export terminal gate**: it goes false again on a
pan/zoom past a block boundary, so an export fired mid-refetch waits for fresh
arcs. The `arc-display${drawn ? '-done' : ''}` testid browser tests wait on uses
the looser `drawn` (`features !== undefined || !!error`) — the SVG analogue of
GPU `canvasDrawn`, which stays true across a refetch so the testid and the
loading anti-flash don't churn on pan. The `loadedRegionSignature` compare (a
region-key string, the single-array analog of `loadedRegions`) is the staleness
signal: an export fired right after a pan/zoom waits for fresh arcs instead of
capturing stale ones. `isDataCurrent` (`@jbrowse/core/util`) is the shared
freshness predicate — dotplot + synteny gate on the same rule.

## Too-large gating

Byte-only, like `LinearAlignmentsDisplay`: `CoreGetRegionByteEstimate` byte
estimate short-circuits an over-budget region before the feature download;
force-load raises `userByteLimit` (`RegionTooLargeMixin`) so a forced fetch
isn't re-blocked; `alwaysRender` adapters never gate.
