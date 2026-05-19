import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import MafFeature from '../MafFeature.ts'
import { getSamplesFromConfig } from '../util/getSamples.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import { parseAssemblyAndChrSimple } from '../util/parseAssemblyName.ts'

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

const WHITESPACE_REGEX = / +/

export default class BigMafAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<{ adapter: BaseFeatureDataAdapter }>

  async setup() {
    if (!this.getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    return {
      adapter: (
        await this.getSubAdapter({
          ...getSnapshot(this.config),
          type: 'BigBedAdapter',
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

      const sampleFilter = opts?.samples
        ? new Set(opts.samples.map(s => s.id))
        : undefined

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

            const { assemblyName: org, chr } =
              parseAssemblyAndChrSimple(organismChr)

            referenceSeq ??= sequence

            if (sampleFilter && !sampleFilter.has(org)) {
              continue
            }

            alignments[org] = {
              chr,
              start: +parts[2]!,
              seq: sequence,
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
