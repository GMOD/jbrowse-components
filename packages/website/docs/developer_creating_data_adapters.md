---
id: developer_creating_data_adapters
title: Creating a new data adapter
---

## Creating a custom data adapter

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
import {
  BaseFeatureDataAdapter,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { readConfObject } from '@gmod/jbrowse-core/configuration'

class MyAdapter extends BaseFeatureDataAdapter {
    // @param config - a configuration object
    // @param getSubAdapter - function to initialize additional subadapters
    constructor(config, getSubAdapter) {
      // use readConfObject to read slots from the config
      const fileLocation = readConfObject(config, 'fileLocation')

      // use getSubAdapter to initialize additional data adapters if needed
      const subadapter = readConfObject(config, 'sequenceAdapter')
      const sequenceAdapter = getSubAdapter(subadapter)
    }


    // @param region - { refName:string, start:number, end:number}
    // @param options - { signal: AbortSignal, bpPerPx: number }
    getFeatures(region, options) {
      // instead of feature callback, we use rxjs observables. the main
      // idea is that we call observer.next(data) for each feature we want
      // to return. when we are done returning data for the region, we
      // call observer.complete()
      return new Observable<Feature>(async observer => {

        const myapi = await fetch('http://myservive/genes/${refName}/${start}-${end}')
        const features = await result.json()
        features.forEach(feature => {
          // call observer.next for each feature, using the SimpleFeature
          // wrapper, which expects that we can call e.g. feature.get('start')
          observer.next(
            new SimpleFeature({
              uniqueID: 'val',
              refName: 'chr1',
              start: 0,
              end: 100
            })
          )
        })



        // make sure to call observer.complete() when you have returned all
        // features using observer.next
        observer.complete()
      })
    }

    async getRefNames() {
        // returns the list of refseq names in the file, used for refseq renaming
        // you can hardcode this if you know it ahead of time e.g. for your own
        // remote data API or fetch this from your data file e.g. from the bam header
        return ['chr1','chr2','chr3',...]
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
like human chromosomes which have, for example, chr1 vs 1. Returning the
refnames used in the file allows us to automatically smooth this over

#### getFeatures

A function that returns features from the file given a genomic
range query e.g. getFeatures(region, options), where region is an object like
`{ refName:string, start:number,end:number }`

#### freeResources

This is uncommonly used, so most data adapters make this an empty function

Most data adapters in fact use an LRU cache to make resources go away over time
instead of manually cleaning up resources
