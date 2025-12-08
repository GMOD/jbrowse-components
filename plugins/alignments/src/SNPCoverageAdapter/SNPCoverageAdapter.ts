import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { fetchSequence } from '../util'
import { generateCoverageBins } from './generateCoverageBins'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  private sequenceAdapterP?: Promise<BaseSequenceAdapter>

  protected async configure() {
    const subadapterConfig = this.getConf('subadapter')
    const dataAdapter = await this.getSubAdapter?.(subadapterConfig)

    if (!dataAdapter) {
      throw new Error('Failed to get subadapter')
    }

    return {
      subadapter: dataAdapter.dataAdapter as BaseFeatureDataAdapter,
    }
  }

  async getSequenceAdapter(sequenceAdapterConfig?: AnyConfigurationModel) {
    if (!sequenceAdapterConfig || !this.getSubAdapter) {
      return undefined
    }
    if (!this.sequenceAdapterP) {
      this.sequenceAdapterP = this.getSubAdapter(sequenceAdapterConfig).then(
        r => r.dataAdapter as BaseSequenceAdapter,
      )
    }
    return this.sequenceAdapterP
  }

  getFeatures(
    region: Region,
    opts: BaseOptions & { sequenceAdapter?: AnyConfigurationModel } = {},
  ) {
    return ObservableCreate<Feature>(async observer => {
      const { subadapter } = await this.configure()
      const { sequenceAdapter: sequenceAdapterConfig, ...rest } = opts
      const sequenceAdapter = await this.getSequenceAdapter(
        sequenceAdapterConfig,
      )

      // Pass sequenceAdapter through to subadapter (BAM/CRAM)
      const features = await firstValueFrom(
        subadapter.getFeatures(region, opts).pipe(toArray()),
      )

      const { bins, skipmap } = await generateCoverageBins({
        features,
        region,
        opts: rest,
        fetchSequence: sequenceAdapter
          ? (region: Region) => fetchSequence(region, sequenceAdapter)
          : undefined,
      })

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
              refName: region.refName,
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
