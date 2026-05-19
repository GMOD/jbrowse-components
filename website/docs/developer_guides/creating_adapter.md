---
id: creating_adapter
title: Creating custom adapters
---

### What is an adapter

An adapter is a class that fetches and parses your data and returns it in a
format JBrowse understands.

If you have a data source containing genes and want to display them using
JBrowse's existing gene displays, you can write a custom adapter. If you want a
custom display, you'll also need a custom display and/or renderer.

### Adapter types

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
  Example: the trix adapter.

### Skeleton of a feature adapter

```js
class MyAdapter extends BaseFeatureDataAdapter {
  constructor(config) {
    // config
  }
  async getRefNames() {
    // return refNames used in your adapter, used for refName renaming
  }

  getFeatures(region, opts) {
    // region: {
    //    refName:string, e.g. chr1
    //    start:number, 0-based half open start coord
    //    end:number, 0-based half open end coord
    //    assemblyName:string, assembly name
    //    originalRefName:string the refName before alias mapping, e.g. 1 instead of chr1
    // }
    // opts: {
    //   stopToken?: string
    //   ...rest: all the renderProps() object from the display type
    // }
  }

  freeResources(region) {
    // can be empty
  }
}
```

Implement `getRefNames` (optional), `getFeatures` (returns an rxjs observable
stream of features), and `freeResources` (optional).

### Example feature adapter

```js
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

class MyAdapter extends BaseFeatureDataAdapter {
  // config can be read with readConfObject; subadapters via getSubAdapter
  constructor(config, getSubAdapter) {
    const fileLocation = readConfObject(config, 'fileLocation')
    const subadapter = readConfObject(config, 'sequenceAdapter')
    const sequenceAdapter = getSubAdapter(subadapter)
  }

  getFeatures(region, options) {
    return ObservableCreate(async observer => {
      try {
        const { refName, start, end } = region
        const response = await fetch(
          `http://myservice/genes/${refName}/${start}-${end}`,
          options,
        )
        if (response.ok) {
          const features = await response.json()
          features.forEach(feature => {
            observer.next(
              new SimpleFeature({
                uniqueID: `${feature.refName}-${feature.start}-${feature.end}`,
                refName: feature.refName,
                start: feature.start,
                end: feature.end,
              }),
            )
          })
          observer.complete()
        } else {
          throw new Error(`${response.status} - ${response.statusText}`)
        }
      } catch (e) {
        observer.error(e)
      }
    })
  }

  async getRefNames() {
    // hardcode if known ahead of time, or fetch from file header
    return ['chr1', 'chr2', 'chr3'] // etc
  }

  freeResources(region) {
    // optionally remove cache resources for a region
  }
}
```

### Feature adapter API

#### getRefNames

Returns the refNames in the file. Used for "refname renaming" — optional but
useful when files use different conventions (e.g. chr1 vs 1). See
[reference renaming](/docs/config_guides/assemblies/#configuring-reference-name-aliasing).

#### getFeatures

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
API). `originalRefName` is the queried refname before ref renaming — e.g. if the
BAM uses chr1 but the reference uses 1, originalRefName is 1 and refName is
chr1.

The options parameter:

```typescript
interface Options {
  bpPerPx: number
  stopToken?: string
  headers: Record<string, string>
}
```

- `bpPerPx` - resolution of the genome browser when features were fetched
- `stopToken` - abort signal from AbortController
- `headers` - HTTP headers as a JSON object
- any `renderProps` from the display model type are also passed

Returns an rxjs `Observable`. Emit features with
`observer.next(new SimpleFeature(...))`, signal completion with
`observer.complete()`, and errors with `observer.error(error)`.

#### freeResources

Rarely used — most adapters use an LRU cache instead. Can be an empty function.
