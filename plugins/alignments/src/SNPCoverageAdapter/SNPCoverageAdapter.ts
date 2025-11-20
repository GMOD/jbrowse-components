import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { fetchSequence } from '../util'
import { generateCoverageBins } from './generateCoverageBins'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  protected async configure() {
    const subadapterConfig = this.getConf('subadapter')
    const sequenceConf = subadapterConfig.sequenceAdapter
    const dataAdapter = await this.getSubAdapter?.(subadapterConfig)

    const sequenceAdapter = sequenceConf
      ? await this.getSubAdapter?.(sequenceConf)
      : undefined

    if (!dataAdapter) {
      throw new Error('Failed to get subadapter')
    }

    return {
      subadapter: dataAdapter.dataAdapter as BaseFeatureDataAdapter,
      sequenceAdapter: sequenceAdapter?.dataAdapter as
        | BaseFeatureDataAdapter
        | undefined,
    }
  }

  async fetchSequence(region: Region) {
    const { sequenceAdapter } = await this.configure()
    if (!sequenceAdapter) {
      return undefined
    }
    return fetchSequence(region, sequenceAdapter)
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const t0 = performance.now()
      const { subadapter } = await this.configure()
      const t1 = performance.now()
      const features = await firstValueFrom(
        subadapter.getFeatures(region, opts).pipe(toArray()),
      )
      const t2 = performance.now()
      console.log(`[PERF] BAM/CRAM fetch: ${(t2 - t1).toFixed(2)}ms for ${features.length} features in region ${region.refName}:${region.start}-${region.end}`)

      const { bins, skipmap } = await generateCoverageBins({
        features,
        region,
        opts,
        fetchSequence: (region: Region) => this.fetchSequence(region),
      })
      const t3 = performance.now()
      console.log(`[PERF] TOTAL SNPCoverageAdapter.getFeatures: ${(t3 - t0).toFixed(2)}ms`)

      let index = 0
      for (const bin of bins) {
        // bins is a holey array
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (bin) {
          const start = region.start + index
          observer.next(
            new SimpleFeature({
              id: `${this.id}-${start}`,
              data: {
                score: bin.depth,
                snpinfo: bin,
                start,
                end: start + 1,
                refName: region.refName,
              },
            }),
          )
        }
        index++
      }

      // make fake features from the coverage
      for (const [key, skip] of Object.entries(skipmap)) {
        observer.next(
          new SimpleFeature({
            id: key,
            data: {
              type: 'skip',
              start: skip.start,
              end: skip.end,
              strand: skip.strand,
              score: skip.score,
              effectiveStrand: skip.effectiveStrand,
            },
          }),
        )
      }

      observer.complete()
    }, opts.stopToken)
  }

  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const { subadapter } = await this.configure()
    return subadapter.getMultiRegionFeatureDensityStats(regions, opts)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { subadapter } = await this.configure()
    return subadapter.getRefNames(opts)
  }
}
