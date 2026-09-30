---
name: multi-file-tracks-take-their-rows-from-their-members
description: Many files as one track, one row per file, for any format — a multi-row BED from twenty per-sample peak files as well as today's multi-BigWig. One multi-file adapter in core replaces MultiWiggleAdapter and exposes its members, each display's worker loops over them the way wiggle's typed-array path already does, rows come from the adapter's listing through shared code, a region carries its chromosome aliases so files may spell chromosomes differently, and one combine table serves the add-track form, the track selector and jb.addTrack. Read before touching MultiWiggleAdapter, the multi-wiggle add-track workflow, "Create multi-wiggle track", or a row display's source of rows.
---

# Multi-file tracks take their rows from their members

## What is wrong today

Three routes stack several files into one track, and each has its own rule:

- **The add-track workflow** makes every dropped file and pasted line a
  `BigWigAdapter` (`MultiWiggleAddTrackWorkflow/util.ts:83,103`). A BED passes
  the form without a word and fails after submit as
  `Subtrack "x": Error: not a BigWig/BigBed file`. `mapWithConcurrency` rejects
  on the first failure, so one bad file blanks every row. A BigBed passes bbi's
  magic check and draws its zoom summaries as a signal until the view zooms in.
- **"Create multi-wiggle track..."** in the track selector drops every selected
  track that is not a `QuantitativeTrack` (`CreateMultiWiggleExtension/index.ts:66`),
  and offers nothing when only feature tracks are checked.
- **`jb.addTrack([...])`** refuses anything but `.bw` (`jbApi.ts:1308`), so it
  refuses the bedGraph the selector accepts.

Nothing stacks feature files. `LinearMultiRowFeatureDisplay` paints one row per
value of a column in ONE file (`rows: 'sample'` over the BXD, ChromHMM, KHV and
SyRI BEDs in `test_data`), so twenty per-sample peak BEDs have to be merged on
the command line first.

And every file in a stack must spell chromosomes alike. `loadRefNameMap.ts:86`
maps each canonical name to one spelling, the last one the union of the files'
names offered, so a `chr1` file stacked with a `1` file draws nothing and
`detectRefNameMismatch` stays silent because some name matched.

## The design

A multi-file track's rows are its **members**, not a label stamped on each
feature. `MultiWiggleAdapter`'s fast path already works that way:
`getMultiSourceFeatureArraysMulti` hands the executor `{ source, raws }` per
file and labels no feature. Making it the contract for every format removes, on
the drawing path, the per-feature copy (`MultiWiggleAdapter.ts:240`), id
collisions between files, and the clash between the member label and a
parser's own `source` field.

### One multi-file adapter, in core

`MultiFileAdapter` in `packages/core/src/data_adapters/`, registered by
`CorePlugin` beside `CytobandAdapter`. It is what `MultiWiggleAdapter` is minus
the BigWig assumptions:

- `subadapters: [{ ...adapterConfig, name?, color?, ...attributes }]` and
  `samplesTsvLocation`. A member's default name is its primary location's
  basename, read for any format — today `getFilenameFromAdapterConfig` reads
  `bigWigLocation` alone (`MultiWiggleAdapter.ts:73`), so a bedGraph member is
  named by a hash. `disambiguateSources` moves with it.
- `getMembers(regions, opts)` → `{ name, adapter, regions }[]`, filtered by
  `opts.sources`, each member's regions already spelled the way that member's
  file spells them (see below). Executors call this; it is the whole contract.
- `getFeatures` for consumers that know nothing of members — the basic
  display, export, text search. Each feature comes through a thin delegating
  `Feature` whose `get('source')` answers the member, whose `id()` is
  member-qualified and whose `toJSON()` carries both. A BigBed singleton's id is
  `bb-${blockOffset}-${recordStart}` with no adapter id in it
  (`BigBedAdapter.ts:182`), so two BigBeds from one pipeline collide without the
  qualifier.
