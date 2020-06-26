import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { Region } from '@gmod/jbrowse-core/util/types'
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
import { Instance, getSnapshot } from 'mobx-state-tree'
import { getSubAdapterType } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import NestedFrequencyTable from '../NestedFrequencyTable'

import MyConfigSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  const MyConfigSchema = MyConfigSchemaF(pluginManager)

  interface Mismatch {
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

  return class SNPCoverageAdapter extends BaseFeatureDataAdapter {
    private subadapter: BaseFeatureDataAdapter

    private statsCache = new AbortablePromiseCache({
      cache: new QuickLRU({ maxSize: 1000 }),
      fill: async (
        args: {
          region: Region
          bpPerPx: number
        },
        abortSignal?: AbortSignal,
      ): Promise<FeatureStats> => {
        const { region, bpPerPx } = args
        const feats = this.getFeatures(region, {
          signal: abortSignal,
          basesPerSpan: bpPerPx,
        })
        return scoresToStats(region, feats)
      },
    })

    public constructor(
      config: Instance<typeof MyConfigSchema>,
      getSubAdapter: getSubAdapterType,
    ) {
      super(config)

      const { dataAdapter } = getSubAdapter(getSnapshot(config.subadapter))

      if (dataAdapter instanceof BaseFeatureDataAdapter) {
        this.subadapter = dataAdapter
      } else {
        throw new Error(`invalid subadapter type '${config.subadapter.type}'`)
      }
    }

    public getRegionStats(region: Region, opts: BaseOptions = {}) {
      const { refName, start, end } = region
      const { bpPerPx, signal } = opts
      return this.statsCache.get(
        `${refName}_${start}_${end}_${bpPerPx}`,
        { region, bpPerPx: bpPerPx || 0 },
        signal,
      )
    }

    public async getMultiRegionStats(
      regions: Region[] = [],
      opts: BaseOptions = {},
    ) {
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

    getFeatures(region: Region, opts: BaseOptions = {}) {
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
        coverageBins.forEach((bin, index) => {
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
      }, opts.signal)
    }

    async getRefNames() {
      return this.subadapter.getRefNames()
    }

    freeResources(/* { region } */): void {}

    /**
     * Generates coverage bins from features which details
     * the reference, mismatches, strands, and coverage info
     * @param features - Features of region to be passed in
     * @param region - Region
     * @param bpPerPx - base pairs per pixel
     * @returns Array of nested frequency tables
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
}
