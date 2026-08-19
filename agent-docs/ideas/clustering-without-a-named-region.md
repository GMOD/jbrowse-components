---
name: clustering-without-a-named-region
description: `runClustering: true` with no `clusterRegion` clusters over the view's dynamicBlocks, which are viewport-width dependent — so the same session spec produces a different tree on a different monitor. The algorithm is deterministic; the input is not. Four ways to close it, and which one keeps the convenience the fallback exists for.
---

# `runClustering` without a `clusterRegion` is not reproducible

`clusterRegions` (`packages/tree-sidebar/src/runClusteringAutorun.ts`) falls
back to `view.dynamicBlocks.contentBlocks` when the display carries no
`clusterRegion`. Those blocks are what is *on screen*, so their extent depends on
the window width, the drawer being open, and the device pixel ratio. A session
spec that says `runClustering: true` and nothing else therefore orders the
samples differently on a laptop than on a workstation, and a figure shot from it
is not reproducible even by the person who shot it.

Nothing about the clustering itself is at fault. `runClustering` is a
launch-spec flag on the same transient pattern as `LinearGenomeView`'s `init` —
it fires once, then clears itself — so the fallback was there to make the flag
usable without a second parameter.

## The four options

- **Require `clusterRegion`.** Simplest and most honest; costs the one-parameter
  form the flag was designed around, and breaks any spec relying on the
  fallback.
- **Fall back to the view's whole displayed region set** rather than to what is
  rendered. `displayedRegions` is a session fact, not a viewport one, so the
  same spec gives the same tree — and on a whole-genome view that is a lot of
  data to cluster over, which is what the visible-blocks fallback was avoiding.
- **Record what it used.** Let the fallback stand, but write the resolved
  regions into `clusterRegion` as part of the run, so the session that comes out
  is reproducible even though the spec that went in was not. This keeps the
  convenience and makes a *saved* session self-describing; a fresh spec still
  varies on first run.
- **Refuse quietly and say so** — run nothing, notify that `clusterRegion` is
  required. Same as the first option with a better failure.

The third is the one that costs nothing and fixes the case people actually hit
(a shared session), so it is the place to start unless the spec-level guarantee
is what is wanted.

Whichever lands: `clusterRegion` with a typo in it already surfaces through the
autorun's own error path, which is where the notify would go.
