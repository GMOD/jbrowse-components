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
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { controlChromosomes } from './controlChromosomes.ts'
import { binExtent, joinControl } from './joinControl.ts'

import type { AxisMasks } from './joinControl.ts'
import type { ContactRecords, ExpectedValues, HicRegion } from '@gmod/hic'
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
  /**
   * The control's counts beside `counts`, the two joined on bin pairs, and
   * each library's depth; where the call asked for them and the control has
   * the pair.
   */
  control?: {
    counts: Float32Array
    depth: number
    controlDepth: number
    /** the contacts one served count stands for, in this file and the control */
    contactsPerCount: number
    controlContactsPerCount: number
  }
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

interface PairRead {
  records: ContactRecords
  appliedNormalization: string
}

interface Control {
  adapter: HicAdapter
  /** the control's name for each of this file's chromosomes it holds */
  names: Map<string, string>
}

// A bin is reportable where its normalization factor is usable; the parser
// drops a contact whose factor product is 0 or NaN.
function validBins(values: Float64Array | undefined, n: number) {
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const v = values?.[i]
    mask[i] = v !== undefined && v !== 0 && !Number.isNaN(v) ? 1 : 0
  }
  return mask
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

  private controlSetup = cachedSetup({
    label: 'Downloading control header',
    setup: opts => this.openControl(opts),
  })

  private vectorMeans = new Map<string, Promise<number | undefined>>()

  public constructor(
    config: AnyConfigurationModel,
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

  private async openControl(opts: BaseOptions): Promise<Control | undefined> {
    const config: Record<string, unknown> | undefined =
      this.getConf('controlAdapter') ?? undefined
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    const { dataAdapter } = await this.getSubAdapter(config)
    if (!(dataAdapter instanceof HicAdapter)) {
      throw new Error(
        `A Hi-C control must be a HicAdapter, not ${String(config.type)}`,
      )
    }
    const [mine, theirs] = await Promise.all([
      this.setup(opts),
      dataAdapter.getMetadata(opts),
    ])
    return {
      adapter: dataAdapter,
      names: controlChromosomes(mine.chromosomes, theirs.chromosomes),
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
    const fetched = new Array<
      | (PairRead & {
          expected?: ExpectedValues
          control?: RegionPairContacts['control']
        })
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
            const onProgress = (current: number, total: number) => {
              advance(at, current / total)
            }
            fetched[at] = control
              ? await this.fetchWithControl({
                  control,
                  region1: regions[i]!,
                  region2: regions[j]!,
                  normalization,
                  resolution,
                  signal,
                  onProgress,
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
    const read = await this.readPair(r1, r2, normalization, resolution, {
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

  /**
   * One region pair's contacts in this file, `bin1` along `r1`, or undefined
   * where the file has no matrix for the pair at this binsize.
   */
  public async readPair(
    r1: HicRegion,
    r2: HicRegion,
    normalization: string,
    resolution: number,
    opts: {
      signal?: AbortSignal
      onProgress?: (current: number, total: number) => void
    },
  ): Promise<PairRead | undefined> {
    try {
      // `transposed` is the parser's own answer, decided from the file's
      // chromosome indices, which this adapter would otherwise look up again.
      const { records, appliedNormalization, transposed } =
        await this.hic.getContactRecords(
          normalization,
          r1,
          r2,
          resolution,
          opts,
        )
      return {
        records: transposed
          ? { bin1: records.bin2, bin2: records.bin1, counts: records.counts }
          : records,
        appliedNormalization,
      }
    } catch (e) {
      if (`${e}`.includes(NO_DATA_FOR_RESOLUTION)) {
        return undefined
      }
      throw e
    }
  }

  /** The library's total contacts, from its `ALL` map; undefined without one. */
  public async totalContacts() {
    return this.hic.getTotalContacts()
  }

  /**
   * The chromosome pair's contacts at this binsize, or undefined where the
   * file has no matrix for the pair there. The parser answers a missing
   * matrix with no records, which a join would read as all zeros.
   */
  public async pairSum(chr1: string, chr2: string, resolution: number) {
    const { chromosomes } = await this.setup({})
    const c1 = chromosomes.find(c => c.name === chr1)
    const c2 = chromosomes.find(c => c.name === chr2)
    return c1 && c2
      ? (await this.hic.getMatrix(c1.index, c2.index))?.getZoomData(resolution)
          ?.sumCounts
      : undefined
  }

  /**
   * The contacts one count of the chromosome pair stands for under
   * `normalization`: the product of its two vectors' means, since a count is
   * the raw one over `v[i] * v[j]`. Juicer's vectors keep the matrix total, so
   * this is near 1; a vector balancing each row to 1, as hictk copies from a
   * cooler, puts it in the thousands, where a pseudocount of 1 would swamp
   * every count.
   */
  public async contactsPerCount(
    normalization: string,
    chr1: string,
    chr2: string,
    resolution: number,
  ) {
    if (normalization === 'NONE') {
      return 1
    }
    const [m1, m2] = await Promise.all([
      this.vectorMean(normalization, chr1, resolution),
      this.vectorMean(normalization, chr2, resolution),
    ])
    return (m1 ?? 1) * (m2 ?? 1)
  }

  // Not aborted with the fetch: a cached read cut short would answer every
  // later fetch with its rejection.
  private vectorMean(normalization: string, chr: string, resolution: number) {
    const key = `${normalization}\t${chr}\t${resolution}`
    let mean = this.vectorMeans.get(key)
    if (!mean) {
      mean = (async () => {
        const { chromosomes } = await this.setup({})
        const size = chromosomes.find(c => c.name === chr)?.size
        const vector = await this.hic.getNormalizationVector(
          normalization,
          chr,
          resolution,
        )
        const values =
          size === undefined
            ? undefined
            : await vector?.getValues(0, Math.ceil(size / resolution))
        let sum = 0
        let n = 0
        for (const v of values ?? []) {
          if (v !== 0 && !Number.isNaN(v)) {
            sum += v
            n++
          }
        }
        return n > 0 ? sum / n : undefined
      })()
      this.vectorMeans.set(key, mean)
    }
    return mean
  }

  /** Which bins of `[start, end)` this file's `normalization` can report on. */
  public async binMask(
    normalization: string,
    chr: string,
    [start, end]: readonly [number, number],
    resolution: number,
    signal?: AbortSignal,
  ) {
    if (normalization === 'NONE') {
      return undefined
    }
    const vector = await this.hic.getNormalizationVector(
      normalization,
      chr,
      resolution,
      { signal },
    )
    return validBins(
      await vector?.getValues(start, end, { signal }),
      end - start,
    )
  }

  /**
   * One region pair in both files, under one normalization and joined on bin
   * pairs. The two must carry the same normalization for the ratio to mean
   * anything, so a pair where they fell back apart reads both raw. A pair the
   * control holds no matrix for comes back as the map's alone, which the
   * worker leaves out, or paints as counts where no pair has a control.
   */
  private async fetchWithControl({
    control,
    region1,
    region2,
    normalization,
    resolution,
    signal,
    onProgress,
  }: {
    control: Control
    region1: Region
    region2: Region
    normalization: string
    resolution: number
    signal?: AbortSignal
    onProgress: (current: number, total: number) => void
  }) {
    const r1 = { chr: region1.refName, start: region1.start, end: region1.end }
    const r2 = { chr: region2.refName, start: region2.start, end: region2.end }
    const name1 = control.names.get(region1.refName)
    const name2 = control.names.get(region2.refName)
    const [mySum, theirSum] = await Promise.all([
      this.pairSum(r1.chr, r2.chr, resolution),
      name1 !== undefined && name2 !== undefined
        ? control.adapter.pairSum(name1, name2, resolution)
        : undefined,
    ])
    if (!mySum) {
      return undefined
    }
    if (!theirSum || name1 === undefined || name2 === undefined) {
      return this.readPair(r1, r2, normalization, resolution, {
        signal,
        onProgress,
      })
    }
    const c1 = { ...r1, chr: name1 }
    const c2 = { ...r2, chr: name2 }
    const read = (norm: string) =>
      Promise.all([
        this.readPair(r1, r2, norm, resolution, { signal, onProgress }),
        control.adapter.readPair(c1, c2, norm, resolution, { signal }),
      ])
    let [mine, theirs] = await read(normalization)
    if (
      mine &&
      theirs &&
      mine.appliedNormalization !== theirs.appliedNormalization
    ) {
      ;[mine, theirs] = await read('NONE')
    }
    if (!mine || !theirs) {
      return mine
    }
    const norm = mine.appliedNormalization
    const x = binExtent(mine.records.bin1, theirs.records.bin1)
    const y = binExtent(mine.records.bin2, theirs.records.bin2)
    const masksOf = async (
      file: HicAdapter,
      chr1: string,
      chr2: string,
    ): Promise<AxisMasks> => {
      const [xMask, yMask] = await Promise.all([
        file.binMask(norm, chr1, x, resolution, signal),
        file.binMask(norm, chr2, y, resolution, signal),
      ])
      return { x: xMask, y: yMask }
    }
    const [
      myTotal,
      theirTotal,
      myMasks,
      theirMasks,
      contactsPerCount,
      controlContactsPerCount,
    ] = await Promise.all([
      this.totalContacts(),
      control.adapter.totalContacts(),
      masksOf(this, r1.chr, r2.chr),
      masksOf(control.adapter, name1, name2),
      this.contactsPerCount(norm, r1.chr, r2.chr, resolution),
      control.adapter.contactsPerCount(norm, name1, name2, resolution),
    ])
    // Library totals only where both files have one: one file's total over
    // the other's pair sum would scale every cell by orders of magnitude.
    // A total below its own pair's sum is no total either: hictk writes the
    // `ALL` map's as 1. The pair sums keep a gain that spans a whole
    // chromosome pair, as a translocation's does, out of the depth.
    const [depth, controlDepth] =
      myTotal !== undefined &&
      theirTotal !== undefined &&
      myTotal >= mySum &&
      theirTotal >= theirSum
        ? [myTotal, theirTotal]
        : [mySum, theirSum]
    const joined = joinControl(mine.records, theirs.records, {
      observed: myMasks,
      control: theirMasks,
      x0: x[0],
      y0: y[0],
    })
    return {
      records: {
        bin1: joined.bin1,
        bin2: joined.bin2,
        counts: joined.counts,
      },
      appliedNormalization: norm,
      control: {
        counts: joined.control,
        depth,
        controlDepth,
        contactsPerCount,
        controlContactsPerCount,
      },
    }
  }
}
