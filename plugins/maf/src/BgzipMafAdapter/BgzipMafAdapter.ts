import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { parseTaiIndex } from '../BgzipTaffyAdapter/taiIndex.ts'
import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesMemoized } from '../util/getSamples.ts'
import { mafSummaryFeatures } from '../util/loadMafSummaryAdapter.ts'
import { lazyInit } from '../util/loadSubAdapter.ts'
import { makeSourceResolver } from '../util/parseAssemblyName.ts'
import { readTaiSlice, taiRegionByteSize } from '../util/taiSlice.ts'
import { parseMafBlocks } from './mafParsing.ts'

import type { IndexData } from '../BgzipTaffyAdapter/types.ts'
import type { MafAdapterOptions } from '../types.ts'
import type { SamplesHolder } from '../util/getSamples.ts'
import type { MafSummaryHolder } from '../util/loadMafSummaryAdapter.ts'
import type { BgzipMafAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

/**
 * A bgzip-compressed MAF with a Taffy `.tai` index.
 *
 * This is the shape whole-genome multiple alignments are actually published in:
 * HPRC release 2 ships `hprc-v2.1-mc-grch38.full.maf.gz` (53 GB, 464
 * haplotypes) with a sibling `.tai`, and Cactus/taffy write the pair for any
 * HAL export. Nothing else here reads it — `BgzipTaffyAdapter` wants TAF,
 * `MafTabixAdapter` a maf2bed BED, `BigMafAdapter` a bigMaf — so a published
 * alignment had to be converted before it could be looked at.
 *
 * The index and the block arithmetic are `BgzipTaffyAdapter`'s, unchanged: a
 * `.tai` describes bgzf virtual offsets against reference coordinates and does
 * not care which text format sits inside. Only the body parse differs, so that
 * is the only thing this does not share. Measured against HPRC's own index, a
 * 10 kb locus resolves to a ~924 KB read out of the 53 GB file.
 */
export default class BgzipMafAdapter extends BaseFeatureDataAdapter<BgzipMafAdapterConfig> {
  public setupP?: Promise<IndexData>

  public samplesP?: SamplesHolder['samplesP']

  public summaryAdapterP?: MafSummaryHolder['summaryAdapterP']

  // true once the index has downloaded (set by lazyInit); gates the status label
  // so pan/zoom re-entry into setup() doesn't re-flash "Downloading index"
  public setupReady = false

  private decoder = new TextDecoder()

  async getRefNames() {
    const index = await this.setup()
    return Object.keys(index)
  }

  setupPre() {
    return lazyInit(this, () => this.readTaiFile())
  }

  setup(opts?: BaseOptions) {
    const { statusCallback } = opts ?? {}
    return this.setupReady
      ? this.setupPre()
      : updateStatus('Downloading index', statusCallback, () => this.setupPre())
  }

  async readTaiFile() {
    const text = await openLocation(this.getConf('taiLocation')).readFile(
      'utf8',
    )
    return parseTaiIndex(text)
  }

  getFeatures(query: Region, opts?: MafAdapterOptions) {
    const { statusCallback } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      const index = await this.setup(opts)
      const resolver = makeSourceResolver(buildSampleFilter(opts))

      const slice = await readTaiSlice({
        index,
        refName: query.refName,
        start: query.start,
        end: query.end,
        location: this.getConf('mafGzLocation'),
        statusCallback,
      })
      if (!slice) {
        observer.complete()
        return
      }
      const text = this.decoder.decode(slice)

      for (const feat of parseMafBlocks(text, resolver.resolve)) {
        if (feat.end > query.start && feat.start < query.end) {
          observer.next(
            new MafFeature(
              feat.uniqueId,
              feat.start,
              feat.end,
              query.refName,
              feat.strand,
              feat.alignments,
              feat.seq,
              feat.empties,
            ),
          )
        }
      }

      resolver.reportUnmatched()
      statusCallback?.('')
      observer.complete()
    }, opts?.stopToken)
  }

  async getSamples() {
    return getSamplesMemoized(
      this,
      this.getConf('nhLocation'),
      this.getConf('samples'),
    )
  }

  // The zoom-out tier, same slot and same reader as the other three adapters'.
  // The `.tai` is what made this look unnecessary — a read costs the span on
  // screen, not the alignment — and that reasoning misses the depth factor; see
  // the slot's own comment for the number.
  getSummaryFeatures(query: Region, opts?: BaseOptions) {
    return mafSummaryFeatures(this, query, opts)
  }

  async getRegionByteSize(regions: Region[]) {
    return taiRegionByteSize(await this.setup(), regions)
  }
}
