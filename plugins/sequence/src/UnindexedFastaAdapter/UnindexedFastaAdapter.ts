import {
  BaseSequenceAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { readOptionalMetadata } from '../chromSizesUtils.ts'
import { sequenceFeatures } from '../sequenceFeatures.ts'

import type { UnindexedFastaAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

// Split on a '>' that starts a line, not on every '>': a description line is
// free text and may well contain one ("gene A>B"), and splitting there both
// invents a contig out of the tail of the description and leaves the real
// contig with an empty sequence — silently, since every piece still parses.
function parseSmallFasta(text: string) {
  return new Map(
    text
      .split(/^>/m)
      .filter(t => /\S/.test(t))
      .map(entryText => {
        const [defLine, ...seqLines] = entryText.split(/\r?\n/)
        // any whitespace ends the name, as samtools does it, so a tab-separated
        // description doesn't get folded into the refName
        const [id, ...description] = defLine!.split(/\s+/)
        const sequence = seqLines.join('').replaceAll(/\s/g, '')
        return [
          id!,
          {
            description: description.join(' '),
            sequence,
          },
        ] as const
      }),
  )
}

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
    const res = await updateStatus('Parsing FASTA', opts?.statusCallback, () =>
      parseSmallFasta(text),
    )

    const fasta = new Map<string, { description: string; sequence: string }>()
    for (const [refName, val] of res) {
      const name = this.getConf('rewriteRefNames', { refName }) || refName
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
        getSequenceSize: async refName => fasta.get(refName)?.sequence.length,
        getSequence: async (refName, start, end) =>
          fasta.get(refName)?.sequence.slice(start, end),
      }
    })
  }
}
