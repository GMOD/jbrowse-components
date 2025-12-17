import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { fetchSequence } from '../util'
import {
  type CoverageBinsSoA,
  generateCoverageBinsPrefixSum,
} from './generateCoverageBinsPrefixSum'

import type { FeatureWithMismatchIterator } from '../shared/types'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  private sequenceAdapterP?: Promise<BaseSequenceAdapter | undefined>

  private subadapterRef?: BaseFeatureDataAdapter

  /**
   * Override to propagate sequenceAdapterConfig to the subadapter
   */
  setSequenceAdapterConfig(config: Record<string, unknown>) {
    super.setSequenceAdapterConfig(config)
    // Propagate to subadapter if it exists
    if (this.subadapterRef) {
      this.subadapterRef.setSequenceAdapterConfig(config)
    }
  }

  protected async configure() {
    const subadapterConfigBase = this.getConf('subadapter')

    // Initialize from config if not set externally via setSequenceAdapterConfig
    this.sequenceAdapterConfig ??= this.getConf('sequenceAdapter')

    // Use the base subadapter config to ensure consistent cache keys
    const dataAdapter = await this.getSubAdapter?.(subadapterConfigBase)

    if (!dataAdapter) {
      throw new Error('Failed to get subadapter')
    }

    const subadapter = dataAdapter.dataAdapter as BaseFeatureDataAdapter
    this.subadapterRef = subadapter

    // Propagate sequenceAdapterConfig to the subadapter
    if (this.sequenceAdapterConfig) {
      subadapter.setSequenceAdapterConfig(this.sequenceAdapterConfig)
    }

    return { subadapter }
  }

  async getSequenceAdapter() {
    const config = this.sequenceAdapterConfig ?? this.getConf('sequenceAdapter')
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
      const { starts, ends, scores, snpinfo, skipmap } =
        await this.getFeaturesAsArrays(region, opts)

      // Emit coverage features
      for (const [i, start_] of starts.entries()) {
        const start = start_
        observer.next(
          new SimpleFeature({
            id: `${this.id}-${start}`,
            data: {
              score: scores[i],
              snpinfo: snpinfo[i],
              start,
              end: ends[i],
              refName: region.refName,
            },
          }),
        )
      }

      // Emit skip features for arc rendering
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

  async getFeaturesAsArrays(
    region: Region,
    opts: BaseOptions = {},
  ): Promise<CoverageBinsSoA> {
    const { subadapter } = await this.configure()
    const sequenceAdapter = await this.getSequenceAdapter()

    const features = await firstValueFrom(
      subadapter.getFeatures(region, opts).pipe(toArray()),
    )

    return generateCoverageBinsPrefixSum({
      features: features as FeatureWithMismatchIterator[],
      region,
      opts,
      fetchSequence: sequenceAdapter
        ? (region: Region) => fetchSequence(region, sequenceAdapter)
        : undefined,
    })
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
