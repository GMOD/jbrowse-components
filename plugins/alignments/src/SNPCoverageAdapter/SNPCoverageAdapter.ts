import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

// locals
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
      const { subadapter } = await this.configure()
      const features = await firstValueFrom(
        subadapter.getFeatures(region, opts).pipe(toArray()),
      )

      const { bins, skipmap } = await generateCoverageBins({
        features,
        region,
        opts,
        fetchSequence: (region: Region) => this.fetchSequence(region),
      })

      bins.forEach((bin, index) => {
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
      })

      // make fake features from the coverage
      Object.entries(skipmap).forEach(([key, skip]) => {
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
      })

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

  freeResources(/* { region } */): void {}
}
