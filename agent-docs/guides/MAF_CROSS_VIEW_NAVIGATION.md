---
name: maf-cross-view-navigation
description: Design for jumping from a MAF row to that species' own genome in a new view. The plugin stays portal-agnostic; the sample→assembly table is precomputed by whoever builds the config. Read before adding species navigation to plugins/maf.
---

# MAF row → other genome navigation

A MAF row already knows the aligned species' own coordinates (`chr`, `start`,
`strand`, `srcSize`). If that species is a genome the session can load, the row
is a navigable link: right-click a row, open `SPRET_EiJ chr2:…` in a new
LinearGenomeView. Written 2026-07-30 after surveying `~/src/jb2hubs` for what a
real deployment would need.

Follow the conventions in [REGION_VIEW_LAUNCH.md](REGION_VIEW_LAUNCH.md) for the
entry point itself — this note is only about the part that guide doesn't cover:
where the sample → assembly mapping comes from.

## The mapping does not belong in the plugin

Resolution by species name is the obvious move and it is wrong. Sample ids in
real tracks come in three unrelated flavors:

- UCSC db names (`mm10`, `panTro6`) — resolvable, but only against a portal that
  happens to host those dbs.
- Scientific names (`Acinonyx_jubatus`, in the hg38 cactus tracks) — the name
  maps to **several** assemblies. `Acinonyx jubatus` has three in
  genomes.jbrowse.org. The alignment was built against exactly one of them;
  landing on a different one gives silently wrong coordinates, which is worse
  than no link at all.
- Lab-internal ids (`HLnomLeu4`, `HLmacFas6`, Hiller lab, in multiz470way) —
  not name-resolvable at all without that lab's assembly table.

So the plugin must not guess. The mapping is provenance from whoever built the
alignment, and it belongs in the track config — precomputed, the same way
jb2hubs already precomputes assembly pairs into `synteny_pairs.json`.

## What shipped

`Sample` (`plugins/maf/src/types.ts`) carries an optional `assemblyName`,
threaded through `normalizeSamples` (`util/getSamples.ts`) → the adapters'
`samples` slot → `MafSource`/`setSamples` → the display's `samples` getter.
Unset means the row is not navigable, so no existing track changes behavior.
Config authors write:

```js
samples: [{ id: 'SPRET_EiJ', label: 'SPRET/EiJ', assemblyName: 'SPRET_EiJ' }]
```

- `components/findRowSpan.ts` — the row's own locus over a reference bp range.
  Shares `forwardPos` with `findRowHover.ts` so the `−`-strand mirror through
  `srcSize` can't disagree between the tooltip and a navigation target. A row
  that changes chromosome mid-range clips to the first one, so the result is
  always one navigable locus.
- `stateModel.ts::rowNavigationTarget` — that span for a display row, plus the
  sample's `assemblyName`/label; undefined when the row has no aligned base
  there or the sample has no assembly.
- `components/sampleNavigationItems.ts` — menu entries for the rows a drag
  selection covers, appended to the existing `SubsequenceContextMenu`. Six or
  fewer go inline, more collapse into a submenu.
- `openSampleInNewView.ts` — launches declaratively via
  `addView('LinearGenomeView', {init: {assembly, loc}})`, keyed
  `<displayId>_<assemblyName>` so following the same species repeatedly
  re-navigates one view. Same pattern as the spreadsheet view's location links.

The assembly is assumed to be loadable by the session; a `assemblyName` naming
an assembly the session doesn't have produces the view's own
assembly-not-found error rather than a pre-flight check. If a deployment needs
to load one on demand, `addSessionAssembly`
(`packages/core/src/util/types/index.ts:294`, the call
`JB2TrackHubConnection/doConnect.ts` uses) is the hook, and `Sample` would grow
the config location to load it from.

Not verified in a running browser yet — covered by `findRowSpan.test.ts` and
`sampleNavigationItems.test.ts` only. The first real config to point it at is
`~/src/jb2hubs`'s mouseStrains hub, whose sample ids are exact assembly names;
see `agent-docs/MAF_CROSS_VIEW_NAVIGATION.md` there.

The stretch version — open a **synteny** view driven by the MAF blocks
themselves, since the MAF carries both coordinate systems and the alignment, so
no PAF is needed — is a new adapter shape, not a menu item. It's worth doing,
but after the LGV jump has proven the mapping.
