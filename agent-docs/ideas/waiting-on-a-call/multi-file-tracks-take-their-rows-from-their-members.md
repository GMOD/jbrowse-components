---
name: multi-file-tracks-take-their-rows-from-their-members
description: Where the multi-row add-track plan grows once one of its accepted loose edges is reported — files spelling chromosomes differently, a row missing while its file has nothing in view, the per-feature copy, one bad file blanking the stack, the CLI and jbrowse-img staying BigWig-only. The full design behind it, reviewed four times; the simple plan landed on 2026-09-30 instead, and this doc lists the edges it left. One multi-file adapter in core replaces MultiWiggleAdapter and exposes its members, each display's worker loops over them the way wiggle's typed-array path already does, rows come from the adapter's listing through shared code, a region carries its chromosome aliases so files may spell chromosomes differently, and one generated combine table serves the add-track form, the track selector, jb.addTrack, `jbrowse add-track` and jbrowse-img. Read before touching MultiWiggleAdapter, the "Add multi-row track" workflow, "Create multi-row track", `--multiwig`, refName renaming, or a row display's source of rows.
---

# Multi-file tracks take their rows from their members

**Not the plan that was built.** On 2026-09-30 Colin chose four small changes
to existing code over this design, loose edges accepted, and they landed that
day. "Add multi-row track" guesses each file's format, names each file it
refuses, and stacks feature files as a `FeatureTrack` on
`LinearMultiRowFeatureDisplay` with `rows: 'source'`, still over
`MultiWiggleAdapter`. "Create multi-row track..." in the track selector does
the same for checked tracks. This doc is where that grows, one piece at a time,
when a user reports the edge the piece fixes: the alias stamp for files
spelling chromosomes differently, the shared listing for a row missing while
its file has nothing in view, the member loop for the per-feature copy and
per-file errors, the generated combine table for the CLI and jbrowse-img. Build
no piece on its own merit.

## The loose edges accepted on 2026-09-30

- Every file in a stack must spell chromosomes alike. A `chr1` BED stacked with
  a `1` BED draws one of them blank, with no warning. This is the one to watch.
- `MultiWiggleAdapter.sourceFeatures` copies each feature to stamp `source`.
- A file with nothing in view has no row until data appears.
- The multi-row display sorts its rows by name, not in the order the files were
  listed.
- One unreachable file blanks the whole stack, with an error naming it.
- In a stack of GFFs the stamp hides GFF's own `source` column.
- A `.bed.gz` dropped on JBrowse Web is refused, since a drop brings no `.tbi`;
  it goes in as a pasted URL. Desktop reads a dropped file by its path, so the
  index beside it is found.
- The byte gate sums every member's estimate against the display's one
  `fetchSizeLimit`, so a twenty-file stack trips it at a twentieth of each
  file's share.
- The adapter is still `MultiWiggleAdapter` under a BED track.
- `jb.addTrack`, `jbrowse add-track --multiwig` and `jbrowse-img --multiwig`
  stay BigWig-only.

## What is wrong today

The routes that stack several files into one track still disagree:

- **The add-track form and the track selector** check each member, but
  `mapWithConcurrency` rejects on the first failure, so one bad file blanks
  every row.
- **`jb.addTrack([...])`** refuses anything but `.bw` (`jbApi.ts:1311`), so it
  refuses the bedGraph and BED files the form accepts.
- **`jbrowse add-track --multiwig`** (`jbrowse-cli/.../add-track-utils/multiwig.ts:41`)
  and **`jbrowse-img --multiwig`** (`jbrowse-img/src/makeConfigs.ts:317`)
  hard-code `MultiWiggleAdapter` over `BigWigAdapter`.

A feature stack's rows are a label stamped on each feature, not the members:
`LinearMultiRowFeatureDisplay` partitions on the `source` value
`MultiWiggleAdapter` writes on a copy of every feature.

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
`CorePlugin` beside `CytobandAdapter`. It is `MultiWiggleAdapter` minus the
BigWig assumptions:

