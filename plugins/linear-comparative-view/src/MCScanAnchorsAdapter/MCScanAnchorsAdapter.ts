import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { GenericFilehandle } from 'generic-filehandle'
import { tap } from 'rxjs/operators'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

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
    fill: () => this.setup(),
  })

  private initialized = false

  private geneNameToRows: GeneNameToRows = {}

  private rowToGeneName: RowToGeneNames = []

  // @ts-ignore
  private subadapters: BaseFeatureDataAdapter[]

  // @ts-ignore
  private assemblyNames: string[]

  // @ts-ignore
  private mcscanAnchorsLocation: GenericFilehandle

  public static capabilities = ['getFeatures', 'getRefNames']

  public async configure() {
    const getSubAdapter = this.getSubAdapter
    if (!getSubAdapter) {
      throw new Error('Need support for getSubAdapter')
    }
    const subadapters = readConfObject(
      this.config,
      'subadapters',
    ) as AnyConfigurationModel[]
    const assemblyNames = readConfObject(this.config, 'assemblyNames')
    this.mcscanAnchorsLocation = openLocation(
      readConfObject(this.config, 'mcscanAnchorsLocation'),
      this.pluginManager,
    )

    this.subadapters = await Promise.all(
      subadapters.map(async subadapter => {
        const res = await getSubAdapter(subadapter)
        if (res.dataAdapter instanceof BaseFeatureDataAdapter) {
          return res.dataAdapter
        }
        throw new Error(
          `invalid subadapter type '${this.config.subadapter.type}'`,
        )
      }),
    )

    this.assemblyNames = assemblyNames
  }

  async setup() {
    if (!this.initialized) {
      await this.configure()
      const text = await this.mcscanAnchorsLocation.readFile('utf8')
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

  async getRefNames() {
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
