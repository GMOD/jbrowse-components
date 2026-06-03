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

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

const WHITESPACE_REGEX = / +/

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

      await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
        const maf = feature.get('mafBlock') as string
        const blocks = maf.split(';')
        const alignments: Record<string, AlignmentRecord> = {}
        let referenceSeq: string | undefined

        for (const block of blocks) {
          if (block.startsWith('s')) {
            const parts = block.split(WHITESPACE_REGEX)
            const sequence = parts[6]!
            const organismChr = parts[1]!

            referenceSeq ??= sequence

            const parsed = sampleIds
              ? matchSampleId(organismChr, sampleIds)
              : parseAssemblyAndChrSimple(organismChr)

            if (parsed?.assemblyName) {
              alignments[parsed.assemblyName] = {
                chr: parsed.chr,
                start: parseInt(parts[2]!, 10),
                seq: sequence,
              }
            }
          }
        }

        observer.next(
          new MafFeature(
            feature.id(),
            feature.get('start'),
            feature.get('end'),
            feature.get('refName'),
            0, // strand not in BigMaf format
            alignments,
            referenceSeq ?? '',
          ),
        )
      })

      observer.complete()
    }, opts?.stopToken)
  }

  async getSamples() {
    return getSamplesFromConfig(key => this.getConf(key))
  }
}
