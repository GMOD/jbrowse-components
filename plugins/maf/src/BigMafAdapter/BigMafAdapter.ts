import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesFromConfig } from '../util/getSamples.ts'
import { lazyInit, loadSubAdapter } from '../util/loadSubAdapter.ts'
import { toMafStatus } from '../util/mafStatus.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import {
  matchSampleId,
  parseAssemblyAndChrSimple,
} from '../util/parseAssemblyName.ts'
import { parseBigMafStanza } from '../util/parseBigMaf.ts'

import type { MafAdapterOptions, MafSummaryRecord } from '../types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BigMafAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<{ adapter: BaseFeatureDataAdapter }>

  private summaryAdapterP?: Promise<BaseFeatureDataAdapter | undefined>

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
    return getSamplesFromConfig(
      this.getConf('nhLocation'),
      this.getConf('samples'),
    )
  }

  // The bigMafSummary.bb is a plain bed3+4 BigBed; we read it through whatever
  // sub-adapter the `summaryAdapter` slot names (default a BigBedAdapter),
  // keeping the summary source swappable. Mirrors CRAM's getSequenceAdapter.
  async getSummaryAdapter() {
    const config = this.getConf('summaryAdapter')
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    this.summaryAdapterP ??= this.getSubAdapter(config)
      .then(result => result.dataAdapter as BaseFeatureDataAdapter)
      .catch((e: unknown) => {
        this.summaryAdapterP = undefined
        throw e
      })
    return this.summaryAdapterP
  }

  // Per-species alignment-block rows for zoom-out rendering. Returns nothing
  // when no summaryAdapter is configured (callers fall back to the fetch gate).
  getSummaryFeatures(query: Region, opts?: BaseOptions) {
    return ObservableCreate<MafSummaryRecord>(async observer => {
      const adapter = await this.getSummaryAdapter()
      if (adapter) {
        await subscribeToObservable(adapter.getFeatures(query, opts), f => {
          observer.next({
            refName: f.get('refName'),
            start: f.get('start'),
            end: f.get('end'),
            src: f.get('src') as string,
            score: f.get('score')!,
            leftStatus: toMafStatus(f.get('leftStatus') as string | undefined),
            rightStatus: toMafStatus(
              f.get('rightStatus') as string | undefined,
            ),
          })
        })
      }
      observer.complete()
    }, opts?.stopToken)
  }

  // Compressed download-size estimate from the bigMaf.bb R-tree index, delegated
  // to the BigBed sub-adapter (the actual file). bigMaf is a full-feature
  // download — a whole-chromosome view can pull enough packed MAF stanzas to
  // hang the tab — so it must be byte-gated like any indexed track. NOT
  // `alwaysRender`: that self-summarizing exemption is for screen-reduced
  // adapters (BigWig), which bigMaf is not. The base
  // getMultiRegionFeatureDensityStats wraps this into `{ bytes }`.
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const { adapter } = await this.setupPre(opts)
    return adapter.getRegionByteSize(regions, opts)
  }
}