- `subadapters: [{ ...adapterConfig, name?, color?, ...attributes }]` and
  `samplesTsvLocation`. A member's default name is its primary location's
  basename, read for any format through the add-track format table
  (`MultiWiggleAdapter/memberLocation.ts`); it and `disambiguateSources` move
  with the class.
- `getMembers(regions, opts)` → `{ name, adapter, regions }[]`: the members the
  samples table admits, narrowed by `opts.sources`, as `getFilteredAdapters`
  does (`MultiWiggleAdapter.ts:193-200`), each with its regions spelled the way
  its own file spells them (see the aliases below). Executors call this; it is
  the whole contract, and it stays duck-typed the way `isMultiSource` is.
- `getFeatures` stays, for every consumer that knows nothing of members:
  `CoreGetFeatures`, export, feature details, the basic display. Each feature
  comes through a thin delegating `Feature` whose `get('source')` answers the
  member, whose `id()` is member-qualified and whose `toJSON()` carries both. A
  BigBed singleton's id is `bb-${blockOffset}-${recordStart}` with no adapter id
  in it (`BigBedAdapter.ts:182`), so two BigBeds from one pipeline collide
  without the qualifier.
- `getRefNames` is the union, under the same concurrency cap as the fetches;
  today's unbounded `Promise.all` (`MultiWiggleAdapter.ts:187`) downloads every
  index before the first paint.
- `getRegionByteSize` sums the members that estimate, as
  `MultiWiggleAdapter`'s does; `getZoomRange` intersects.
- `listRowSources` lists every member with its label, color and attributes,
  plus a `warnings` member, which `RowSourceListing` lacks
  (`rowSources.ts`). Today's listing strips everything but label and color
  (`MultiWiggleAdapter.ts:369-375`), so a samples-TSV column never reaches
  `rowColor` or `facet`, and the table's warnings are dropped
  (`:362-364`).
- It declares `READS_REFERENCE`, so members get a reference:
  `getSubAdapter` hands each member its parent's `keyedSequence`
  (`dataAdapterCache.ts:86-87`), which is undefined otherwise, and a GC-content
  or CRAM member would read none.

