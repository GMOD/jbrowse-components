import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
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
    feats: { [key: string]: string[] }
  }>

  protected intervalTrees: {
    [key: string]: Promise<IntervalTree | undefined> | undefined
  } = {}

  private async loadDataP(opts: BaseOptions = {}) {
    const gtfLoc = this.getConf('gtfLocation')
    const buffer = await openLocation(gtfLoc, this.pluginManager).readFile(opts)

    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const data = new TextDecoder('utf8', { fatal: true }).decode(buf)

    const lines = data
      .split(/\n|\r\n|\r/)
      .filter(f => !!f && !f.startsWith('#'))
    const feats = {} as { [key: string]: string[] }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('#')) {
        continue
      }
      const tab = line.indexOf('\t')
      const refName = line.slice(0, tab)
      if (!feats[refName]) {
        feats[refName] = []
      }
      feats[refName].push(lines[i])
    }

    return { feats }
  }

  private async loadData(opts: BaseOptions = {}) {
    if (!this.gtfFeatures) {
      this.gtfFeatures = this.loadDataP(opts).catch(e => {
        this.gtfFeatures = undefined
        throw e
      })
    }

    return this.gtfFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { feats } = await this.loadData(opts)
    return Object.keys(feats)
  }

  private async loadFeatureIntervalTreeHelper(refName: string) {
    const { feats } = await this.loadData()
    const lines = feats[refName]
    if (!lines) {
      return undefined
    }
    const data = gtf.parseStringSync(lines.join('\n'), {
      parseFeatures: true,
      parseComments: false,
      parseDirectives: false,
      parseSequences: false,
    }) as FeatureLoc[][]

    const intervalTree = new IntervalTree()
    const ret = data.flat().map(
      (f, i) =>
        new SimpleFeature({
          data: featureData(f),
          id: `${this.id}-${refName}-${i}`,
        }),
    )

    for (let i = 0; i < ret.length; i++) {
      const obj = ret[i]
      intervalTree.insert([obj.get('start'), obj.get('end')], obj)
    }
    return intervalTree
  }

  private async loadFeatureIntervalTree(refName: string) {
    if (!this.intervalTrees[refName]) {
      this.intervalTrees[refName] = this.loadFeatureIntervalTreeHelper(
        refName,
      ).catch(e => {
        this.intervalTrees[refName] = undefined
        throw e
      })
    }
    return this.intervalTrees[refName]
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const intervalTree = await this.loadFeatureIntervalTree(refName)
        intervalTree?.search([start, end]).forEach(f => observer.next(f))
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }
  public freeResources(/* { region } */) {}
}