- `getRefNames` is the union, under the same concurrency cap as the fetches —
  today an unbounded `Promise.all` (`MultiWiggleAdapter.ts:187`) downloads every
  index before the first paint.
- `getRegionByteSize` sums the members that estimate; `getZoomRange`
  intersects; `getRegionQuantitativeStats` aggregates.
- `listRowSources` lists every member with its label, colour AND its
  attributes. Today's listing strips everything but label and colour
  (`MultiWiggleAdapter.ts:369-375`), so a samples-TSV column never reaches
  `rowColor` or `facet` — against keeping row metadata on the adapter.

`MultiWiggleAdapter` stays registered as a name for the same class, with its
`bigWigs` shorthand as a snapshot normalizer, because hosted hub configs written
for older JBrowse keep using it. New configs write `MultiFileAdapter`.

### Each display's worker loops over the members

- **Wiggle**: `fetchRegionRaws` (`fetchRegionRaws.ts:69`) and the render and
  cluster executors take `getMembers` where they take `isMultiSource` today.
  `multiSourceAdapter.ts` goes.
- **Multi-row**: `executeMultiRowGetFeatures` fetches per member and dedupes
  within a member (`:50` dedupes across the whole list today), then packs with
  the member as the row. Ids leaving the worker are member-qualified, so
  `GetCanvasFeatureDetails` round-trips a click through `getFeatures`.
  `MultiRowClusterFeaturesRPC` does the same.
- **A member that fails** puts an error on its own row, and the others draw.
  Abort still aborts the whole fetch.

### Rows come from the adapter's listing, through shared code

`MarkGetRowSources` moves into core as `CoreGetRowSources`, beside
`CoreGetRefNames`. `TreeSidebarMixin` gains a `rowListing` hook and merges the
listed rows ahead of the found rows, in listing order, which is what the mark
display does by hand today (`LinearMarkDisplay/model.ts:705-743`); the mark
display moves onto it. Multi-row's own sort sets
`unlistedRowsSort: 'sorted'` (`LinearMultiRowFeatureDisplay/model.ts:337`) and
would re-sort the files alphabetically, so the mixin owns the rule: listed rows
in listing order, then found rows sorted.

The worker's automatic row field prefers the listing's field whenever the
adapter lists rows, so a multi-file track draws one row per file with no `rows`
written into its config. `source` sits in `NON_PARTITION_TAGS`
(`packMultiRowFeatures.ts:83-94`), which hides it from "Partition by..."; a
listed field is exempt.

Wiggle and MAF already keep a row with nothing in view, since a multi-source
payload carries the full list in every region (`sourcesLogic.ts`). The
consumers that gain are multi-row, and marks by moving.

### A region carries its chromosome aliases

`renameRegions.ts` stamps each region with its alias set,
`[canonical, ...assembly.getAliasesForRefName(canonical)]` — that method leaves
out the name it is given (`assembly.ts:652`). It does so inside
`assemblyRenameData`/`renameRegionIfNeeded` (`:121-145`), where the assembly is
already loaded, so the set is never empty, and every feature RPC renames through
it. `fetchInputs`, `zoomFetchArgs` and `loadedRegions` never see the stamp, so
no fetch key moves.

`getMembers` hands each member the first alias its own `getRefNames` holds,
compared case-insensitively, since case variants are not aliases. A member none
of whose names the assembly knows gets a warning on the listing, shown on its
row — `detectRefNameMismatch` cannot see it, because it fires only when no name
at all matches.

The header of `renameRegions.ts:20-42` says a second renamed name has "no
reason to expect a third". This reverses it, so it lands with an ADR. GWAS's
LD join (`ldJoinResolver.ts`, `opts.ld.refName`) resolves a second file's
spelling by hand before the RPC and is a candidate to move onto the stamp.

### A member that carries rows of its own

A bedMethyl file, a bedGraph with a source column, or a BED with a `sample`
column carries several rows in one file. Stamped with the member name, those
inner rows collapse into one. The one-row model's two levels answer it: the
member is the band (`facet`) and the inner value is the row (`rows`), so the row
key is the pair and the label is the inner value. A single-row member keeps the
member as its row and draws no band.

