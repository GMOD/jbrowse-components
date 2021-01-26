import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { toArray, filter } from 'rxjs/operators'
import { getSnapshot } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import PluginManager from '@jbrowse/core/PluginManager'
import NestedFrequencyTable from '../NestedFrequencyTable'

interface Mismatch {
  start: number
  length: number
  type: string
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}

export interface StatsRegion {
  refName: string
  start: number
  end: number
  bpPerPx?: number
}

function generateInfoList(table: NestedFrequencyTable) {
  const infoList = Object.entries(table.categories).map(([base, strand]) => {
    const strands = strand.categories as {
      [key: string]: number
    }
    const score = Object.values(strands).reduce((a, b) => a + b, 0)
    return {
      base,
      score,
      strands,
    }
  })

  // sort so higher scores get drawn last, reference always first
  infoList.sort((a, b) =>
    a.score < b.score || b.base === 'reference' ? 1 : -1,
  )

  return [...infoList, { base: 'total', score: table.total() }]
}
export default (_: PluginManager) => {
  return class SNPCoverageAdapter extends BaseFeatureDataAdapter {
    private subadapter: BaseFeatureDataAdapter

    public constructor(
      config: AnyConfigurationModel,
      getSubAdapter?: getSubAdapterType,
    ) {
      super(config)

      const dataAdapter = getSubAdapter?.(getSnapshot(config.subadapter))
        .dataAdapter

      if (dataAdapter instanceof BaseFeatureDataAdapter) {
        this.subadapter = dataAdapter
      } else {
        throw new Error(`invalid subadapter type '${config.subadapter.type}'`)
      }
    }

    getFeatures(region: Region, opts: BaseOptions = {}) {
      return ObservableCreate<Feature>(async observer => {
        const features = await this.subadapter
          .getFeatures(region, opts)
          .pipe(
            filter(feature => {
              // @ts-ignore
              return opts.filters ? opts.filters.passes(feature, opts) : true
            }),
          )
          .pipe(toArray())
          .toPromise()

        const coverageBins = this.generateCoverageBins(
          features,
          region,
          opts.bpPerPx || 1,
        )

        // avoid having the softclip and hardclip count towards score
        const score = (bin: NestedFrequencyTable) =>
          bin.total() -
          (bin.categories.softclip?.total() || 0) -
          (bin.categories.hardclip?.total() || 0) -
          (bin.categories.deletion?.total() || 0)

        coverageBins.forEach((bin, index) => {
          if (bin.total()) {
            observer.next(
              new SimpleFeature({
                id: `${this.id}-${region.start}-${index}`,
                data: {
                  score: score(bin),
                  snpinfo: generateInfoList(bin),
                  start: region.start + index,
                  end: region.start + index + 1,
                  refName: region.refName,
                },
              }),
            )
          }
        })

        observer.complete()
      }, opts.signal)
    }

    async getRefNames(opts: BaseOptions = {}) {
      return this.subadapter.getRefNames(opts)
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

      const forEachBin = (
        start: number,
        end: number,
        callback: (bin: number, overlap: number) => void,
      ) => {
        let s = (start - leftBase) / binWidth
        let e = (end - 1 - leftBase) / binWidth
        let sb = Math.floor(s)
        let eb = Math.floor(e)

        if (sb >= binMax || eb < 0) {
          // does not overlap this block
          return
        }

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

        // increment start and end partial-overlap bins by proportion of
        // overlap
        forEachBin(start, end, (bin, overlap) => {
          coverageBins[bin].getNested('reference').increment(strand, overlap)
        })

        // Calculate SNP coverage
        if (binWidth === 1) {
          const mismatches: Mismatch[] = feature.get('mismatches')

          // loops through mismatches and updates coverage variables
          // accordingly.
          if (mismatches) {
            for (let i = 0; i < mismatches.length; i++) {
              const mismatch = mismatches[i]
              const len = (base: Mismatch) => {
                return base.type !== 'insertion' &&
                  base.type !== 'softclip' &&
                  base.type !== 'hardclip'
                  ? base.length
                  : 1
              }

              forEachBin(
                start + mismatch.start,
                start + mismatch.start + len(mismatch),
                (binNum, overlap) => {
                  // Note: we decrement 'reference' so that total of the score
                  // is the total coverage
                  const bin = coverageBins[binNum]
                  if (
                    mismatch.type !== 'softclip' &&
                    mismatch.type !== 'hardclip'
                  ) {
                    bin.getNested('reference').decrement(strand, overlap)
                  }

                  let { base } = mismatch

                  if (mismatch.type === 'insertion') {
                    base = `insertion`
                  } else if (mismatch.type === 'skip') {
                    base = 'skip'
                  } else if (mismatch.type === 'softclip') {
                    base = 'softclip'
                  } else if (mismatch.type === 'hardclip') {
                    base = 'hardclip'
                  } else if (mismatch.type === 'deletion') {
                    base = 'deletion'
                  }

                  if (base === 'skip') {
                    bin.getNested(base).decrement('reference', overlap)
                  }

                  if (base && base !== '*' && base !== 'skip') {
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
