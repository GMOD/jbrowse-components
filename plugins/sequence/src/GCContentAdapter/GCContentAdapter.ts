import {
  BaseFeatureDataAdapter,
  RegionsAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region, NoAssemblyRegion } from '@jbrowse/core/util/types'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { toArray } from 'rxjs/operators'

import { blankStats, rectifyStats, scoresToStats } from '@jbrowse/plugin-wiggle'

export default class extends BaseFeatureDataAdapter implements RegionsAdapter {
  private sequenceAdapter: BaseFeatureDataAdapter

  private windowSize = 1000

  private windowDelta = 1000

  private gcMode = 'content'

  public static capabilities = ['hasLocalStats']

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
  ) {
    super(config)
    // instantiate the sequence adapter
    const sequenceAdapterType = readConfObject(config, [
      'sequenceAdapter',
      'type',
    ])

    const dataAdapter = getSubAdapter?.(
      readConfObject(config, 'sequenceAdapter'),
    ).dataAdapter
    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      this.sequenceAdapter = dataAdapter
    } else {
      throw new Error(
        `Feature adapters cannot use sequence adapters of type '${sequenceAdapterType}'`,
      )
    }
  }

  public getRefNames() {
    return this.sequenceAdapter.getRefNames()
  }

  public async getRegions(): Promise<NoAssemblyRegion[]> {
    // @ts-ignore
    return this.sequenceAdapter.getRegions()
  }

  // Taken from bigwigadapter
  public getRegionStats(region: Region, opts: BaseOptions) {
    const feats = this.getFeatures(region, opts)
    return scoresToStats(region, feats)
  }

  // Taken from bigwigadapter
  public async getMultiRegionStats(regions: Region[] = [], opts: BaseOptions) {
    if (!regions.length) {
      return blankStats()
    }
    const feats = await Promise.all(
      regions.map(region => this.getRegionStats(region, opts)),
    )

    const scoreMax = feats
      .map(s => s.scoreMax)
      .reduce((acc, curr) => Math.max(acc, curr))
    const scoreMin = feats
      .map(s => s.scoreMin)
      .reduce((acc, curr) => Math.min(acc, curr))
    const scoreSum = feats.map(s => s.scoreSum).reduce((a, b) => a + b, 0)
    const scoreSumSquares = feats
      .map(s => s.scoreSumSquares)
      .reduce((a, b) => a + b, 0)
    const featureCount = feats
      .map(s => s.featureCount)
      .reduce((a, b) => a + b, 0)
    const basesCovered = feats
      .map(s => s.basesCovered)
      .reduce((a, b) => a + b, 0)

    return rectifyStats({
      scoreMin,
      scoreMax,
      featureCount,
      basesCovered,
      scoreSumSquares,
      scoreSum,
    })
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures(query: Region, opts: BaseOptions) {
    this.windowSize = 1000
    this.windowDelta = 1000
    this.gcMode = 'content'
    return ObservableCreate<Feature>(async observer => {
      const hw = this.windowSize === 1 ? 1 : this.windowSize / 2 // Half the window size
      const f = this.windowSize === 1

      let { start: queryStart, end: queryEnd } = query
      queryStart = Math.max(0, queryStart - hw)
      queryEnd += hw

      if (queryEnd < 0 || queryStart > queryEnd) {
        observer.complete()
        return
      }

      const ret = this.sequenceAdapter.getFeatures(
        { ...query, start: queryStart, end: queryEnd },
        opts,
      )
      const [feat] = await ret.pipe(toArray()).toPromise()
      const residues = feat.get('seq')

      for (let i = hw; i < residues.length - hw; i += this.windowDelta) {
        const r = f ? residues[i] : residues.slice(i - hw, i + hw)
        let nc = 0
        let ng = 0
        let len = 0
        for (let j = 0; j < r.length; j++) {
          if (r[j] === 'c' || r[j] === 'C') {
            nc++
          } else if (r[j] === 'g' || r[j] === 'G') {
            ng++
          }
          if (r[j] !== 'N') {
            len++
          }
        }
        const pos = queryStart
        let score
        if (this.gcMode === 'content') {
          score = (ng + nc) / (len || 1)
        } else if (this.gcMode === 'skew') {
          score = (ng - nc) / (ng + nc || 1)
        }

        // if (r[Math.floor(r.length / 2)] !== 'N') {
        observer.next(
          new SimpleFeature({
            uniqueId: `${this.id}_${pos + i}`,
            start: pos + i,
            end: pos + i + this.windowDelta,
            score,
          }),
        )
        // }
      }
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
