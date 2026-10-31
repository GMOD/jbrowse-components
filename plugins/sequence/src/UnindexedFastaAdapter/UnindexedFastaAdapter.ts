import { parseSmallFasta } from '@gmod/indexedfasta'
import {
  BaseSequenceAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { readOptionalMetadata } from '../fastaUtils.ts'
import { sequenceFeatures } from '../sequenceFeatures.ts'

import type { UnindexedFastaAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class UnindexedFastaAdapter extends BaseSequenceAdapter<UnindexedFastaAdapterConfig> {
  public async getRefNames(opts?: BaseOptions) {
    const { fasta } = await this.setup(opts)
    return [...fasta.keys()]
  }

  public async getRegions(opts?: BaseOptions) {
    const { fasta } = await this.setup(opts)
    return [...fasta.entries()].map(([refName, data]) => ({
      refName,
      start: 0,
      end: data.sequence.length,
    }))
  }

  // No `label`: `fetchAndMaybeUnzipText` narrates the download from inside.
  setup = cachedSetup({ setup: opts => this.setupPre(opts) })

  public async setupPre(opts?: BaseOptions) {
    const text = await fetchAndMaybeUnzipText(
      openLocation(this.getConf('fastaLocation'), this.pluginManager),
      opts,
      'Downloading sequence',
    )
    const res = await updateStatus(
      'Processing sequence',
      opts?.statusCallback,
      () => parseSmallFasta(text),
    )

    const fasta = new Map<string, { description: string; sequence: string }>()
    for (const { id, ...val } of res) {
      const name = this.getConf('rewriteRefNames', { refName: id }) || id
      fasta.set(name, val)
    }
    return { fasta }
  }

  public async getHeader() {
    return readOptionalMetadata(
      this.getConf('metadataLocation'),
      this.pluginManager,
    )
  }

  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    return sequenceFeatures(region, opts, async () => {
      const { fasta } = await this.setup(opts)
      return {
        getSequence: async (refName, start, end) =>
          fasta.get(refName)?.sequence.slice(start, end),
      }
    })
  }
}
