import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IRegion, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { toArray } from 'rxjs/operators'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@gmod/jbrowse-core/util/QuickLRU'
import {
  blankStats,
  FeatureStats,
  rectifyStats,
  scoresToStats,
} from '@gmod/jbrowse-plugin-wiggle/src/statsUtil'
import NestedFrequencyTable from '../NestedFrequencyTable'

export interface Mismatch {
  start: number
  length: number
  type: string
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}

interface StatsRegion {
  refName: string
  start: number
  end: number
  bpPerPx?: number
}

function generateInfoList(table: NestedFrequencyTable) {
  const infoList = []
  const overallScore = table.total()

  // log info w/ base name, total score, and strand breakdown
  // eslint-disable-next-line guard-for-in
  for (const base in table.categories) {
    const strands = table.categories[base].categories as {
      [key: string]: number
    }
    const score = Object.values(strands).reduce((a, b) => a + b, 0)
    infoList.push({
      base,
      score,
      strands,
    })
  }

  // sort so higher scores get drawn last, reference always first
  infoList.sort((a, b) =>
    a.score < b.score || b.base === 'reference' ? 1 : -1,
  )

  // add overall total to end
  infoList.push({
    base: 'total',
    score: overallScore,
  })
  return infoList
}

export default class extends BaseAdapter {
  private subadapter: BaseAdapter

  private statsCache: {
    get: (
      key: string,
      region: StatsRegion,
      signal?: AbortSignal,
    ) => Promise<FeatureStats>
  }

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: { subadapter: BaseAdapter }) {
    super()
    const { subadapter } = config
    this.subadapter = subadapter
    this.statsCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: 1000 }),
      fill: async (
        args: {
          refName: string
          assemblyName: string
          start: number
          end: number
          bpPerPx: number
        },
        abortSignal: AbortSignal,
      ): Promise<FeatureStats> => {
        const { refName, start, end, assemblyName, bpPerPx } = args
        const feats = await this.getFeatures(
          { refName, start, end, assemblyName },
          {
            signal: abortSignal,
            basesPerSpan: bpPerPx,
          },
        )
        const scoreFeatures = await feats.pipe(toArray()).toPromise()
        return scoresToStats({ refName, start, end }, scoreFeatures)
      },
    })
  }

  /**
   * @param {INoAssemblyRegion} region
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @returns {Promise<FeatureStats>} see statsUtil.ts
   */
  public getRegionStats(region: INoAssemblyRegion, opts: BaseOptions = {}) {
    const { refName, start, end } = region
    const { bpPerPx, signal } = opts
    return this.statsCache.get(
      `${refName}_${start}_${end}_${bpPerPx}`,
      { refName, start, end, bpPerPx },
      signal,
    )
  }

  /**
   * Calculate region stats such as scoreMax and scoreMin to be used in domain
   * @param {INoAssemblyRegion} regions
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @returns {Promise<FeatureStats>} see statsUtil.ts
   */
  public async getMultiRegionStats(
    regions: INoAssemblyRegion[] = [],
    opts: BaseOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }

    const feats = await Promise.all(
      regions.map(r => this.getRegionStats(r, opts)),
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
   * Fetch features for a certain region. Use coverage bins information to generate
   * SimpleFeature with useful data to be used for stats and canvas drawing
   * @param {any} param
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */

  getFeatures(region: IRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const features = await this.subadapter
        .getFeatures(region, opts)
        .pipe(toArray())
        .toPromise()

      const coverageBins = this.generateCoverageBins(
        features,
        region,
        opts.bpPerPx || 1,
      )
      coverageBins.forEach((bin: NestedFrequencyTable, index: number) => {
        observer.next(
          new SimpleFeature({
            id: `pos_${region.start}${index}`,
            data: {
              score: bin.total(),
              snpinfo: generateInfoList(bin), // info needed to draw snps
              start: region.start + index,
              end: region.start + index + 1,
              refName: region.refName,
            },
          }),
        )
      })

      observer.complete()
    })
  }

  async getRefNames() {
    return this.subadapter.getRefNames()
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}

  /**
   * Generates coverage bins from features which details
   * the reference, mismatches, strands, and coverage info
   * @param {Observable<Feature>} features features of region to be passed in
   * @param {StatsRegion} region
   * @param {Number} bpPerPx base pairs per pixel
   * @returns {Array<NestedFrequencyTable>}
   */
  generateCoverageBins(
    features: Feature[],
    region: StatsRegion,
    bpPerPx: number,
  ): NestedFrequencyTable[] {
    const leftBase = region.start
    const rightBase = region.end
    const scale = 1 / bpPerPx
    const binWidth = bpPerPx <= 10 ? 1 : Math.ceil(scale)
    const binMax = Math.ceil((rightBase - leftBase) / binWidth)

    const coverageBins = new Array(binMax).fill(0)

    for (let i = 0; i < binMax; i++) {
      coverageBins[i] = new NestedFrequencyTable()
      if (binWidth === 1) {
        coverageBins[i].snpsCounted = true
      }
    }

    const forEachBin = function forEachBin(
      start: number,
      end: number,
      callback: (bin: number, overlap: number) => void,
    ) {
      let s = (start - leftBase) / binWidth
      let e = (end - 1 - leftBase) / binWidth
      let sb = Math.floor(s)
      let eb = Math.floor(e)

      if (sb >= binMax || eb < 0) return // does not overlap this block

      // enforce 0 <= bin < binMax
      if (sb < 0) {
        s = 0
        sb = 0
      }
      if (eb >= binMax) {
        eb = binMax - 1
        e = binMax
      }
      // now iterate
      if (sb === eb) {
        // if in the same bin, just one call
        callback(sb, e - s)
      } else {
        // if in different bins, two or more calls
        callback(sb, sb + 1 - s)
        for (let i = sb + 1; i < eb; i++) {
          callback(i, 1)
        }
        callback(eb, e - eb)
      }
    }

    function getStrand(feature: Feature) {
      const result = feature.get('strand')
      let strand = ''
      switch (result) {
        case -1:
          strand = '-'
          break
        case 1:
          strand = '+'
          break
        default:
          strand = 'unstranded'
          break
      }
      return strand
    }

    for (const feature of features.values()) {
      const strand = getStrand(feature)
      const start = feature.get('start')
      const end = feature.get('end')
      // increment start and end partial-overlap bins by proportion of overlap
      forEachBin(start, end, (bin, overlap) => {
        coverageBins[bin].getNested('reference').increment(strand, overlap)
      })

      // Calculate SNP coverage
      if (binWidth === 1) {
        const mismatches: Mismatch[] = feature.get('mismatches')
        // bpPerPx < 10 ? feature.get('mismatches') : feature.get('skips_and_dels')

        // loops through mismatches and updates coverage variables accordingly.
        if (mismatches) {
          for (let i = 0; i < mismatches.length; i++) {
            const mismatch = mismatches[i]
            forEachBin(
              start + mismatch.start,
              start + mismatch.start + mismatch.length,
              (binNum, overlap) => {
                // Note: we decrement 'reference' so that total of the score is the total coverage
                const bin = coverageBins[binNum]
                bin.getNested('reference').decrement(strand, overlap)
                let { base } = mismatch

                if (mismatch.type === 'insertion') {
                  base = `ins ${base}`
                } else if (mismatch.type === 'skip') {
                  base = 'skip'
                }

                if (base && base !== '*') {
                  bin.getNested(base).increment(strand, overlap)
                }
              },
            )
          }
        }
      }
    }
    return coverageBins
  }
}
