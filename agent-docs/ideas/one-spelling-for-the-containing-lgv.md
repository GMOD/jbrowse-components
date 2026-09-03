---
name: one-spelling-for-the-containing-lgv
description: 35 sites cast `getContainingView(self)` to `LinearGenomeViewModel` by hand, eight of them as a display's own `view` getter beside the foundation's `host` — a `getContainingLgv` helper would fold them, but the only home that can name the type is the LGV plugin's barrel, and a value import of it from every display model is an eager-bundle change nobody has measured
---

# One spelling for the containing LGV

Found in the 2026-09-03 census of per-display duplication that followed the
fetch-key consolidation. `MultiRegionDisplayMixin` and `GlobalFetchMixin` each
publish `host`, the view as the `RegionHost` contract display-kit reads, and
`foundationView.ts` says why a display wanting the linear genome view itself
declares its own `view` getter. Eight displays do, all with the same body:

```ts
get view() {
  return getContainingView(self) as LinearGenomeViewModel
}
```

and another 27 sites inline the cast — alignments' context menu three times,
the arc displays inside `laidOutArcs`, three tree-sidebar components. HiC uses
`self.host` and `self.view` in adjacent getters; multi-way synteny calls its
copy `lgv`. The parked
[discrete-zoom-thresholds](discrete-zoom-thresholds-in-rpc-props.md) note
counts four spellings of the same read for a zoom alone.

The fold is one function, `getContainingLgv(node)`, and the question is where
it lives. display-kit sits below the LGV plugin and cannot name the type. The
plugin's package has a single `"."` export, so the helper would be a **value**
import of the whole barrel — plugin class, components, SVG export — from every
display model that today imports only the type. About 30 files value-import the
barrel now, nearly all components and SVG bodies, so the model chunks' import
graph would change and `EAGER_BUNDLE.md`'s budget would have to be re-measured
before saying it is free. A subpath export (`@jbrowse/plugin-linear-genome-view/
containingLgv`) for a two-line file would sidestep that, and is the version
worth taking if the package ever grows subpaths for another reason.

Two other folds the same census declined, so they are not re-proposed:

- **A shared LGV readiness base under both fetch foundations.**
  `foundationParity.test.ts` pins the duplicated getters on purpose; ADR-041
  measured the extra compose layer pushing twelve display chains past
  TypeScript's inference depth.
- **`StoredHoverMixin` on `LinearMultiRowFeatureDisplay`.** Its
  `types.compose` call has ten arguments, which is the overload ceiling; the
  display keeps its hand-spelled trio and says so.
