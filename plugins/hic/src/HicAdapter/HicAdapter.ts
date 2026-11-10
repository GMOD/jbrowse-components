import { HicFile } from '@gmod/hic'
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
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { controlChromosomes } from './controlChromosomes.ts'
import { readPairWithControl } from './controlPair.ts'
import { readPair, toHicRegion } from './readPair.ts'

import type { HicAdapterConfig } from './configSchema.ts'
import type {
  ControlCounts,
  ControlledPairRead,
  HicSide,
} from './controlPair.ts'
import type { ContactRecords, ExpectedValues } from '@gmod/hic'
import type PluginManager from '@jbrowse/core/PluginManager'
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
  /** where the call asked for the control and it has the pair */
  control?: ControlCounts
}

/**
 * A multi-region matrix: every non-empty pair `(i, j)`, `i <= j`, in that
 * nested-loop order.
 */
export interface MultiRegionContacts {
  pairs: RegionPairContacts[]
  numContacts: number
  resolution: number
  /**
   * What the pairs with contacts got, the requested normalization first: each
   * pair falls back on its own, so a view across chromosomes can hold more
   * than one. The requested one alone where no pair has contacts.
   */
  appliedNormalizations: string[]
}

interface HicContactOptions extends BaseOptions {
  /** one of the file's binsizes; the display picks it */
  resolution: number
  normalization?: string
  /** also read each pair's expected counts, for observed/expected */
  expected?: boolean
  /** also read and join the control's counts, for observed/control */
  control?: boolean
}

/** What the display reads before any fetch: the choices the file offers. */
export interface HicHeader {
  norms: string[]
  resolutions: number[]
}

interface Control {
  adapter: HicAdapter
  side: HicSide
  /** the control's name for each of this file's chromosomes it holds */
  names: Map<string, string>
}

// Each pair is an independent chain of range reads, so pairs run concurrently;
// bounded because the parser's block cache is sized for this many in flight.
const PAIR_CONCURRENCY = 6

export default class HicAdapter extends BaseFeatureDataAdapter<HicAdapterConfig> {
  private hic: HicFile

  private setup = cachedSetup({
    label: 'Downloading header',
    setup: opts => this.hic.getMetaData({ signal: opts.signal }),
  })

  private controlSetup = cachedSetup({
    label: 'Downloading control header',
    setup: opts => this.openControl(opts),
  })

  public constructor(
    config: HicAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.hic = new HicFile({
      filehandle: openLocation(this.getConf('hicLocation'), this.pluginManager),
      blockCacheBudget: decompressedBytesBudget,
    })
  }

  freeResources() {
    this.hic.clearCache()
  }

  public async getHeader(opts?: BaseOptions): Promise<HicHeader> {
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
    const control = await this.controlSetup(opts)
    if (!control) {
      return { norms, resolutions }
    }
    // A ratio compares the two at one binsize under one normalization, so
    // only what both files offer is offered.
    const theirs = await control.adapter.getHeader(opts)
    const shared = resolutions.filter(r => theirs.resolutions.includes(r))
    if (!shared.length) {
      throw new Error(
        `The map and its control share no binsize (map: ${resolutions.join(', ')}; control: ${theirs.resolutions.join(', ')})`,
      )
    }
    return {
      norms: norms.filter(n => theirs.norms.includes(n)),
      resolutions: shared,
    }
  }

  /** The parsed header: chromosomes and binsizes. */
  public async getMetadata(opts?: BaseOptions) {
    return this.setup(opts)
  }

  /** This file as a comparison reads it, from either end. */
  public async side(opts?: BaseOptions): Promise<HicSide> {
    const { chromosomes } = await this.setup(opts)
    return { hic: this.hic, chromosomes }
  }

  private async openControl(opts: BaseOptions): Promise<Control | undefined> {
    const config: Record<string, unknown> | undefined =
      this.getConf('controlAdapter')
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    const { dataAdapter } = await this.getSubAdapter(config)
    if (!(dataAdapter instanceof HicAdapter)) {
      throw new Error(
        `A Hi-C control must be a HicAdapter, not ${String(config.type)}`,
      )
    }
    const [mine, side] = await Promise.all([
      this.setup(opts),
      dataAdapter.side(opts),
    ])
    return {
      adapter: dataAdapter,
      side,
      names: controlChromosomes(mine.chromosomes, side.chromosomes),
    }
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
      control: withControl = false,
      statusCallback,
      signal,
    } = opts
    const control = withControl ? await this.controlSetup(opts) : undefined

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
    const mine = { hic: this.hic, chromosomes: metadata.chromosomes }
    const fetched = new Array<
      (ControlledPairRead & { expected?: ExpectedValues }) | undefined
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
            const onProgress = (current: number, total: number) => {
              advance(at, current / total)
            }
            fetched[at] = control
              ? await readPairWithControl({
                  mine,
                  theirs: control.side,
                  names: control.names,
                  region1: regions[i]!,
                  region2: regions[j]!,
                  normalization,
                  resolution,
                  opts: { signal, onProgress },
                })
              : await this.fetchRegionPairRecords({
                  region1: regions[i]!,
                  region2: regions[j]!,
                  normalization,
                  resolution,
                  expected,
                  signal,
                  onProgress,
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

    const applied = new Set<string>()
    let numContacts = 0
    const pairs: RegionPairContacts[] = []
    for (const [at, [i, j]] of pairIndices.entries()) {
      const pair = fetched[at]
      if (pair === undefined || pair.records.bin1.length === 0) {
        continue
      }
      // Only a pair with contacts speaks: an empty one reports NONE whenever a
      // chromosome lacks a vector at this binsize.
      applied.add(pair.appliedNormalization)
      pairs.push({
        region1Idx: i,
        region2Idx: j,
        appliedNormalization: pair.appliedNormalization,
        expected: pair.expected,
        control: pair.control,
        ...pair.records,
      })
      numContacts += pair.records.bin1.length
    }

    const appliedNormalizations =
      applied.size === 0 || applied.has(normalization)
        ? [normalization, ...[...applied].filter(n => n !== normalization)]
        : [...applied]
    return { pairs, numContacts, resolution, appliedNormalizations }
  }

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
    const r1 = toHicRegion(region1)
    const r2 = toHicRegion(region2)
    const read = await readPair(this.hic, r1, r2, normalization, resolution, {
      onProgress,
      signal,
    })
    // Under the normalization the pair's counts carry, since each has its
    // own expected vector; symmetric in the two regions, so the transpose
    // needs no undoing.
    return read
      ? {
          ...read,
          expected:
            expected && read.records.bin1.length > 0
              ? await this.hic.getExpectedValues(
                  read.appliedNormalization,
                  r1,
                  r2,
                  resolution,
                  { signal },
                )
              : undefined,
        }
      : undefined
  }
}
