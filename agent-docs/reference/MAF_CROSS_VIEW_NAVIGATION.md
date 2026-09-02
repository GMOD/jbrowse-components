---
name: maf-cross-view-navigation
description: Design for jumping from a MAF row to that species' own genome in a new view. The plugin stays portal-agnostic; the sample→assembly table is precomputed by whoever builds the config. Read before adding species navigation to plugins/maf.
audience: internal
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

- `components/findRowSpan.ts` — the row's own locus over a reference bp range.
  Shares `forwardPos` with `findRowHover.ts` so the `−`-strand mirror through
  `srcSize` can't disagree between the tooltip and a navigation target. A row
  that changes chromosome mid-range clips to the first one, so the result is
  always one navigable locus.
- `stateModel.ts::rowNavigationTargets` — that span for a `[startRow, endRow)`
  range of display rows in one walk, plus each sample's `assemblyName`/label;
  a row is absent from the result when it has no aligned base there or the
  sample has no assembly.
- `components/sampleNavigationItems.ts` — menu entries for the rows a drag
  selection covers, appended to the existing `SubsequenceContextMenu`. Six or
  fewer go inline, more collapse into a submenu.
- `openSampleInNewView.ts` — launches declaratively via
  `addView('LinearGenomeView', {assembly, loc})`, keyed
  `<displayId>_<assemblyName>` so following the same species repeatedly
  re-navigates one view. Same pattern as the spreadsheet view's location links.

`assemblyConfigLocation` is what makes this work on a portal at all. A site hosting
many genomes keeps one config per genome — genomes.jbrowse.org has ~50k — so an
alignment's species are not, and cannot be, all present in the config the user
opened. `ensureAssembly` fetches just the named assembly out of that config and
`addSessionAssembly`s it (with `addRelativeUris`, same as
`JB2TrackHubConnection/doConnect.ts`, or the fetched config's relative sequence
URIs resolve against the page). Omit it when the assembly is already in the
config; a name the session can't resolve and can't fetch surfaces the view's own
assembly-not-found error.

It is a `UriLocation`, not a bare url string, so `addRelativeUris` stamps its
`baseUri` along with every other location in the config — which is what lets a
config point at a sibling config by relative path
(`test_data/volvox/config_maf_navigation.json` does exactly that, and is the
"MAF row → that species' own genome" entry on the no-config screen). A bare
string is invisible to `addRelativeUris` and would have forced every config to
spell out absolute urls.

`ensureAssembly` asks whether the session already has the assembly with
`assemblyManager.has()`, **not** `get()`. `get()` on an unknown name reports it
to `Core-handleUnrecognizedAssembly`, so probing with it made every click ask
the installed plugins to go resolve a name the MAF display was about to supply
itself — on genomes.jbrowse.org that meant the Hubs plugin opening a connection
to a `/ucsc/<strain>/config.json` that doesn't exist, and a red 404 over a
navigation that had worked. Both hub connections' `doConnect` probed the same
way and were switched over too.

**Verified live** against `~/src/jb2hubs`'s regenerated mouseStrains AKR_J
config in a real jbrowse-web build (puppeteer, `--use-angle=gl`): drag-select →
right-click lists `Open AKR_J chr1:3000400-3000486` / `Open mm10
chr1:5880965-5881051` / `Open SPRET_EiJ chr1:3129040-3129126`, and clicking the
SPRET_EiJ entry fetched that assembly and opened a second LGV on
`SPRET_EiJ chr1:3,129,040..3,129,126`. Unit coverage is `findRowSpan.test.ts`
and `sampleNavigationItems.test.ts`.

**Reproduce it locally**, no portal needed: the no-config screen's "MAF row →
that species' own genome" link opens `test_data/volvox/config_maf_navigation.json`,
which covers all three row states in one track — `volvox` resolves to an
assembly already in the config, `simvolvox`/`minivolvox` are absent and load
from the sibling `config_maf_nav_targets.json` by relative uri, and the other
seven samples have no `assemblyName` and are correctly not offered. The two
target assemblies are `volvox.2bit` under a different name with a refName alias
(`chrA`/`chr_a` → `ctgA`), so the jump also exercises alias resolution without
adding any test data files.

## A sample whose id is a loaded assembly

The rule above — the plugin must not guess — is about resolving a name against
a portal, where `Acinonyx_jubatus` reaches three assemblies and `HLmacFas6`
reaches none. A different case turned up on the pangenome tutorials
(2026-08-25): the pggb and Minigraph-Cactus MAFs name their samples by PanSN
strain (`Sakai`, `CFT073`) and the same config loads those strains as
assemblies under exactly those names, with no `samples[].assemblyName` written
anywhere. `rowNavigationTargets` therefore falls back to the sample id when
`assemblyManager.has(id)` — an assembly present under the exact id is the
config author's own statement of which genome it is, and nothing is looked up.
The config mapping still wins where it exists.

## The synteny view, cut from the columns

The stretch version shipped the same day, as a menu item and not an adapter:
`launchMafRowSynteny.ts`. `buildMafRowSynteny` walks the fetched blocks' gapped
columns for one row — both bases `M`, a reference gap `I`, a row gap `D` —
clipped to the selection half-open, with the row's coordinates through the same
`forwardPos` the hover and the navigation target use, so a `-` row's mate span
is emitted forward on a minus-strand feature. The features go into a session
`SyntenyTrack` over a `FromConfigAdapter` (`addSessionTrackConf`, since it is a
view the user stood up), reference-anchored side only: the band's fetch queries
the top row's axis and the reference opens on top. Then `addView` with a
two-row `init`. **`FromConfigAdapter` filters by refName alone**, which is why
the mate copies read-vs-ref stores are not stored here: on the E. coli
pangenome every strain's contig is `chr`, so a mate copy would answer the
reference row's query too.

The all-samples stack is deliberately not offered: a stack's bands join
adjacent rows, so sample-vs-sample bands would need column-transitive features,
and a 464-haplotype MAF needs a row picker before a stack is a picture. One
pair at a time is the item.
