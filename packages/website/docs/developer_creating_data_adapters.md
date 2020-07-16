---
id: developer_creating_data_adapters
title: Creating a new data adapter
---

### What is a data adapter

A data adapter is essentially a class that parses your data type and returns
features that jbrowse will draw

Sometimes, a data adapter can be implemented by itself, e.g. if you are
adapting a storeclass that returns genes, then you can use our standard track
types for that. If you are making a data adapter for some custom type of data
that also needs a custom type of drawing, you may need to implement a data
adapter along with a track type and/or renderer

### Skeleton of a data adapter

So we see basically something like this, this is stripped down for simplicity

```js
class MyAdapter extends BaseFeatureDataAdapter {
  constructor(config) {
    // config
  }
  async getRefNames() {
    // return ref names used in your data adapter, used for refname renaming
  }
  getFeatures(region) {
    // return features from your data adapter, using rxjs observable
  }
  freeResources(region) {
    // can be empty
  }
}
```

So to make a data adapter, you implement the getRefNames function (optional),
the getFeatures function (returns an rxjs observable stream of features,
discussed below) and freeResources (optional)

### Example data adapter

To take this a little slow let's look at each function individually

This is a more complete description of the class interface that you can implement

```js
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'

class MyAdapter extends BaseFeatureDataAdapter {
  // @param config - a configuration object
  // @param getSubAdapter - function to initialize additional subadapters
  constructor(config, getSubAdapter) {
    const fileLocation = readConfObject(config, 'fileLocation')
    const subadapter = readConfObject(config, 'sequenceAdapter')
    const sequenceAdapter = getSubAdapter(subadapter)
  }

  // @param region - { refName:string, start:number, end:number}
  // @param options - { signal: AbortSignal, bpPerPx: number }
  // @return an rxjs Observable
  getFeatures(region, options) {
    return ObservableCreate(async observer => {
      try {
        const myapi = await fetch(
          'http://myservice/genes/${refName}/${start}-${end}',
        )
        if (result.ok) const features = await result.json()
        features.forEach(feature => {
          observer.next(
            new SimpleFeature({
              uniqueID: `${feature.chr}-${feature.start}-${feature.end}`,
              refName: feature.chr,
              start: feature.start,
              end: feature.end,
            }),
          )
        })
        observer.complete()
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

### What is needed from a data adapter

#### getRefNames

Returns the refNames that are contained in the file, this is
used for "refname renaming" and is optional but highly useful in scenarios
like human chromosomes which have, for example, chr1 vs 1.

Returning the refNames used by a given file or resource allows JBrowse to
automatically smooth these small naming disparities over. See [reference
renaming](developer_refrenaming)

#### getFeatures

A function that returns features from the file given a genomic
range query e.g. getFeatures(region, options), where region is an object like

The region contains

```typescript
interface Region {
  refName: string
  start: number
  end: number
  originalRefName: string
  assemblyName: string
}
```

The options can contain any number of things

```typescript
interface Options {
  bpPerPx: number
  signal: AbortSignal
  statusCallback: Function
  headers: Record<string, string>
}
```

- bpPerPx - number: resolution of the genome browser when the features were
  fetched
- signal - can be used to abort a fetch request when it is no longer needed,
  from AbortController
- statusCallback - not implemented yet but in the future may allow you to
  report the status of your loading operations
- headers - set of HTTP headers as a JSON object

We return an rxjs Observable. This is similar to a JBrowse 1 getFeatures call,
where we pass each feature to a featureCallback, tell it when we are done with
finishCallback, and send errors to errorCallback, except we do all those things
with the Observable

Here is a "conversion" of JBrowse 1 getFeatures callbacks to JBrowse 2
observable calls

- `featureCallback(new SimpleFeature(...))` -> `observer.next(new SimpleFeature(...))`
- `finishCallback()` -> `observer.complete()`
- `errorCallback(error)` -> `observer.error(error)`

#### freeResources

This is uncommonly used, so most data adapters make this an empty function

Most data adapters in fact use an LRU cache to make resources go away over time
instead of manually cleaning up resources
