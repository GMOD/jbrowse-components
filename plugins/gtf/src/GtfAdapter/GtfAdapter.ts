import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { readConfObject } from '@jbrowse/core/configuration'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import IntervalTree from '@flatten-js/interval-tree'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { unzip } from '@gmod/bgzf-filehandle'

import gtf from '@gmod/gtf'
import { FeatureLoc, featureData } from '../util'
function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class extends BaseFeatureDataAdapter {
  protected gtfFeatures?: Promise<{
    intervalTree: Record<string, IntervalTree>
  }>

  private async loadDataP() {
    const buffer = await openLocation(
      readConfObject(this.config, 'gtfLocation'),
      this.pluginManager,
    ).readFile()

    const buf = isGzip(buffer as Buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const data = new TextDecoder('utf8', { fatal: true }).decode(buf)
    const feats = gtf.parseStringSync(data, {
      parseFeatures: true,
      parseComments: false,
      parseDirectives: false,
      parseSequences: false,
    }) as FeatureLoc[][]

    const intervalTree = feats
      .flat()
      .map(
        (f, i) =>
          new SimpleFeature({
            data: featureData(f),
            id: `${this.id}-offset-${i}`,
          }),
      )
      .reduce((acc, obj) => {
        const key = obj.get('refName')
        if (!acc[key]) {
          acc[key] = new IntervalTree()
        }
        acc[key].insert([obj.get('start'), obj.get('end')], obj)
        return acc
      }, {} as Record<string, IntervalTree>)
    return { intervalTree }
  }

  private async loadData() {
    if (!this.gtfFeatures) {
      this.gtfFeatures = this.loadDataP().catch(e => {
        this.gtfFeatures = undefined
        throw e
      })
    }

    return this.gtfFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTree } = await this.loadData()
    return Object.keys(intervalTree)
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const { intervalTree } = await this.loadData()
        intervalTree[refName]
          ?.search([start, end])
          .forEach(f => observer.next(f))
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }
  public freeResources(/* { region } */) {}
}
