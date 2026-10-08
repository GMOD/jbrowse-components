import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { subscribeToObservable } from '@jbrowse/core/util/rxjs'

import { MafAdapterBase } from '../util/MafAdapterBase.ts'
import { loadSubAdapter } from '../util/loadSubAdapter.ts'
import { mafBlockFeatures } from '../util/mafFeatureSink.ts'
import { BigMafBlockReader } from './stanzaBlockReader.ts'

import type { SubAdapterLoader } from '../util/loadSubAdapter.ts'
import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { BigMafAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

/**
 * The `;`-joined MAF stanza bigMaf packs into its one extra bigBed field.
 *
 * Guarded rather than cast for the same reason as MAF-tabix's `field5`: the
 * name comes from the file's own autoSql, so a BigBed that isn't a bigMaf
 * doesn't have it — and the easiest way to get one here is to put the
 * `bigMafSummary.bb` that this adapter's `summaryAdapter` slot wants into
 * `bigBedLocation`, since both are `.bb` files built from the same alignment.
 * Cast, that reached `.split` on `undefined` for every feature.
 */
function mafBlockField(feature: Feature) {
  const block = feature.get('mafBlock')
  if (typeof block !== 'string') {
    throw new Error(
      `BigMafAdapter: no mafBlock field at ${feature.get('refName')}:${feature.get('start')}. ` +
        'Expected a bigMaf built by `mafToBigMaf` + `bedToBigBed -as=bigMaf.as` — ' +
        'check that bigBedLocation is the alignment file and not a bigMafSummary.bb.',
    )
  }
  return block
}

export default class BigMafAdapter extends MafAdapterBase<BigMafAdapterConfig> {
  private configure: SubAdapterLoader = cachedSetup({
    label: 'Downloading index',
    setup: () =>
      loadSubAdapter(this, {
        type: 'BigBedAdapter',
        bigBedLocation: this.getConf('bigBedLocation'),
      }),
  })

  async getRefNames(opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getRefNames()
  }

  async getHeader(opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getHeader()
  }

  getFeatures(query: Region, opts?: BaseOptions) {
    return mafBlockFeatures(
      query.refName,
      sink => this.readBlocks(query, sink, opts),
      opts?.signal,
    )
  }

  override async readBlocks(
    query: Region,
    sink: MafBlockSink,
    opts?: BaseOptions,
  ) {
    const { adapter } = await this.configure(opts)
    const reader = new BigMafBlockReader(await this.sampleIds(opts))
    await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
      reader.read(
        sink,
        feature.id(),
        feature.get('start'),
        feature.get('end'),
        mafBlockField(feature),
      )
    })
    reader.reportUnmatched()
  }

  // Compressed download-size estimate from the bigMaf.bb R-tree index, delegated
  // to the BigBed sub-adapter (the actual file). bigMaf is a full-feature
  // download — a whole-chromosome view can pull enough packed MAF stanzas to
  // hang the tab — so it must be byte-gated like any indexed track. NOT
  // exempt like the screen-reduced adapters (BigWig, HiC), which report no
  // estimate at all.
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getRegionByteSize(regions, opts)
  }
}
