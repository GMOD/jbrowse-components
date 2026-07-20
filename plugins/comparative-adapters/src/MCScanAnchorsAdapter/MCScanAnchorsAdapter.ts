import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getBlockRefNames, makeBlockFeatures } from '../mcscanUtil.ts'
import { parseBed, readFile } from '../util.ts'

import type { MCScanAnchorsAdapterConfig } from './configSchema.ts'
import type { BlockRow } from '../mcscanUtil.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class MCScanAnchorsAdapter extends BaseFeatureDataAdapter<MCScanAnchorsAdapterConfig> {
  private setupP?: Promise<{
    assemblyNames: string[]
    feats: BlockRow[]
  }>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts: BaseOptions) {
    this.setupP ??= this.setupPre(opts).catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }
  async setupPre(opts: BaseOptions) {
    const { statusCallback = () => {} } = opts
    const assemblyNames = this.getConf('assemblyNames')

    const pm = this.pluginManager
    const bed1 = openLocation(this.getConf('bed1Location'), pm)
    const bed2 = openLocation(this.getConf('bed2Location'), pm)
    const mcscan = openLocation(this.getConf('mcscanAnchorsLocation'), pm)
    const [bed1text, bed2text, mcscantext] = await updateStatus(
      'Downloading data',
      statusCallback,
      () => Promise.all([bed1, bed2, mcscan].map(r => readFile(r, opts))),
    )

    const bed1Map = parseBed(bed1text!)
    const bed2Map = parseBed(bed2text!)
    const feats = mcscantext!
      .split(/\n|\r\n|\r/)
      .filter(f => !!f && f !== '###')
      .map((line, index) => {
        const [name1, name2, score] = line.split('\t')
        const r1 = bed1Map.get(name1!)
        const r2 = bed2Map.get(name2!)
        if (!r1 || !r2) {
          throw new Error(`feature not found, ${name1} ${name2} ${r1} ${r2}`)
        }
        return { a: r1, b: r2, rowNum: index, score: +score! }
      })

    return {
      assemblyNames,
      feats,
    }
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseFeatureDataAdapter filters it out)
    return true
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { feats, assemblyNames } = await this.setup(opts)
    return getBlockRefNames(assemblyNames, feats, opts.assemblyName)
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { assemblyNames, feats } = await this.setup(opts)
      for (const feat of makeBlockFeatures(assemblyNames, feats, region)) {
        observer.next(feat)
      }
      observer.complete()
    })
  }
}
