import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import MafFeature from '../MafFeature.ts'
import { getSamplesFromConfig } from '../util/getSamples.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'
import { parseAssemblyAndChrSimple } from '../util/parseAssemblyName.ts'

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
import type { Feature, Region } from '@jbrowse/core/util'

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
  async setupPre() {
    this.setupP ??= this.setup().catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  async getRefNames() {
    const { adapter } = await this.setupPre()
    return adapter.getRefNames()
  }

  async getHeader() {
    const { adapter } = await this.setupPre()
    return adapter.getHeader()
  }

  getFeatures(query: Region, opts?: MafAdapterOptions) {
    const WHITESPACE_REGEX = / +/

    return ObservableCreate<Feature>(async observer => {
      const { adapter } = await this.setupPre()

      const sampleFilter = opts?.samples
        ? new Set(opts.samples.map(s => s.id))
        : undefined

      await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
        const maf = feature.get('mafBlock') as string
        const blocks = maf.split(';')
        const alignments = {} as Record<string, AlignmentRecord>
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
              srcSize: +parts[3]!,
              strand: parts[4] === '+' ? 1 : -1,
              unknown: +parts[5]!,
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

  async getSamples(_query: Region) {
    return getSamplesFromConfig(this.getConf.bind(this))
  }

  freeResources(): void {}
}
