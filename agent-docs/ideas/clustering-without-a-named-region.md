---
name: clustering-without-a-named-region
description: `runClustering: true` with no `clusterRegion` clusters over the view's dynamicBlocks, which are viewport-width dependent — so the same session spec produces a different tree on a different monitor on first run. A saved session is already self-describing (`clusterTree` and `clusterProvenance` persist), so what is left is the spec-level guarantee, and each way to get it costs the one-parameter form.
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

The third is already the case in effect: the run's output persists as
`clusterTree` and `clusterProvenance` (the regions the matrix was built over,
`TreeSidebarMixin`), so a saved session carries the tree it drew and says what
it came from, whatever the spec that produced it said. What remains open is the
spec-level guarantee — a fresh `runClustering: true` still varies with the
viewport on first run — and that is one of the other three, each a decision
about the one-parameter form.

Whichever lands: `clusterRegion` with a typo in it already surfaces through the
autorun's own error path, which is where the notify would go.
