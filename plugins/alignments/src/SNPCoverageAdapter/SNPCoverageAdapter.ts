import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { fetchSequence } from '../util'
import { generateCoverageBinsPrefixSum } from './generateCoverageBinsPrefixSum'

import type { FeatureWithMismatchIterator } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  private sequenceAdapterP?: Promise<BaseSequenceAdapter | undefined>

  protected async configure() {
    const subadapterConfigBase = this.getConf('subadapter')
    const sequenceAdapter = this.getConf('sequenceAdapter')

    // console.log(
    //   '[SNPCoverageAdapter.configure] subadapterConfigBase.type:',
    //   subadapterConfigBase?.type,
    //   'sequenceAdapter:',
    //   !!sequenceAdapter,
    // )

    // Use the base subadapter config to ensure consistent cache keys
    // Set sequenceAdapterConfig on the subadapter after creation
    const dataAdapter = await this.getSubAdapter?.(subadapterConfigBase)

    if (!dataAdapter) {
      throw new Error('Failed to get subadapter')
    }

    const subadapter = dataAdapter.dataAdapter as BaseFeatureDataAdapter

    // Set sequenceAdapterConfig on the subadapter for BAM/CRAM adapters
    // that need it for reference sequence fetching
    if (sequenceAdapter) {
      const adapter = subadapter as { sequenceAdapterConfig?: unknown }
      if (adapter.sequenceAdapterConfig === undefined) {
        adapter.sequenceAdapterConfig = sequenceAdapter
      }
    }

    return { subadapter }
  }

  async getSequenceAdapter() {
    const config = this.getConf('sequenceAdapter')
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    this.sequenceAdapterP ??= this.getSubAdapter(config)
      .then(r => {
        const adapter = r.dataAdapter as BaseSequenceAdapter
        // verify adapter has getSequence method (e.g. ChromSizesAdapter doesn't)
        return 'getSequence' in adapter ? adapter : undefined
      })
      .catch((e: unknown) => {
        this.sequenceAdapterP = undefined
        throw e
      })
    return this.sequenceAdapterP
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { subadapter } = await this.configure()
      const sequenceAdapter = await this.getSequenceAdapter()

      const features = await firstValueFrom(
        subadapter.getFeatures(region, opts).pipe(toArray()),
      )

      const { bins, skipmap } = await generateCoverageBinsPrefixSum({
        features: features as FeatureWithMismatchIterator[],
        region,
        opts,
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
