/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { getSubAdapterType } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { Instance } from 'mobx-state-tree'
import { Region, FileLocation } from '@gmod/jbrowse-core/util/types'
import { GenericFilehandle } from 'generic-filehandle'
import { tap } from 'rxjs/operators'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@gmod/jbrowse-core/util/QuickLRU'
import MyConfigSchema from './configSchema'

type RowToGeneNames = {
  name1: string
  name2: string
  score: number
}[]

interface GeneNameToRows {
  [key: string]: number[]
}

export default class MCScanAnchorsAdapter extends BaseFeatureDataAdapter {
  private cache = new AbortablePromiseCache({
    cache: new QuickLRU({ maxSize: 1 }),
    fill: (data: BaseOptions, signal?: AbortSignal) => {
      return this.setup({ ...data, signal })
    },
  })

  private initialized = false

  private geneNameToRows: GeneNameToRows = {}

  private rowToGeneName: RowToGeneNames = []

  private subadapters: BaseFeatureDataAdapter[]

  private assemblyNames: string[]

  private mcscanAnchorsLocation: GenericFilehandle

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(
    config: Instance<typeof MyConfigSchema>,
    getSubAdapter: getSubAdapterType,
  ) {
    super(config)
    const subadapters = readConfObject(config, 'subadapters')
    const assemblyNames = readConfObject(config, 'assemblyNames')
    this.mcscanAnchorsLocation = openLocation(
      readConfObject(config, 'mcscanAnchorsLocation') as FileLocation,
    )

    this.subadapters = subadapters.map(
      (subadapter: any) => getSubAdapter(subadapter).dataAdapter,
    )

    this.assemblyNames = assemblyNames
  }

  async setup(opts?: BaseOptions) {
    if (!this.initialized) {
      const text = (await this.mcscanAnchorsLocation.readFile('utf8')) as string
      text.split('\n').forEach((line: string, index: number) => {
        if (line.length && line !== '###') {
          const [name1, name2, score] = line.split('\t')
          if (this.geneNameToRows[name1] === undefined) {
            this.geneNameToRows[name1] = []
          }
          if (this.geneNameToRows[name2] === undefined) {
            this.geneNameToRows[name2] = []
          }
          this.geneNameToRows[name1].push(index)
          this.geneNameToRows[name2].push(index)
          this.rowToGeneName[index] = { name1, name2, score: +score }
        }
      })
      this.initialized = true
    }
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseFeatureDataAdapter filters it out)
    return true
  }

  async getRefNames(opts?: BaseOptions) {
    // we cannot determine this accurately
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      await this.cache.get('initialize', opts, opts.signal)

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = this.assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        const features = this.subadapters[index].getFeatures(region)
        await features
          .pipe(
            tap(feature => {
              // We first fetch from the NCList and connect each result
              // with the anchor file via geneNameToRows. Note that each
              // gene name can correspond to multiple rows
              const rows = this.geneNameToRows[feature.get('name')] || []
              rows.forEach(row => {
                observer.next(
                  new SimpleFeature({
                    ...feature.toJSON(),
                    syntenyId: row,
                  }),
                )
              })
            }),
          )
          .toPromise()
      }

      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}
}