`MultiWiggleAdapter` stays as a name for the same class, because hosted hub
configs written for older JBrowse keep using it (jb2hubs writes it with
`subadapters`, jb2hubs's `mergeMultiWigTracks.ts`). `AdapterType` has no alias
mechanism, so the old name registers its own `ConfigurationSchema` instance,
`#trackType MultiQuantitativeTrack` tag and `bigWigs` shorthand normalizer over
the shared class. New configs write `MultiFileAdapter`.

### Each display's worker loops over the members

- **Wiggle**: `fetchSourceRaws` (`fetchRegionRaws.ts:64-70`) and the render and
  cluster executors loop over `getMembers` where they branch on
  `isMultiSource`, calling `fetchRegionRaws` per member.
  `multiSourceAdapter.ts` goes.
- **Multi-row**: `executeMultiRowGetFeatures` fetches per member and dedupes
  within a member (`:50` dedupes across the whole list today), then packs with
  the member as the row. Ids leaving the worker are member-qualified, so a
  click round-trips through `GetFeatureDetails`, which finds the feature in
  `getFeaturesArray` by `id()` (`plugins/canvas/src/RenderFeatureDataRPC/GetFeatureDetails.ts:17-19`).
  `MultiRowClusterFeaturesRPC` does the same.
- **A member that fails** puts an error on its own row, and the others draw.
  Abort still aborts the whole fetch.

### Rows come from the adapter's listing, through shared code

`MarkGetRowSources` moves into core as `CoreGetRowSources`, beside
`CoreGetRefNames`. `TreeSidebarMixin` gains a `rowListing` hook and merges the
listed rows ahead of the found rows, in listing order, which the mark display
does by hand today (`plugins/marks/src/LinearMarkDisplay/model.ts:705` on).
Multi-row's own sort sets `unlistedRowsSort: 'sorted'`
(`LinearMultiRowFeatureDisplay/model.ts:337`) and would re-sort the files
alphabetically, so the mixin owns the rule: listed rows in listing order, then
found rows sorted.

The worker's automatic row field prefers the listing's field whenever the
adapter lists rows, so a multi-file track draws one row per file with no `rows`
written into its config, where the form writes `rows: 'source'` today.

Multi-row gains the listing; the mark display keeps what it has by moving onto
the mixin. Wiggle already keeps a row with nothing in view, since a
multi-source payload carries the full list in every region (`sourcesLogic.ts`),
and MAF keeps its rows from a header fetch (`sourcesVolatile`).

### A region carries its chromosome aliases

`renamed()` (`renameRegions.ts:139`) writes each region's canonical name and
its alias set, `[canonical, ...assembly.getAliasesForRefName(canonical)]` —
that method leaves out the name it is given (`assembly.ts:652`). The assembly is
already loaded there, so the set is never empty, and the stamp goes on both
branches, since `renameRegionIfNeeded` returns a region unchanged when the map
has no entry (`:50-58`). `fetchInputs`, `zoomFetchArgs` and `loadedRegions`
never see it, so no fetch key moves.

The spelling an adapter reads is picked worker-side from its own memoized
`getRefNames`, resolving aliases and casing together as `getCanonicalRefName`
does. One helper serves two sites: the worker half of the rename base classes
(`deserializeArguments`, `RpcMethodType.ts:358`, which every renamed RPC
inherits and which must tolerate running twice) for the track's adapter, and
`getMembers` for each member. `RpcMethodTypeWithRenameRegion` mirrors
`regions[0]` into `region`, so the singular RPCs get it too.

**The stamp replaces the per-adapter map on the fetch path** rather than sitting
beside it; beside it, every region would carry two answers to one question and
members would ignore the first. `getRefNameMapForAdapter` survives for its
main-thread readers — synteny's `renameRegionsForAdapter`, GWAS's `ldJoinFor`
and the mismatch record. The repo `CLAUDE.md`'s "Worker side: don't" rule under
Names changes with it. A member none of whose names the assembly knows gets a
warning on the listing, shown on its row; `detectRefNameMismatch` cannot see
it, because it fires only when no name at all matches.

The header of `renameRegions.ts:20-42` says a second renamed name has "no
reason to expect a third". This reverses it, so step 4 lands with its own ADR.
GWAS's LD join resolves a second file's spelling by hand before the RPC
(`opts.ld.refName`) and is a candidate to move onto the stamp.

### One combine mechanism, generated

The member's track type decides the stacked track:

| Member track type | Stacked track | Display |
| --- | --- | --- |
| `QuantitativeTrack` | `MultiQuantitativeTrack` | its default |
| `FeatureTrack` | `FeatureTrack` | `LinearMultiRowFeatureDisplay` |

The table is generated into `packages/add-track-core` from tags on the track
and display types, as `trackTypes.generated.ts` is from `#trackType`
(`scripts/generateTrackTypeMap.ts`), because the CLI and jbrowse-img parse no
TypeScript and a runtime extension point never reaches them. It also answers
what the `#trackType` map cannot: `MultiFileAdapter`'s track type depends on its
members, so the generated adapter map has no single entry for it.

One `combineTrackConfs(rows) → { conf, misfits }` in add-track-core reads it,
and every route calls it:

- **"Add multi-row track"**, replacing "Add multi-wiggle track", built from the
  bulk workflow's `LocationInput`, `summarizeBulkInput` (detection and index
  pairing) and `TrackPreviewTable`, with rename in the table. It publishes, as
  every add-track workflow does (`addTrackFromWidget.ts:137`).
- **"Create multi-row track..."** in the track selector, moved into
  data-management, which owns the selector. It passes the whole selection,
  names the misfits, and adds to the session.
- **`jb.addTrack([...])`**, **`jbrowse add-track`** and **`jbrowse-img`**, whose
  `--multiwig` flags become a list of any files the table stacks.

