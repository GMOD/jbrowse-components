import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesMemoized } from '../util/getSamples.ts'
import { mafSummaryFeatures } from '../util/loadMafSummaryAdapter.ts'
import { lazyInit, loadSubAdapter } from '../util/loadSubAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import {
  matchSampleId,
  parseAssemblyAndChr,
} from '../util/parseAssemblyName.ts'
import { parseBigMafStanza } from '../util/parseBigMaf.ts'

import type { MafAdapterOptions } from '../types.ts'
import type { SamplesHolder } from '../util/getSamples.ts'
import type { MafSummaryHolder } from '../util/loadMafSummaryAdapter.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BigMafAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<{ adapter: BaseFeatureDataAdapter }>

  public summaryAdapterP?: MafSummaryHolder['summaryAdapterP']

  public samplesP?: SamplesHolder['samplesP']

  async setupPre(
    opts?: BaseOptions,
  ): Promise<{ adapter: BaseFeatureDataAdapter }> {
    return lazyInit(this, () => loadSubAdapter(this, 'BigBedAdapter', opts))
  }

  async getRefNames(opts?: BaseOptions) {
    const { adapter } = await this.setupPre(opts)
    return adapter.getRefNames()
  }

  async getHeader(opts?: BaseOptions) {
    const { adapter } = await this.setupPre(opts)
    return adapter.getHeader()
  }

  getFeatures(query: Region, opts?: MafAdapterOptions) {
    return ObservableCreate<Feature>(async observer => {
      const { adapter } = await this.setupPre(opts)
      const sampleIds = buildSampleFilter(opts)

      // bigMaf packs the full MAF stanza (s/i/e/q lines) into one ';'-joined
      // `mafBlock` field; parseBigMafStanza turns it into aligned + empty rows.
      const resolve = (organismChr: string) =>
        sampleIds
          ? matchSampleId(organismChr, sampleIds)
          : parseAssemblyAndChr(organismChr)

      await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
        const { alignments, empties, referenceSeq } = parseBigMafStanza(
          feature.get('mafBlock') as string,
          resolve,
        )
        observer.next(
          new MafFeature(
            feature.id(),
            feature.get('start'),
            feature.get('end'),
            feature.get('refName'),
            0, // strand not in BigMaf format
            alignments,
            referenceSeq,
            empties,
          ),
        )
      })

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

  // Per-species alignment-block rows for zoom-out rendering, from whatever the
  // `summaryAdapter` slot names — typically a BigBedAdapter over UCSC's
  // bigMafSummary.bb. Shared with the tabix and TAF adapters, which take the
  // same slot; see `mafSummaryFeatures`.
  getSummaryFeatures(query: Region, opts?: BaseOptions) {
    return mafSummaryFeatures(this, query, opts)
  }

  // Compressed download-size estimate from the bigMaf.bb R-tree index, delegated
  // to the BigBed sub-adapter (the actual file). bigMaf is a full-feature
  // download — a whole-chromosome view can pull enough packed MAF stanzas to
  // hang the tab — so it must be byte-gated like any indexed track. NOT
  // exempt like the screen-reduced adapters (BigWig, HiC), which report no
  // estimate at all.
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const { adapter } = await this.setupPre(opts)
    return adapter.getRegionByteSize(regions, opts)
  }
}