### One combine mechanism

The member's track type decides the stacked track, as data:

```ts
{
  QuantitativeTrack: { trackType: 'MultiQuantitativeTrack' },
  FeatureTrack: {
    trackType: 'FeatureTrack',
    displays: [{ type: 'LinearMultiRowFeatureDisplay' }],
  },
}
```

Declared in `packages/core/src/util/tracks.ts` beside the guessers; wiggle
contributes the first entry and canvas the second through an extension point
in the shape of `Core-guessAdapterForLocation`. One core
`combineTrackConfs(rows) → { conf, misfits }` reads it, and three callers use
it:

- **"Add multi-row track"**, replacing "Add multi-wiggle track", built from the
  bulk workflow's `LocationInput`, `summarizeBulkInput` (detection and index
  pairing) and `TrackPreviewTable`, with rename in the table. It publishes, as
  every add-track workflow does (`addTrackFromWidget.ts:137`).
- **"Create multi-row track..."** in the track selector, moved into
  data-management, which owns the selector. It passes the whole selection,
  names the misfits, and adds to the session.
- **`jb.addTrack([...])`**, which then stacks any format the table takes.

A misfit is a file nothing recognises, a mix of quantitative and feature files,
or a track on another assembly; the preview names each one with its reason.
bedGraph needs nothing, being `QuantitativeTrack` already
(`trackTypes.generated.ts:12-13`). MACS2's `.narrowPeak`/`.broadPeak`, the
likeliest per-sample peak files, match no regex in `add-track-core/src/formats.ts`
and need one.

`MultiWiggleAddTrackWorkflow` and `CreateMultiWiggleExtension` go, and with
them the pasted-JSON subadapter form: rename is in the table, colour is
`rowColor` (ADR-160), and a hand-written subadapter list is a config file.

### Which display

`LinearMultiRowFeatureDisplay` is the default for feature members. It paints
the product picture — which samples have a peak or a segment where — and
already clusters rows on presence (`clusterField: ''`). The mark display draws
the same adapter from config (a `span` mark, `rows: 'source'`, ADR-189);
clustering spans there stays its own proposal and this one does not need it.

## Order of work

Each step is one branch, gated by its own tests; figures move only where a
display's row source changes.

1. **The ADR and the adapter.** `MultiFileAdapter`, `getMembers`, the
   delegating feature, the listing with attributes, `MultiWiggleAdapter` as its
   alias. Wiggle's executors move onto `getMembers` with per-member errors.
2. **Shared listing.** `CoreGetRowSources`, the `rowListing` hook and its order
   rule, the mark display onto it.
3. **Multi-row on members.** Fetch, dedupe, pack, cluster and details per
   member; the listing's field as the automatic row field.
4. **Aliases on the region.** The stamp, the per-member pick, the per-member
   warning; GWAS's LD join if it fits.
5. **Members with rows of their own.** The pair key and the member band, on
   both displays.
6. **The combine table and its three callers.** The new form and selector item,
   `jb.addTrack`, the peak formats, and the removals. The pages that name the
   multi-wiggle route or use it as their worked example move with it:
   `tutorials/scatac_pseudobulk.md:199`,
   `developer_guides/creating_addtrack_workflow.md` and
   `developer_guides/extension_points.md:1063`.

## Open inside the work

- The adapter's name. `MultiFileAdapter` names what a user has; a member can be
  a non-file adapter (GC content over the sequence), which argues for a name
  about members instead.
- How the pair key of a member with rows of its own is spelled, and whether
  wiggle's `checkRowsField`, which admits `source` alone, widens to it or the
  pair is composed into `source`.
- Whether an alias set on every region should be gated on a capability the
  adapter declares, the way `READS_REFERENCE` is (`dataAdapterCache.ts:26`),
  so adapters with one file keep RPC args byte-identical.
