---
name: maf-cross-view-navigation
description: Design for jumping from a MAF row to that species' own genome in a new view. The plugin stays portal-agnostic; the sample→assembly table is precomputed by whoever builds the config. Read before adding species navigation to plugins/maf.
audience: internal
kind: spec
---

# MAF row → other genome navigation

A MAF row knows the aligned species' own coordinates (`chr`, `srcStart`,
`strand`, `srcSize`). When that species is a genome the session can load, the
row is a navigable link: right-click a row to open `SPRET_EiJ chr2:…` in a new
LinearGenomeView. [REGION_VIEW_LAUNCH.md](REGION_VIEW_LAUNCH.md) covers the entry
point; this doc covers where the sample → assembly mapping comes from.

## The mapping does not belong in the plugin

Sample ids in real tracks come in three unrelated flavors:

- UCSC db names (`mm10`), resolvable only against a portal that hosts them.
- Scientific names (`Acinonyx_jubatus`), which map to **several** assemblies.
  The alignment was built against exactly one, and landing on another gives
  silently wrong coordinates.
- Lab-internal ids (`HLnomLeu4`), not name-resolvable at all.

The plugin must not guess. The mapping is provenance from whoever built the
alignment, so it lives in the track config, precomputed the way jb2hubs
precomputes `synteny_pairs.json`.

## Shape

`Sample` (`plugins/maf/src/types.ts`) carries an optional `assemblyName`, threaded
through `normalizeSamples` → the adapters' `samples` slot → `MafSource` → the
display's `samples` getter. Unset means not navigable, so existing tracks are
unchanged.

```js
samples: [
  {
    id: 'SPRET_EiJ',
    label: 'SPRET/EiJ',
    assemblyName: 'SPRET_EiJ',
    assemblyConfigLocation: {
      uri: 'https://jbrowse.org/hubs/genark/mouseStrains/SPRET_EiJ/config.json',
      locationType: 'UriLocation',
    },
  },
]
```

Under `plugins/maf/src/LinearMafDisplay/`:

- `components/findRowSpan.ts` computes the row's own locus over a reference bp
  range. It shares `forwardPos` with `findRowHover.ts`, so the `−`-strand mirror
  through `srcSize` agrees between tooltip and target. A row that changes
  chromosome mid-range clips to the first, so the result is one locus.
- `stateModel.ts::rowNavigationTargets` returns that span plus each sample's
  `assemblyName`/label for a `[startRow, endRow)` range. A row is absent when it
  has no aligned base there or its sample has no assembly.
- `components/sampleNavigationItems.ts` appends menu entries to
  `SubsequenceContextMenu`: `sampleNavigationItems` ("Open aligned genome at the
  matching region") and `mafSyntenyLaunchItems` ("Linear synteny view, ⟨ref⟩
  vs..."), each with one submenu item per row.
- `openSampleInNewView.ts` launches `addView('LinearGenomeView', {assembly,
  loc})` keyed `<displayId>_<assemblyName>`, so following the same species
  re-navigates one view.

**`assemblyConfigLocation`** lets a portal-scale site (one config per genome)
work, since an alignment's species are not all in the config the user opened.
`ensureAssembly` fetches just that assembly's config and `addSessionAssembly`s it
with `addRelativeUris`, as `JB2TrackHubConnection/doConnect.ts` does. It is a
`UriLocation` so `addRelativeUris` stamps its `baseUri`, which lets a config point
at a sibling config by relative path. Omit it when the assembly is already in the
config.

**`ensureAssembly` probes with `assemblyManager.has()`, never `get()`.** `get()`
on an unknown name reports to `Core-handleUnrecognizedAssembly`, which made the
Hubs plugin open a connection to a nonexistent config and show a 404 over a
navigation that worked. Both hub connections' `doConnect` use `has()` too.

**Reproduce without a portal:** the no-config screen's "MAF row → that species'
own genome" link opens `test_data/volvox/config_maf_navigation.json`. It covers
each row state: `volvox` is already in the config, `simvolvox`/`minivolvox` load
from the sibling `config_maf_nav_targets.json`, and samples without
`assemblyName` are not offered. Coverage is `findRowSpan.test.ts` and
`sampleNavigationItems.test.ts`.

## A sample whose id is a loaded assembly

The pangenome tutorials' MAFs name samples by PanSN strain (`Sakai`, `CFT073`),
and the same config loads those strains as assemblies under those names.
`rowNavigationTargets` falls back to the sample id when `assemblyManager.has(id)`,
because an assembly under the exact id is the author's statement of which genome
it is. A config mapping still wins.

## The synteny view, cut from the columns

`launchMafRowSynteny.ts` (via `mafSyntenyLaunchItems`) builds a synteny view for
one row. `buildMafRowSynteny` walks the fetched blocks' gapped columns (both
bases `M`, reference gap `I`, row gap `D`), clipped half-open to the selection,
with coordinates through `forwardPos`. The features go into a session
`SyntenyTrack` over a `FromConfigAdapter` (`addSessionTrackConf`, since the user
stood it up), reference-anchored side only, then `addView` with a two-row
`init`.

**`FromConfigAdapter` filters by refName alone**, so the mate copies a read-vs-ref
store keeps are not stored: on the E. coli pangenome every contig is `chr`, and a
mate copy would answer the reference row's query too.

The all-samples stack is not offered. A stack's bands join adjacent rows, so
sample-vs-sample bands would need column-transitive features, and a 464-haplotype
MAF needs a row picker first.
