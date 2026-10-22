import { HicFile, NO_DATA_FOR_RESOLUTION } from '@gmod/hic'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  createProgressReporter,
  downloadStatus,
  updateStatus,
} from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { ContactRecords, ExpectedValues } from '@gmod/hic'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

/**
 * One region pair's contacts, as the parser decoded them, with `bin1` always
 * on `region1Idx`'s chromosome.
 */
export interface RegionPairContacts extends ContactRecords {
  region1Idx: number
  region2Idx: number
  /** what the file applied to this pair, which falls back per chromosome */
  appliedNormalization: string
  /**
   * The pair's expected counts under `appliedNormalization`, where the call
   * asked for them and the file has them.
   */
  expected?: ExpectedValues
}

/**
 * A multi-region matrix: every non-empty pair `(i, j)`, `i <= j`, in that
 * nested-loop order.
 */
export interface MultiRegionContacts {
  pairs: RegionPairContacts[]
  numContacts: number
  resolution: number
  /** downgraded to what a pair actually got when any pair fell back */
  appliedNormalization: string
}

interface HicContactOptions extends BaseOptions {
  /** one of the file's binsizes; the display picks it */
  resolution: number
  normalization?: string
  /** also read each pair's expected counts, for observed/expected */
  expected?: boolean
}

// Each pair is an independent chain of range reads, so pairs run concurrently;
// bounded because the parser's block cache is sized for this many in flight.
const PAIR_CONCURRENCY = 6

export default class HicAdapter extends BaseFeatureDataAdapter {
  private hic: HicFile

  private setup = cachedSetup({
    label: 'Downloading header',
    setup: opts => this.hic.getMetaData({ signal: opts.signal }),
  })

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.hic = new HicFile({
      filehandle: openLocation(this.getConf('hicLocation'), this.pluginManager),
    })
  }

  public async getHeader(opts?: BaseOptions) {
    const { statusCallback, signal } = opts ?? {}
    const { resolutions } = await this.setup(opts)
    // Its own phase: on a v8 file with no recorded index position this walks
    // the expected-values section, the slowest part of opening a `.hic`.
    const norms = await downloadStatus(
      'Downloading normalization data',
      statusCallback,
      onProgress => this.hic.getNormalizationOptions({ onProgress, signal }),
      signal,
    )
    return { norms, resolutions }
  }

  async getRefNames(opts?: BaseOptions) {
    const metadata = await this.setup(opts)
    return metadata.chromosomes.map(chr => chr.name)
  }

  /**
   * Empty: the display fetches matrices through
   * `getMultiRegionContactRecords`.
   */
  getFeatures(_region: Region, _opts?: BaseOptions) {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }

  async getMultiRegionContactRecords(
    regions: Region[],
    opts: HicContactOptions,
  ): Promise<MultiRegionContacts> {
    const {
      resolution,
      normalization = 'KR',
      expected = false,
      statusCallback,
      signal,
    } = opts

    const metadata = await this.setup(opts)
    if (!metadata.resolutions.includes(resolution)) {
      throw new Error(
        `HicAdapter: requested binsize ${resolution} is not in the .hic file (available: ${metadata.resolutions.join(', ')})`,
      )
    }

    const pairIndices: [number, number][] = []
    for (let i = 0; i < regions.length; i++) {
      for (let j = i; j < regions.length; j++) {
        pairIndices.push([i, j])
      }
    }
    const fetched = new Array<
      | {
          records: ContactRecords
          appliedNormalization: string
          expected?: ExpectedValues
        }
      | undefined
    >(pairIndices.length)

    const downloadPhase = 'Downloading data'
    await updateStatus(
      downloadPhase,
      statusCallback,
      async () => {
        // Pairs are the denominator, the one total known before any read; a
        // pair's own blocks move it within its share.
        const report = createProgressReporter({
          label: downloadPhase,
          total: pairIndices.length,
          statusCallback,
        })
        const pairShare = new Float64Array(pairIndices.length)
        let progress = 0
        const advance = (at: number, share: number) => {
          progress += share - pairShare[at]!
          pairShare[at] = share
          report(progress)
        }
        let next = 0
        const worker = async () => {
          while (next < pairIndices.length) {
            const at = next++
            const [i, j] = pairIndices[at]!
            checkAbortSignal(signal)
            fetched[at] = await this.fetchRegionPairRecords({
              region1: regions[i]!,
              region2: regions[j]!,
              normalization,
              resolution,
              expected,
              signal,
              onProgress: (current, total) => {
                advance(at, current / total)
              },
            })
            advance(at, 1)
          }
        }
        await Promise.all(
          Array.from(
            { length: Math.min(PAIR_CONCURRENCY, pairIndices.length) },
            () => worker(),
          ),
        )
      },
      signal,
    )

    let appliedNormalization = normalization
    let numContacts = 0
    const pairs: RegionPairContacts[] = []
    for (const [at, [i, j]] of pairIndices.entries()) {
      const pair = fetched[at]
      if (pair === undefined || pair.records.bin1.length === 0) {
        continue
      }
      // Only a pair with contacts speaks: an empty one reports NONE whenever a
      // chromosome lacks a vector at this binsize.
      if (pair.appliedNormalization !== normalization) {
        appliedNormalization = pair.appliedNormalization
      }
      pairs.push({
        region1Idx: i,
        region2Idx: j,
        appliedNormalization: pair.appliedNormalization,
        expected: pair.expected,
        ...pair.records,
      })
      numContacts += pair.records.bin1.length
    }

    return { pairs, numContacts, resolution, appliedNormalization }
  }

  /**
   * One pair's contacts with the parser's transpose undone, or undefined when
   * the file has no matrix for the pair at this binsize — routine for
   * inter-chromosomal pairs, which often carry only coarse binsizes.
   */
  private async fetchRegionPairRecords({
    region1,
    region2,
    normalization,
    resolution,
    expected,
    signal,
    onProgress,
  }: {
    region1: Region
    region2: Region
    normalization: string
    resolution: number
    expected: boolean
    signal?: AbortSignal
    onProgress: (current: number, total: number) => void
  }) {
    const r1 = { chr: region1.refName, start: region1.start, end: region1.end }
    const r2 = { chr: region2.refName, start: region2.start, end: region2.end }
    try {
      // `transposed` is the parser's own answer, decided from the file's
      // chromosome indices, which this adapter would otherwise look up again.
      const { records, appliedNormalization, transposed } =
        await this.hic.getContactRecords(normalization, r1, r2, resolution, {
          onProgress,
          signal,
        })
      // Under the normalization the pair's counts carry, since each has its
      // own expected vector; symmetric in the two regions, so the transpose
      // needs no undoing.
      return {
        records: transposed
          ? { bin1: records.bin2, bin2: records.bin1, counts: records.counts }
          : records,
        appliedNormalization,
        expected:
          expected && records.bin1.length > 0
            ? await this.hic.getExpectedValues(
                appliedNormalization,
                r1,
                r2,
                resolution,
                { signal },
              )
            : undefined,
      }
    } catch (e) {
      if (`${e}`.includes(NO_DATA_FOR_RESOLUTION)) {
        return undefined
      }
      throw e
    }
  }
}
