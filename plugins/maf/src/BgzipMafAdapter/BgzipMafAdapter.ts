import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  makeRefChrFilter,
  parseTaiIndex,
} from '../BgzipTaffyAdapter/taiIndex.ts'
import MafFeature from '../MafFeature.ts'
import { MafAdapterBase } from '../util/MafAdapterBase.ts'
import { buildSampleFilter } from '../util/getSamples.ts'
import { makeSourceResolver } from '../util/parseAssemblyName.ts'
import { readTaiSlice, taiRegionByteSize } from '../util/taiSlice.ts'
import { parseMafBlocks } from './mafParsing.ts'

import type { MafAdapterOptions } from '../types.ts'
import type { BgzipMafAdapterConfig } from './configSchema.ts'
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
export default class BgzipMafAdapter extends MafAdapterBase<BgzipMafAdapterConfig> {
  private configure = cachedSetup({
    label: 'Downloading index',
    setup: () => this.readTaiFile(),
  })

  private decoder = new TextDecoder()

  async getRefNames() {
    const index = await this.configure()
    return [...index.keys()]
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
      const index = await this.configure(opts)
      const resolver = makeSourceResolver(buildSampleFilter(opts))
      const onQueriedChr = makeRefChrFilter(query.refName)

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
        // Overlapping the query span is not enough — the read runs past the
        // chromosome's end by design, so a block of the *next* chromosome can
        // overlap numerically. See `makeRefChrFilter`.
        if (
          feat.end > query.start &&
          feat.start < query.end &&
          onQueriedChr(feat.refSrc)
        ) {
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

  async getRegionByteSize(regions: Region[]) {
    return taiRegionByteSize(await this.configure(), regions)
  }
}
