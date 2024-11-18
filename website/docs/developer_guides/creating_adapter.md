---
id: creating_adapter
title: Creating a custom adapter
---

### What is an adapter

An adapter is essentially a class that fetches and parses your data and returns
it in a format JBrowse understands.

For example, if you have some data source that contains genes, and you want to
display those genes using JBrowse's existing gene displays, you can write a
custom adapter to do so. If you want to do a custom display of your data,
though, you'll probably need to create a custom display and/or renderer along
with your adapter.

### What types of adapters are there

- **Feature adapter** - This is the most common type of adapter. Essentially, it
  takes a request for a _region_ (a chromosome, starting position, and ending
  position) and returns the _features_ (e.g. genes, reads, variants, etc.) that
  are in that region. Examples of this in JBrowse include adapters for
  [BAM](https://samtools.github.io/hts-specs/SAMv1.pdf) and
  [VCF](https://samtools.github.io/hts-specs/VCFv4.3.pdf) file formats.
- **Regions adapter** - This type of adapter is used to define what regions are
  in an assembly. It returns a list of chromosomes/contigs/scaffolds and their
  sizes. An example of this in JBrowse is an adapter for a
  [chrome.sizes](https://software.broadinstitute.org/software/igv/chromSizes)
  file.
- **Sequence adapter** - This is basically a combination of a regions adapter
  and a feature adapter. It can give the list of regions in an assembly, and can
  also return the sequence of a queried region. Examples of this in JBrowse
  include adapters for
  [FASTA](https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Web&PAGE_TYPE=BlastDocs&DOC_TYPE=BlastHelp)
  and [.2bit](https://genome.ucsc.edu/FAQ/FAQformat.html#format7) file formats.
- **RefName alias adapter** - This type of adapter is used to return data about
  aliases for reference sequence names, for example to define that "chr1" is an
  alias for "1". An example of this in JBrowse is an adapter for (alias
  files)[http://software.broadinstitute.org/software/igv/LoadData/#aliasfile]
- **Text search adapter** - This type of adapter is used to search through text
  search indexes. Returns list of search results. An example of this in JBrowse
  is the trix text search adapter.

:::info

Note When using the refName alias adapter, it's important that the first column
match what is seen in your FASTA file.

:::

### Skeleton of a feature adapter

A basic feature adapter might look like this (with implementation omitted for
simplicity):

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
    //    originalRefName:string the name of the refName from the fasta file, e.g. 1 instead of chr1
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

So to make a feature adapter, you implement the `getRefNames` function
(optional), the `getFeatures` function (returns an rxjs observable stream of
features, discussed below) and `freeResources` (optional).

### Example feature adapter

To take this a little slow, let's look at each function individually.

This is a more complete description of the class interface that you can
implement:

```js
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

class MyAdapter extends BaseFeatureDataAdapter {
  // your constructor gets a config object that you can read with readConfObject
  // if you use "subadapters" then you can initialize those with getSubAdapter
  constructor(config, getSubAdapter) {
    const fileLocation = readConfObject(config, 'fileLocation')
    const subadapter = readConfObject(config, 'sequenceAdapter')
    const sequenceAdapter = getSubAdapter(subadapter)
  }

  // use rxjs observer.next(new SimpleFeature(...your feature data....) for each
  // feature you want to return
  getFeatures(region, options) {
    return ObservableCreate(async observer => {
      try {
        const { refName, start, end } = region
        const response = await fetch(
          'http://myservice/genes/${refName}/${start}-${end}',
          options,
        )
        if (response.ok) {
          const features = await result.json()
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
    // returns the list of refseq names in the file, used for refseq renaming
    // you can hardcode this if you know it ahead of time e.g. for your own
    // remote data API or fetch this from your data file e.g. from the bam header
    return ['chr1', 'chr2', 'chr3'] /// etc
  }

  freeResources(region) {
    // optionally remove cache resources for a region
    // can just be an empty function
  }
}
```

### What is needed from a feature adapter

#### getRefNames

Returns the refNames that are contained in the file. This is used for "refname
renaming" and is optional, but highly useful in scenarios like human chromosomes
which have, for example, chr1 vs 1.

Returning the refNames used by a given file or resource allows JBrowse to
automatically smooth these small naming disparities over. See
[reference renaming](/docs/config_guides/assemblies/#configuring-reference-name-aliasing).

#### getFeatures

A function that returns features from the file given a genomic range query e.g.,

`getFeatures(region, options)`

The region parameter contains:

```typescript
interface Region {
  refName: string
  start: number
  end: number
  originalRefName: string
  assemblyName: string
}
```

The `refName`, `start`, `end` specify a simple genomic range. The `assemblyName`
is used to query a specific assembly if your adapter responds to multiple
assemblies, e.g. for a synteny data file or a REST API that queries a backend
with multiple assemblies.

The `originalRefName` are also passed, where `originalRefName` is the queried
refname before ref renaming e.g. in BamAdapter, if the BAM file uses chr1, and
your reference genome file uses 1, then originalRefName will be 1 and refName
will be chr1.

The options parameter to getFeatures can contain any number of things:

```typescript
interface Options {
  bpPerPx: number
  stopToken?: string
  statusCallback: Function
  headers: Record<string, string>
}
```

- `bpPerPx` - number: resolution of the genome browser when the features were
  fetched
- `stopToken` - can be used to abort a fetch request when it is no longer
  needed, from AbortController
- `statusCallback` - not implemented yet but in the future may allow you to
  report the status of your loading operations
- `headers` - set of HTTP headers as a JSON object
- anything from the `renderProps` of the display model type gets passed to the
  getFeatures opts

We return an rxjs `Observable` from `getFeatures`. This is similar to a JBrowse
1 getFeatures call, where we pass each feature to a `featureCallback`, tell it
when we are done with `finishCallback`, and send errors to `errorCallback`,
except we do all those things with the `Observable`

Here is a "conversion" of JBrowse-1-style `getFeatures` callbacks to JBrowse 2
observable calls

- `featureCallback(new SimpleFeature(...))` ->
  `observer.next(new SimpleFeature(...))`
- `finishCallback()` -> `observer.complete()`
- `errorCallback(error)` -> `observer.error(error)`

#### freeResources

This is uncommonly used, so most adapters make this an empty function

Most adapters in fact use an LRU cache to make resources go away over time
instead of manually cleaning up resources
