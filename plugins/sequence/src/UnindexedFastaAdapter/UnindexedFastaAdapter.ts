import { readConfObject } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

function parseSmallFasta(text: string) {
  return new Map(
    text
      .split('>')
      .filter(t => /\S/.test(t))
      .map(entryText => {
        const [defLine, ...seqLines] = entryText.split('\n')
        const [id, ...description] = defLine!.split(' ')
        const sequence = seqLines.join('').replace(/\s/g, '')
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

export default class UnindexedFastaAdapter extends BaseSequenceAdapter {
  protected setupP?: Promise<{
    fasta: ReturnType<typeof parseSmallFasta>
  }>

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

  public async setupPre(_opts?: BaseOptions) {
    const res = parseSmallFasta(
      await openLocation(
        this.getConf('fastaLocation'),
        this.pluginManager,
      ).readFile('utf8'),
    )

    const fasta = new Map<string, { description: string; sequence: string }>()
    for (const [refName, val] of res) {
      const name =
        readConfObject(this.config, 'rewriteRefNames', { refName }) || refName
      fasta.set(name, val)
    }
    return { fasta }
  }

  public async getHeader() {
    const loc = this.getConf('metadataLocation')
    return loc.uri === '' || loc.uri === '/path/to/fa.metadata.yaml'
      ? null
      : openLocation(loc, this.pluginManager).readFile('utf8')
  }

  public async setup(opts?: BaseOptions) {
    this.setupP ??= this.setupPre(opts).catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    const { refName, start, end } = region
    return ObservableCreate<Feature>(async observer => {
      const { fasta } = await this.setup(opts)
      const entry = fasta.get(refName)
      if (entry) {
        observer.next(
          new SimpleFeature({
            id: `${refName}-${start}-${end}`,
            data: {
              refName,
              start,
              end,
              seq: entry.sequence.slice(start, end),
            },
          }),
        )
      }
      observer.complete()
    })
  }
}
