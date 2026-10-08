import { ArrayFeatureView, BigWig, BigWigFeature } from '@gmod/bbi'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { bigWigFeatureTable } from './bigWigFeatureTable.ts'
import {
  binAlignedExtent,
  binRawRegion,
  sampleMeanRecordSpan,
  syntheticBinBp,
  syntheticCandidateLevels,
  syntheticReductionLevels,
} from './syntheticTiers.ts'
import { tierSpanRange } from './tierSpanRange.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { WiggleAdapterOptions as WiggleOptions } from '../wiggleAdapterOptions.ts'
import type { BigWigAdapterConfig } from './configSchema.ts'
import type {
  BaseOptions,
  ZoomRange,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export default class BigWigAdapter extends BaseFeatureDataAdapter<BigWigAdapterConfig> {
  setup = cachedSetup({
    label: 'Downloading header',
    setup: opts => this.setupPre(opts),
  })

  private rawSectionLevels = cachedSetup({
    setup: opts => this.rawSectionLevelsPre(opts),
  })

  public static capabilities = ['hasResolution']

  private async setupPre(opts?: BaseOptions) {
    const filehandle = openLocation(
      this.getConf('bigWigLocation'),
      this.pluginManager,
    )
    const bigwig = new BigWig({ filehandle })
    const header = await bigwig.getHeader(opts)
    const fileLevels = header.zoomLevels.map(z => z.reductionLevel)
    const candidates = syntheticCandidateLevels(fileLevels)
    return {
      bigwig,
      filehandle,
      header,
      fileLevels,
      firstLevel: Math.min(...fileLevels),
      candidateLadder: [...candidates, ...fileLevels],
      finestCandidate: candidates[0] ?? Infinity,
    }
  }

  private async rawSectionLevelsPre(opts: BaseOptions) {
    const source = await this.setup(opts)
    return source.finestCandidate === Infinity
      ? source.fileLevels
      : [
          ...syntheticReductionLevels(
            source.fileLevels,
            await sampleMeanRecordSpan(source, opts),
          ),
          ...source.fileLevels,
        ]
  }

  /**
   * The reduction levels this file answers in, finest first: the synthetic
   * tiers its raw sample keeps, then the file's own. Reads the sample.
   */
  public async getReductionLevels(opts: BaseOptions = {}) {
    return this.rawSectionLevels(opts)
  }

  // Only a zoom some synthetic bin could serve, from half the finest candidate
  // to half the first level, pays the raw sample the ladder is sized from.
  // Outside that band every candidate stands in: a coarser zoom picks the same
  // file level, and a finer one, a zoomless fetch included, reads raw and
  // declares a raw range no wider than the sampled ladder's.
  private async tierLevels(opts: WiggleOptions) {
    const { candidateLadder, finestCandidate, firstLevel } =
      await this.setup(opts)
    const basesPerSpan = this.basesPerSpan(opts)
    return basesPerSpan >= finestCandidate / 2 && basesPerSpan < firstLevel / 2
      ? this.rawSectionLevels(opts)
      : candidateLadder
  }

  public async getRefNames(opts?: BaseOptions) {
    const { header } = await this.setup(opts)
    return Object.keys(header.refsByName)
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    const { signal } = opts
    return ObservableCreate<Feature>(async observer => {
      const view = await this.getArrayFeatureView(region, opts)
      for (let i = 0; i < view.length; i++) {
        observer.next(new BigWigFeature(view, i))
      }
      observer.complete()
    }, signal)
  }

  override async getFeatureTable(region: Region, opts: WiggleOptions = {}) {
    return bigWigFeatureTable(await this.getArrayFeatureView(region, opts))
  }

  // A config naming 0 or less would declare a zoom range no zoom falls in.
  private get resolutionMultiplier() {
    const multiplier = this.getConf('resolutionMultiplier')
    return multiplier > 0 ? multiplier : 1
  }

  private basesPerSpan({ bpPerPx = 0, resolution = 1 }: WiggleOptions) {
    return (bpPerPx / resolution) * this.resolutionMultiplier
  }

  public async getZoomRange(opts: WiggleOptions = {}): Promise<ZoomRange> {
    const levels = await this.tierLevels(opts)
    const { resolution = 1 } = opts
    const bpPerPxPerSpan = resolution / this.resolutionMultiplier
    const [lo, hi] = tierSpanRange(levels, this.basesPerSpan(opts))
    return {
      minBpPerPx: lo * bpPerPxPerSpan,
      maxBpPerPx: hi * bpPerPxPerSpan,
    }
  }

  private async getArrayFeatureView(
    region: Region,
    opts: WiggleOptions = {},
  ): Promise<ArrayFeatureView> {
    const [arrays] = await this.readRegions([region], opts)
    const { starts, ends, scores, minScores, maxScores } = arrays!
    return new ArrayFeatureView(
      minScores && maxScores
        ? { starts, ends, scores, minScores, maxScores, isSummary: true }
        : { starts, ends, scores, isSummary: false },
      this.getConf('source'),
      region.refName,
    )
  }

  // One bbi pass over all regions, coalescing adjacent on-disk blocks across
  // region boundaries. All regions share the tier picked from the view's
  // bpPerPx. A synthetic tier reads the raw section over bin-aligned extents
  // and bins each region; a file tier's rows are bbi's own.
  private async readRegions(regions: Region[], opts: WiggleOptions) {
    const { statusCallback } = opts
    const { bigwig, firstLevel } = await this.setup(opts)
    const levels = await this.tierLevels(opts)
    const basesPerSpan = this.basesPerSpan(opts)
    const binBp = syntheticBinBp(
      tierSpanRange(levels, basesPerSpan)[0],
      firstLevel,
    )
    const rawSectionSpan = firstLevel / 4

    const res = await downloadStatus(
      'Downloading wiggle data',
      statusCallback,
      onProgress =>
        bigwig.getFeaturesAsArraysMulti(
          regions.map(({ refName, start, end }) => ({
            refName,
            ...(binBp === undefined
              ? { start, end }
              : binAlignedExtent(start, end, binBp)),
          })),
          {
            ...opts,
            basesPerSpan: binBp === undefined ? basesPerSpan : rawSectionSpan,
            onProgress,
          },
        ),
    )

    const { starts, ends, scores, regionOffsets } = res
    const minScores = res.isSummary ? res.minScores : undefined
    const maxScores = res.isSummary ? res.maxScores : undefined
    return regions.map((region, i) => {
      const lo = regionOffsets[i]!
      const hi = regionOffsets[i + 1]!
      return binBp === undefined
        ? {
            starts: starts.subarray(lo, hi),
            ends: ends.subarray(lo, hi),
            scores: scores.subarray(lo, hi),
            minScores: minScores?.subarray(lo, hi),
            maxScores: maxScores?.subarray(lo, hi),
            count: hi - lo,
          }
        : binRawRegion(
            starts,
            ends,
            scores,
            lo,
            hi,
            region.start,
            region.end,
            binBp,
          )
    })
  }

  // origin is a display concern (pos/neg color split) and stays out of
  // the adapter API. Callers run processFeaturesFromArrays themselves with the
  // pivot — split happens inline with the data scan, no second pass.
  public async getFeatureArrays(
    region: Region,
    opts: WiggleOptions = {},
  ): Promise<RawFeatureArrays> {
    const [arrays] = await this.readRegions([region], opts)
    return arrays!
  }

  // Multi-region fast path: fewer range requests than N independent
  // getFeatureArrays calls — the win for collapsed-intron and whole-genome
  // overviews. regionOffsets slices each region out of bbi's packed arrays
  // copy-free.
  public async getFeatureArraysMulti(
    regions: Region[],
    opts: WiggleOptions = {},
  ): Promise<RawFeatureArrays[]> {
    return this.readRegions(regions, opts)
  }
}
