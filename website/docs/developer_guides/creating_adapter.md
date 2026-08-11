---
title: Custom adapters
description:
  Read data from custom file formats with feature, regions, or sequence adapters
guide_category: Plugins
---

**TL;DR:** extend `BaseFeatureDataAdapter`, implement `getRefNames()` and
`getFeatures()` (an rxjs stream of `SimpleFeature`s), and register the type in
your plugin.

An adapter is a class that fetches and parses your data and returns it in a
format JBrowse understands.

To display data from a new source with JBrowse's existing gene displays, write a
custom adapter. For custom rendering, you'll also need a
[custom display](/docs/developer_guides/creating_display), which owns the
drawing, state, and menus.

## Adapter types

- **Feature adapter** - Takes a request for a _region_ (chromosome, start, end)
  and returns _features_ (genes, reads, variants, etc.) in that region.
  Examples: [BAM](https://samtools.github.io/hts-specs/SAMv1.pdf) and
  [VCF](https://samtools.github.io/hts-specs/VCFv4.3.pdf) adapters.
- **Regions adapter** - Defines what regions are in an assembly
  (chromosomes/contigs/scaffolds and their sizes). Example:
  [chrom.sizes](https://software.broadinstitute.org/software/igv/chromSizes)
  adapter.
- **Sequence adapter** - Combines regions and feature adapters: returns the
  region list and sequences for queried regions. Examples:
  [FASTA](https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Web&PAGE_TYPE=BlastDocs&DOC_TYPE=BlastHelp)
  and [.2bit](https://genome.ucsc.edu/FAQ/FAQformat.html#format7) adapters.
- **RefName alias adapter** - Returns alias data for reference sequence names,
  e.g. "chr1" → "1". See [](/docs/developer_guides/refname_aliasing).
- **Text search adapter** - Searches text search indexes and returns results.
  Example: the trix adapter. See
  [creating a custom text search adapter](/docs/developer_guides/creating_text_search_adapter).

## What a feature adapter implements

Extend `BaseFeatureDataAdapter` and supply two methods: `getRefNames`, used for
refName renaming, and `getFeatures`, an rxjs observable stream of the features
overlapping a region, positions 0-based half-open. The base class already holds
the config, `getSubAdapter` and the plugin manager and exposes
`this.getConf('slotName')`, so no constructor is needed unless the adapter sets
up state of its own. Type it on your config schema
(`BaseFeatureDataAdapter<MyAdapterConfig>`, where `MyAdapterConfig` comes from
your [config schema](/docs/developer_guides/configuration_schema)) so those
`getConf` reads are typed.

## Example feature adapter

`Gff3Adapter` in full. It parses the whole file up front, so `getFeatures` is a
lookup:

<!-- include: plugins/gff3/src/Gff3Adapter/Gff3Adapter.ts -->

```ts
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  groupLinesByRef,
  makeFeatureIntervalTreeMap,
} from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { parseLinesLazy } from 'gff-nostream'

import { Gff3Feature } from '../Gff3Feature.ts'

import type { IdentifiedGffFeature } from '../Gff3Feature.ts'
import type { Gff3AdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class Gff3Adapter extends BaseFeatureDataAdapter<Gff3AdapterConfig> {
  // the whole file is resident after one load, so the fetch/parse status comes
  // from inside the load itself rather than a label wrapped around it
  private loadData = cachedSetup({
    setup: async (opts?: BaseOptions) => {
      const buffer = await fetchAndMaybeUnzip(
        openLocation(this.getConf('gffLocation'), this.pluginManager),
        opts,
      )

      const { headerLines, linesByRef } = groupLinesByRef(
        buffer,
        opts?.statusCallback,
      )

      const intervalTreeMap = makeFeatureIntervalTreeMap<IdentifiedGffFeature>(
        linesByRef,
        // lines are already split and comment/FASTA-filtered by
        // groupLinesByRef, so feed them straight to parseLinesLazy rather than
        // re-joining and re-splitting through parseStringSync.
        //
        // Lazy because the whole file stays resident for the session: leaving
        // column 9 as text rather than an object per attribute is what keeps
        // that resident set small (8.5x on GENCODE-shaped input), and the
        // render path reads only a handful of attributes anyway — see
        // Gff3Feature.
        (lines, refName) => {
          const features = parseLinesLazy(lines) as IdentifiedGffFeature[]
          // stamped in place rather than through `{...feature, uniqueId}`:
          // these are freshly parsed objects nobody else holds, and the spread
          // copied every attribute of every top-level feature in the file to
          // add one key
          for (let i = 0; i < features.length; i++) {
            features[i]!.uniqueId = `${this.id}-${refName}-${i}`
          }
          return features
        },
        'Parsing GFF data',
      )

      return { header: headerLines.join('\n'), intervalTreeMap }
    },
  })

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTreeMap } = await this.loadData(opts)
    return Object.keys(intervalTreeMap)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const { intervalTreeMap } = await this.loadData(opts)
        const tree = intervalTreeMap[refName]
        if (tree) {
          for (const f of tree(opts.statusCallback).search([start, end])) {
            observer.next(new Gff3Feature(f, f.uniqueId))
          }
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }
}
```

- `cachedSetup` memoizes the parse for every method that awaits it, and clears
  the memo on rejection so a failed load retries. Range-streaming adapters (BAM,
  tabix) skip it and read the index per query.
- Prefix `uniqueId` with `this.id`: two tracks over one file must not collide.
- The `try`/`catch` is redundant, see [getFeatures](#getfeatures).

For an API instead of a file, only the callback body changes: `fetch` with
`opts?.signal`, then `observer.next(new SimpleFeature(...))` per hit.

To wrap another adapter (e.g. a sequence adapter for a feature adapter that
needs the reference), resolve it lazily with `this.getSubAdapter` — it is
`async`, so it cannot be called from a constructor:

<!-- include: plugins/gccontent/src/GCContentAdapter/GCContentAdapter.ts#subAdapter -->

```ts
public async configure() {
  const adapter = await this.getSubAdapter?.(this.getConf('sequenceAdapter'))
  if (!adapter) {
    throw new Error('Error getting subadapter')
  }
  return adapter.dataAdapter as BaseSequenceAdapter
}
```

`getSubAdapter` is optional on the base class, hence the `?.` and the check;
`dataAdapter` is the base union, so cast it. Resolve it in one `configure()` the
other methods await rather than in each of them.

Larger example:
[`MCScanAnchorsAdapter`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanAnchorsAdapter/MCScanAnchorsAdapter.ts).

## Feature adapter API

### getRefNames

Returns the refNames in the file. Used for "refname renaming", optional but
useful when files use different conventions (e.g. chr1 vs 1). See
[reference renaming](/docs/config_guides/assemblies/#configuring-reference-name-aliasing).

### getFeatures

`getFeatures(region, options)`

`Region` is a snapshot of this MST model:

<!-- include: packages/core/src/util/types/mst.ts#regionModel -->

```typescript
export const NoAssemblyRegion = types
  .model('NoAssemblyRegion', {
    refName: types.string,
    start: types.number,
    end: types.number,
    reversed: types.optional(types.boolean, false),
  })
  .actions(self => ({
    setRefName(newRefName: string): void {
      self.refName = newRefName
    },
  }))

export const Region = types.compose(
  'Region',
  NoAssemblyRegion,
  types.model({
    assemblyName: types.string,
  }),
)
```

`refName`/`start`/`end` specify the genomic range, half-open and 0-based.
`assemblyName` is used when your adapter handles multiple assemblies (e.g.
synteny or a multi-assembly REST API).

`originalRefName` is **not** on `Region`. Refname renaming adds it to the object
it passes you — as the sequence adapter's (FASTA) name for the refname you were
queried with, so a CRAM/BAM adapter can fetch the matching reference sequence.
It is added **only when a rename actually happened**, so it is absent whenever
the track and the assembly already agree. To read it, type the parameter
`AugmentedRegion` (from `@jbrowse/core/util`, which is `Region` plus an optional
`originalRefName`) and handle the undefined case — the alignments adapters do
exactly this.

The options parameter is `BaseOptions` (from
`@jbrowse/core/data_adapters/BaseAdapter`). Most of it exists for a specific
kind of adapter and is ignored by the rest:

<!-- include: packages/core/src/data_adapters/BaseAdapter/types.ts#baseOptions -->

```typescript
export interface BaseOptions {
  stopToken?: StopToken
  bpPerPx?: number
  sessionId?: string
  trackInstanceId?: string
  // unused in-tree but kept so BaseOptions is structurally assignable to the
  // `Options { signal? }` interfaces in @gmod/tabix, @gmod/bbi-js, etc. that
  // adapters forward opts to
  signal?: AbortSignal
  // The single out-of-band status transport. A plain string is an indeterminate
  // phase label; a StatusWithProgress object adds a determinate fraction
  // (`current`/`total` are units-agnostic — bytes for a download, blocks for an
  // unzip, features for a scan). Adapters wrap the raw byte counts from the
  // index reader (@gmod/tabix, @gmod/bam, @gmod/cram) into this object form.
  statusCallback?: StatusCallback
  headers?: Record<string, string>
  statsEstimationMode?: boolean
  // Used by synteny/comparative adapters in getRefNames to pick which side of
  // the pairing to return refnames for. Single-assembly adapters ignore it.
  assemblyName?: string
  // The assembly on the *other* side of a synteny band, set by the synteny
  // render RPC from the target view. Lets a multi-genome adapter (e.g.
  // AllVsAllPAFAdapter) whose config lists all N assemblies isolate the exact
  // pair a band draws — `assemblyName` alone can't, since one file backs every
  // pair. Pairwise adapters (which already know their pair) ignore it.
  targetAssemblyName?: string
  // Which level-of-detail tier to read, for adapters that expose more than one
  // (e.g. PIF's per-row CIGAR fine tier vs its no-CIGAR coarse tier). Absent, the
  // fine tier is served; adapters without tiering ignore it entirely.
  //
  // This is a *resolved* tier, never the user's 'auto' setting: resolving auto
  // needs a zoom, and it happens on the main thread in a display getter that
  // feeds the fetch cache key (`resolveLodTier` in @jbrowse/synteny-core).
  // Resolving it here instead hides a fetch input from that key, which is how a
  // zoom across the threshold came to leave a view holding the wrong tier.
  lodMode?: 'fine' | 'coarse'
}
```

The ones a typical adapter reads:

- `bpPerPx` - resolution of the genome browser when features were fetched
- `stopToken` - a JBrowse cancellation token; pass it to `ObservableCreate` and
  to downstream readers so an obsolete fetch aborts
- `signal` - an `AbortSignal` for APIs (like `fetch`) that take one
- `headers` - HTTP headers as a plain object
- `statusCallback` - report load progress to the UI (see
  [](/docs/developer_guides/rpc_workers))
- any `rpcProps()` the display model defines are spread in at the RPC call site,
  so a display's user-facing settings reach the adapter under their own names

Returns an rxjs `Observable`. Emit features with
`observer.next(new SimpleFeature(...))` and finish with `observer.complete()`.
No `try`/`catch` needed: `ObservableCreate` forwards a thrown error (or rejected
async callback) to `observer.error()`.

## See also

- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/creating_text_search_adapter)
- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/rpc_workers)
- [](/docs/developer_guides/imports_and_reexports)
- [](/docs/developer_guides/pluggable_elements)
