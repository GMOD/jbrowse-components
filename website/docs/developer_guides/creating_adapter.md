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

## Skeleton of a feature adapter

```ts
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Observable } from 'rxjs'
import type { MyAdapterConfig } from './configSchema.ts'

export default class MyAdapter extends BaseFeatureDataAdapter<MyAdapterConfig> {
  // Base class stores config/getSubAdapter/pluginManager and exposes
  // this.getConf('slotName'); no constructor needed unless you set up state.

  async getRefNames(opts?: BaseOptions): Promise<string[]> {
    return []
  }

  // features overlapping region, positions 0-based half-open. The next section
  // fills this in.
  getFeatures(region: Region, opts?: BaseOptions): Observable<Feature> {
    return ObservableCreate<Feature>(async observer => {
      observer.complete()
    }, opts?.stopToken)
  }
}
```

Implement `getRefNames` (used for refName renaming) and `getFeatures` (an rxjs
observable stream of features). Type the adapter on your config schema
(`BaseFeatureDataAdapter<MyAdapterConfig>`, where `MyAdapterConfig` comes from
your [config schema](/docs/developer_guides/configuration_schema)) so
`this.getConf(...)` reads are typed.

## Example feature adapter

```ts
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { MyAdapterConfig } from './configSchema.ts'

interface GeneJson {
  refName: string
  start: number
  end: number
}

export default class MyAdapter extends BaseFeatureDataAdapter<MyAdapterConfig> {
  async getRefNames(_opts?: BaseOptions) {
    // hardcode if known ahead of time, or read them from a file header
    return ['chr1', 'chr2', 'chr3']
  }

  getFeatures(region: Region, opts?: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = region
      const endpoint = this.getConf('endpoint')
      const response = await fetch(
        `${endpoint}/genes/${refName}/${start}-${end}`,
        { headers: opts?.headers, signal: opts?.signal },
      )
      if (!response.ok) {
        // thrown errors are routed to observer.error() by ObservableCreate
        throw new Error(`${response.status} ${response.statusText}`)
      }
      const genes = (await response.json()) as GeneJson[]
      for (const gene of genes) {
        observer.next(
          new SimpleFeature({
            uniqueId: `${gene.refName}-${gene.start}-${gene.end}`,
            ...gene,
          }),
        )
      }
      observer.complete()
    }, opts?.stopToken)
  }
}
```

For a real one of comparable size, read
[`Gff3Adapter`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3Adapter/Gff3Adapter.ts),
which parses a whole file up front, or
[`MCScanAnchorsAdapter`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanAnchorsAdapter/MCScanAnchorsAdapter.ts)
for one that wraps sub-adapters.

To wrap another adapter (e.g. a sequence adapter for a feature adapter that
needs the reference), resolve it lazily with `this.getSubAdapter` (it is
`async`, so never call it from a constructor):

```ts
const sub = await this.getSubAdapter?.(this.getConf('sequenceAdapter'))
const sequenceAdapter = sub?.dataAdapter
```

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
- any `renderProps` from the display model type are also spread in

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
