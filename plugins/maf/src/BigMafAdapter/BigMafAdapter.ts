import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesFromConfig } from '../util/getSamples.ts'
import { lazyInit, loadSubAdapter } from '../util/loadSubAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import {
  matchSampleId,
  parseAssemblyAndChrSimple,
} from '../util/parseAssemblyName.ts'
import { parseBigMafStanza } from '../util/parseBigMaf.ts'

import type { MafAdapterOptions } from '../types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BigMafAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<{ adapter: BaseFeatureDataAdapter }>

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
          : parseAssemblyAndChrSimple(organismChr)

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
    return getSamplesFromConfig(key => this.getConf(key))
  }

  // bbi exposes no per-region byte size, so estimate the fetch budget from span
  // × configured sample count (the dominant term: ~one char per base per
  // species). Falls back to no gate when samples aren't configured.
  async getMultiRegionFeatureDensityStats(regions: Region[]) {
    const samples = this.getConf('samples')
    const n = Array.isArray(samples) ? samples.length : 0
    if (!n) {
      return { featureDensity: 0 }
    }
    let bp = 0
    for (const r of regions) {
      bp += r.end - r.start
    }
    return { bytes: bp * n }
  }
}
