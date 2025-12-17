import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { fetchSequence } from '../util'
import { generateCoverageBinsPrefixSum } from './generateCoverageBinsPrefixSum'

import type { BaseCoverageBin, FeatureWithMismatchIterator } from '../shared/types'
import type { SNPCoverageArrays } from '../SNPCoverageRenderer/types'
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

  async getFeaturesAsArrays(
    region: Region,
    opts: BaseOptions = {},
  ): Promise<SNPCoverageArrays> {
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

    // Count non-empty bins to allocate arrays
    let count = 0
    for (let i = 0; i < bins.length; i++) {
      if (bins[i]) {
        count++
      }
    }

    const starts = new Int32Array(count)
    const ends = new Int32Array(count)
    const scores = new Float32Array(count)
    const snpinfo: BaseCoverageBin[] = new Array(count)

    let idx = 0
    for (let i = 0; i < bins.length; i++) {
      const bin = bins[i]
      if (bin) {
        const start = region.start + i
        starts[idx] = start
        ends[idx] = start + 1
        scores[idx] = bin.depth
        snpinfo[idx] = bin
        idx++
      }
    }

    return { starts, ends, scores, snpinfo, skipmap }
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