A misfit is a file nothing recognises, a mix of quantitative and feature files,
or a track on another assembly; each route names it with its reason. bedGraph
needs nothing, being `QuantitativeTrack` already
(`trackTypes.generated.ts:12-13`). MACS2's `.narrowPeak`/`.broadPeak`, the
likeliest per-sample peak files, match no regex in
`add-track-core/src/formats.ts` and need one.

`MultiWiggleAddTrackWorkflow` and `CreateMultiWiggleExtension` go, and with
them the pasted-JSON subadapter form: rename is in the table, color is
`rowColor` (ADR-160), and a hand-written subadapter list is a config file.

`jbrowse text-index` indexes by adapter type (`indexableAdapters`,
`text-index/command.ts:109`) and skips a stack of BEDs without a word; it walks
`subadapters` and indexes each member under the stacked track.

### Which display

`LinearMultiRowFeatureDisplay` is the default for feature members. It paints
the product picture — which samples have a peak or a segment where — and
already clusters rows on presence (`clusterField: ''`). The mark display draws
the same adapter from config (a `span` mark, `rows: 'source'`, ADR-189);
clustering spans there is its own proposal, and this one does not need it.

### A member that carries rows of its own

A bedMethyl file, a bedGraph with a source column, or a BED with a `sample`
column carries several rows in one file, and grouping by member collapses them
into one. The one-row model's two levels answer it: the member is the band and
the inner value is the row. A row's `name` is the qualified `member/inner`, the
qualification `disambiguateSources` already writes, its `label` is the inner
value, and `facet: 'source'` bands by member. `bandRows` keys rows by name
alone (`arrangeRows.ts:209-214`), so an unqualified `m` under two bedMethyls
would collide; the qualified name fits ADR-160's `name` keyspace and ADR-189's
listing. Wiggle's `checkRowsField`, which admits `source` alone, widens to the
inner field. A single-row member keeps the member as its row and draws no band.

## Order of work

Each step is one branch that leaves main green, gated by its own tests; figures
move only where a display's row source changes.

1. **Rows are members: the ADR and the adapter.** `MultiFileAdapter`,
   `getMembers`, the delegating feature, the listing with attributes and
   warnings, `MultiWiggleAdapter` as its second name. Wiggle's executors move
   onto `getMembers` with per-member errors. Until step 4 `getMembers` passes
   regions through unrespelled, and until step 5 the generated track-type map
   files `MultiFileAdapter` under `FeatureTrack`; the old workflow keeps writing
   `MultiWiggleAdapter` meanwhile.
2. **Shared listing.** `CoreGetRowSources`, the `rowListing` hook and its order
   rule, the mark display onto it.
3. **Multi-row on members.** Fetch, dedupe, pack, cluster and details per
   member; the listing's field as the automatic row field.
4. **A region carries its aliases: the ADR and the stamp.** The stamp in
   `renamed()`, the worker-side pick for the track's adapter and each member,
   the per-member warning, the `CLAUDE.md` rule; GWAS's LD join if it fits.
5. **The generated combine table and its five routes.** The new form and
   selector item, `jb.addTrack`, the CLI and jbrowse-img, the peak formats, the
   text-index walk, and the removals. The pages that name the multi-wiggle route
   or use it as their worked example move with it:
   `tutorials/scatac_pseudobulk.md:199`,
   `developer_guides/creating_addtrack_workflow.md` and
   `developer_guides/extension_points.md:1063`.
6. **Members with rows of their own.** The qualified name, the member band and
   the widened `checkRowsField`, on both displays.

## Open inside the work

- The adapter's name. `MultiFileAdapter` names what a user has; a member can be
  a non-file adapter (GC content over the sequence), which argues for a name
  about members instead.
- Whether the mismatch record moves worker-side with the pick. Until it does,
  `loadRefNameMap` still makes its `CoreGetRefNames` round trip for the record,
  so step 4 takes the map off the fetch path without taking the stall off the
  first paint.
