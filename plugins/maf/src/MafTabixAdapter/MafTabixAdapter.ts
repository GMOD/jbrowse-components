import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import MafFeature from '../MafFeature.ts'
import { getSamplesFromConfig } from '../util/getSamples.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import {
  parseAssemblyAndChr,
  selectReferenceSequenceString,
} from '../util/parseAssemblyName.ts'

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class MafTabixAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<{ adapter: BaseFeatureDataAdapter }>

  async setup() {
    if (!this.getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    return {
      adapter: (
        await this.getSubAdapter({
          ...getSnapshot(this.config),
          type: 'BedTabixAdapter',
        })
      ).dataAdapter as BaseFeatureDataAdapter,
    }
  }

  async setupPre(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    this.setupP ??= updateStatus('Downloading index', statusCallback, () =>
      this.setup(),
    ).catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
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
      let firstAssemblyNameFound = ''
      const refAssemblyName = this.getConf('refAssemblyName')

      const sampleFilter = opts?.samples
        ? new Set(opts.samples.map(s => s.id))
        : undefined

      await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
        const data = (feature.get('field5') as string).split(',')
        const alignments = {} as Record<string, AlignmentRecord>

        for (let j = 0, l = data.length; j < l; j++) {
          const elt = data[j]!
          const parts = elt.split(':')

          const [
            assemblyAndChr,
            startStr,
            srcSizeStr,
            strandStr,
            unknownStr,
            seq,
          ] = parts

          if (!assemblyAndChr || !seq) {
            continue
          }

          const { assemblyName, chr } = parseAssemblyAndChr(assemblyAndChr)

          if (assemblyName) {
            if (!firstAssemblyNameFound) {
              firstAssemblyNameFound = assemblyName
            }

            if (sampleFilter && !sampleFilter.has(assemblyName)) {
              continue
            }

            alignments[assemblyName] = {
              chr,
              start: +startStr!,
              srcSize: +srcSizeStr!,
              strand: strandStr === '-' ? -1 : 1,
              unknown: +unknownStr!,
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
    return getSamplesFromConfig(this.getConf.bind(this))
  }

  freeResources(): void {}
}
