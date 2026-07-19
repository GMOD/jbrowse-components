---
title: Custom adapters
description:
  Read data from custom file formats with feature, regions, or sequence adapters
guide_category: Creating pluggable elements
---

## What is an adapter

An adapter is a class that fetches and parses your data and returns it in a
format JBrowse understands.

To display data from a new source using JBrowse's existing gene displays, write
a custom adapter. For custom rendering, you'll also need a
[custom display](/docs/developer_guides/creating_display) and/or a
[renderer](/docs/developer_guides/renderer_architecture).

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
  e.g. "chr1" → "1". See
  [RefName aliasing](/docs/developer_guides/refname_aliasing).
- **Text search adapter** - Searches text search indexes and returns results.
  Example: the trix adapter. See
  [creating a custom text search adapter](/docs/developer_guides/creating_text_search_adapter).

## Skeleton of a feature adapter

```ts
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Observable } from 'rxjs'
import type { MyAdapterConfig } from './configSchema.ts'

export default class MyAdapter extends BaseFeatureDataAdapter<MyAdapterConfig> {
  // The base class stores `config`, `getSubAdapter`, and `pluginManager` for
  // you and exposes `this.getConf('slotName')` — no constructor is needed
  // unless you set up instance state.

  // refNames this adapter serves, used for refName renaming
  async getRefNames(opts?: BaseOptions): Promise<string[]> {
    return []
  }

  // stream the features overlapping `region`; positions are 0-based half-open
  getFeatures(region: Region, opts?: BaseOptions): Observable<Feature> {
    // ...
  }
}
```

Implement `getRefNames` (used for refName renaming) and `getFeatures` (returns
an rxjs observable stream of features). Type the adapter on your config schema
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

The region parameter:

```typescript
interface Region {
  refName: string
  start: number
  end: number
  originalRefName: string
  assemblyName: string
}
```

`refName`/`start`/`end` specify the genomic range. `assemblyName` is used when
your adapter handles multiple assemblies (e.g. synteny or multi-assembly REST
API). `originalRefName` is the queried refname before ref renaming. For example,
if the BAM uses chr1 but the reference uses 1, originalRefName is 1 and refName
is chr1.

The options parameter is `BaseOptions` (from
`@jbrowse/core/data_adapters/BaseAdapter`); the fields an adapter typically
reads:

```typescript
interface BaseOptions {
  bpPerPx?: number
  stopToken?: StopToken
  signal?: AbortSignal
  headers?: Record<string, string>
  statusCallback?: (arg: string | StatusWithProgress) => void
}
```

- `bpPerPx` - resolution of the genome browser when features were fetched
- `stopToken` - a JBrowse cancellation token; pass it to `ObservableCreate` and
  to downstream readers so an obsolete fetch aborts
- `signal` - an `AbortSignal` for APIs (like `fetch`) that take one
- `headers` - HTTP headers as a plain object
- `statusCallback` - report load progress to the UI (see
  [RPC and worker system](/docs/developer_guides/rpc_workers))
- any `renderProps` from the display model type are also spread in

Returns an rxjs `Observable`. Emit features with
`observer.next(new SimpleFeature(...))` and signal completion with
`observer.complete()`. You don't need a `try`/`catch`: `ObservableCreate`
forwards a thrown error (or a rejected async callback) to `observer.error()`.

## See also

- [Custom track and display types](/docs/developer_guides/creating_display) -
  pair an adapter with a display to draw its features
- [Creating a custom text search adapter](/docs/developer_guides/creating_text_search_adapter)
- [Configuration schema](/docs/developer_guides/configuration_schema) - define
  the adapter's config slots
- [RPC and worker system](/docs/developer_guides/rpc_workers) - adapters run
  inside web workers
- [Plugin dependencies and re-exports](/docs/developer_guides/imports_and_reexports)
  - where `@jbrowse/core/util/rxjs` and other shared imports come from
- [Pluggable elements](/docs/developer_guides/pluggable_elements) - overview of
  all element types a plugin can register, including adapters
