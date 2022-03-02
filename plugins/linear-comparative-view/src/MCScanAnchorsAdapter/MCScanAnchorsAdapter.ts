import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { GenericFilehandle } from 'generic-filehandle'
import { Region } from '@jbrowse/core/util/types'
import { tap } from 'rxjs/operators'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { unzip } from '@gmod/bgzf-filehandle'

type RowToGeneNames = {
  name1: string
  name2: string
  score: number
}[]

interface GeneNameToRows {
  [key: string]: number[]
}

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class MCScanAnchorsAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<{
    assemblyNames: string[]
    subadapters: BaseFeatureDataAdapter[]
    mcscanAnchorsLocation: GenericFilehandle
  }>

  private geneNameToRows: GeneNameToRows = {}

  private rowToGeneName: RowToGeneNames = []

  public static capabilities = ['getFeatures', 'getRefNames']

  public async configure(_opts: BaseOptions) {
    const getSubAdapter = this.getSubAdapter
    if (!getSubAdapter) {
      throw new Error('Need support for getSubAdapter')
    }
    const assemblyNames = this.getConf('assemblyNames') as string[]
    const mcscanAnchorsLocation = openLocation(
      this.getConf('mcscanAnchorsLocation'),
      this.pluginManager,
    )

    const confs = this.getConf('subadapters') as AnyConfigurationModel[]
    const subadapters = await Promise.all(
      confs.map(async subadapter => {
        const res = await getSubAdapter(subadapter)
        if (res.dataAdapter instanceof BaseFeatureDataAdapter) {
          return res.dataAdapter
        }
        throw new Error(
          `invalid subadapter type '${this.config.subadapter.type}'`,
        )
      }),
    )

    return { assemblyNames, subadapters, mcscanAnchorsLocation }
  }

  async setup(opts: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch(e => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }
  async setupPre(opts: BaseOptions) {
    const conf = await this.configure(opts)

    const buffer = await conf.mcscanAnchorsLocation.readFile(opts)
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    new TextDecoder('utf8', { fatal: true })
      .decode(buf)
      .split('\n')
      .filter(f => !!f && f !== '###')
      .forEach((line: string, index: number) => {
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
      })

    return conf
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
      const { subadapters, assemblyNames } = await this.setup(opts)

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        await subadapters[index]
          .getFeatures(region, opts)
          .pipe(
            tap(feature => {
              ;[...feature.get('subfeatures'), feature].map(f => {
                // We first fetch from the NCList and connect each result with
                // the anchor file via geneNameToRows. Note that each gene name
                // can correspond to multiple rows
                this.geneNameToRows[f.get('name')]?.forEach(row => {
                  observer.next(
                    new SimpleFeature({
                      ...feature.toJSON(),
                      syntenyId: row,
                    }),
                  )
                })
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
