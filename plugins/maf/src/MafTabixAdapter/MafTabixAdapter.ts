import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesFromConfig } from '../util/getSamples.ts'
import { lazyInit, loadSubAdapter } from '../util/loadSubAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import {
  matchSampleId,
  parseAssemblyAndChr,
  selectReferenceSequenceString,
} from '../util/parseAssemblyName.ts'

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class MafTabixAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<{ adapter: BaseFeatureDataAdapter }>

  async setupPre(
    opts?: BaseOptions,
  ): Promise<{ adapter: BaseFeatureDataAdapter }> {
    return lazyInit(this, () => loadSubAdapter(this, 'BedTabixAdapter', opts))
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
          const elt = data[j]!
          const parts = elt.split(':')

          const [assemblyAndChr, startStr, , , , seq] = parts

          if (!assemblyAndChr || !seq) {
            continue
          }

          // Known set → exact resolution (keeps the haplotype suffix, e.g.
          // `Species1.1`). No set → dot-position split to discover genomes.
          const parsed = sampleIds
            ? matchSampleId(assemblyAndChr, sampleIds)
            : parseAssemblyAndChr(assemblyAndChr)

          if (parsed?.assemblyName) {
            const { assemblyName, chr } = parsed
            if (!firstAssemblyNameFound) {
              firstAssemblyNameFound = assemblyName
            }

            alignments[assemblyName] = {
              chr,
              start: parseInt(startStr!, 10),
              seq,
            }
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
    return getSamplesFromConfig(key => this.getConf(key))
  }
}
