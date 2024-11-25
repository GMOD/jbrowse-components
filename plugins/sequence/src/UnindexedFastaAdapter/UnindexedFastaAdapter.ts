import { readConfObject } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, NoAssemblyRegion } from '@jbrowse/core/util/types'

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
    const fastaLocation = this.getConf('fastaLocation') as FileLocation
    const res = parseSmallFasta(
      await openLocation(fastaLocation, this.pluginManager).readFile('utf8'),
    )

    return {
      fasta: new Map(
        [...res.entries()].map(([refName, val]) => {
          return [
            readConfObject(this.config, 'rewriteRefNames', { refName }) ||
              refName,
            val,
          ]
        }),
      ),
    }
  }

  public async getHeader() {
    const loc = this.getConf('metadataLocation')
    return loc.uri === '' || loc.uri === '/path/to/fa.metadata.yaml'
      ? null
      : openLocation(loc, this.pluginManager).readFile('utf8')
  }

  public async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
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

  public freeResources(/* { region } */): void {}
}
