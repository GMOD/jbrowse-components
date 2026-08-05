import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesMemoized } from '../util/getSamples.ts'
import { mafSummaryFeatures } from '../util/loadMafSummaryAdapter.ts'
import { lazyInit, loadSubAdapter } from '../util/loadSubAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import {
  parseMafTabixEntry,
  selectReferenceSequenceString,
} from '../util/parseAssemblyName.ts'

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
import type { SamplesHolder } from '../util/getSamples.ts'
import type { MafSummaryHolder } from '../util/loadMafSummaryAdapter.ts'
import type { MafTabixAdapterConfig } from './configSchema.ts'
import type {
  BaseFeatureDataAdapter as BaseAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

// BedTabixAdapter exposes an index-only byte estimate (tabix bytesForRegions).
type TabixByteAdapter = BaseAdapter & {
  getRegionByteSize: (regions: Region[], opts?: BaseOptions) => Promise<number>
}

export default class MafTabixAdapter extends BaseFeatureDataAdapter<MafTabixAdapterConfig> {
  public setupP?: Promise<{ adapter: TabixByteAdapter }>

  public samplesP?: SamplesHolder['samplesP']

  public summaryAdapterP?: MafSummaryHolder['summaryAdapterP']

  async setupPre(opts?: BaseOptions): Promise<{ adapter: TabixByteAdapter }> {
    return lazyInit(this, () =>
      loadSubAdapter<TabixByteAdapter>(this, 'BedTabixAdapter', opts),
    )
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
      const refAssemblyName = this.getConf('refAssemblyName')
      const sampleIds = buildSampleFilter(opts)

      await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
        const data = (feature.get('field5') as string).split(',')
        const alignments: Record<string, AlignmentRecord> = {}
        // Per feature, not per query: the last-resort reference is this
        // stanza's own first species. MAF puts the reference first in every
        // stanza, so this is the same answer on a well-formed file — but
        // carrying one stanza's choice across the rest meant a stanza that
        // happened to lack that species resolved to no reference sequence at
        // all, and a block with an empty reference has no genomic extent, so
        // it vanished from the rows and from coverage.
        let firstAssemblyNameFound: string | undefined

        for (let j = 0, l = data.length; j < l; j++) {
          const entry = parseMafTabixEntry(data[j]!, sampleIds)
          if (entry) {
            const { assemblyName, chr, start, strand, srcSize, seq } = entry
            if (!firstAssemblyNameFound) {
              firstAssemblyNameFound = assemblyName
            }
            alignments[assemblyName] = { chr, start, strand, srcSize, seq }
          }
        }

        observer.next(
          new MafFeature(
            feature.id(),
            feature.get('start'),
            feature.get('end'),
            feature.get('refName'),
            0, // strand determined per-alignment
            alignments,
            selectReferenceSequenceString(
              alignments,
              refAssemblyName,
              query.assemblyName,
              firstAssemblyNameFound,
            ) ?? '',
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

  // The zoom-out tier. A tabix MAF is the format that needs one most: every
  // species' bases ride on one BED line, so a wide read downloads the whole
  // alignment and the byte gate blocks it — without a summary this track has no
  // zoom-out path at all, only a force-load prompt. Same slot and same reader as
  // BigMaf's; `maf2bed --summary` is the producer.
  getSummaryFeatures(query: Region, opts?: BaseOptions) {
    return mafSummaryFeatures(this, query, opts)
  }

  // Byte budget for the fetch gate comes straight from the tabix index (the
  // .bed.gz already contains every species' sequence, so the compressed block
  // size is a faithful download estimate). No feature download.
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const { adapter } = await this.setupPre(opts)
    return adapter.getRegionByteSize(regions, opts)
  }
}
