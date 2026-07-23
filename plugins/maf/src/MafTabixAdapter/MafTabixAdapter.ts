import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesFromConfig } from '../util/getSamples.ts'
import { lazyInit, loadSubAdapter } from '../util/loadSubAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import {
  parseMafTabixEntry,
  selectReferenceSequenceString,
} from '../util/parseAssemblyName.ts'

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
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
      let firstAssemblyNameFound: string | undefined
      const refAssemblyName = this.getConf('refAssemblyName')
      const sampleIds = buildSampleFilter(opts)

      await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
        const data = (feature.get('field5') as string).split(',')
        const alignments: Record<string, AlignmentRecord> = {}

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
    return getSamplesFromConfig(
      this.getConf('nhLocation'),
      this.getConf('samples'),
    )
  }

  // Byte budget for the fetch gate comes straight from the tabix index (the
  // .bed.gz already contains every species' sequence, so the compressed block
  // size is a faithful download estimate). No feature download.
  async getMultiRegionByteEstimate(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const { adapter } = await this.setupPre(opts)
    return { bytes: await adapter.getRegionByteSize(regions, opts) }
  }
}
