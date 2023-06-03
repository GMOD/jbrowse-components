import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'

// locals
import generateCoverageBins from './generateCoverageBins'
import { fetchSequence } from '../util'

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
      const feats = await firstValueFrom(
        subadapter.getFeatures(region, opts).pipe(toArray()),
      )

      const { bins, skipmap } = await generateCoverageBins(
        feats,
        region,
        opts,
        arg => this.fetchSequence(arg),
      )

      bins.forEach((bin, index) => {
        const start = region.start + index
        observer.next(
          new SimpleFeature({
            id: `${this.id}-${start}`,
            data: {
              score: bin.total,
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
              xs: skip.xs,
            },
          }),
        )
      })

      observer.complete()
    }, opts.signal)
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
