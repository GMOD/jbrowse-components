import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { LocalFile } from 'generic-filehandle2'
import { Observable } from 'rxjs'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { GenericFilehandle } from 'generic-filehandle2'

// setup for Cram Adapter Testing
export function parseSmallFasta(text: string) {
  return text
    .split('>')
    .filter(t => /\S/.test(t))
    .map(entryText => {
      const [defLine, ...seqLines] = entryText.split(/\n|\r\n|\r/)
      const [id, ...descriptionLines] = defLine!.split(' ')
      const description = descriptionLines.join(' ')
      const sequence = seqLines.join('').replaceAll(/\s/g, '')
      return {
        id: id!,
        description,
        sequence,
      }
    })
}

type FileHandle = GenericFilehandle

class FetchableSmallFasta {
  data: Promise<ReturnType<typeof parseSmallFasta>>

  constructor(filehandle: FileHandle) {
    this.data = filehandle.readFile().then(buffer => {
      const decoder = new TextDecoder('utf8')
      const text = decoder.decode(buffer)
      return parseSmallFasta(text)
    })
  }

  async fetch(id: number, start: number, end: number) {
    const data = await this.data
    const entry = data[id]
    if (!entry) {
      throw new Error(`no sequence with id ${id} exists`)
    }
    return entry.sequence.slice(start, end)
  }

  async getSequenceList() {
    const data = await this.data
    return data.map(entry => entry.id)
  }
}

export class SequenceAdapter extends BaseSequenceAdapter {
  fasta: FetchableSmallFasta

  refNames: string[] = []

  constructor(filehandle: FileHandle) {
    super(ConfigurationSchema('empty', {}).create())
    this.fasta = new FetchableSmallFasta(filehandle)
  }

  async getRefNames() {
    if (this.refNames.length === 0) {
      this.refNames = await this.fasta.getSequenceList()
    }
    return this.refNames
  }

  async getRegions() {
    return []
  }

  getFeatures({
    refName,
    start,
    end,
  }: {
    refName: string
    start: number
    end: number
  }): Observable<SimpleFeature> {
    return new Observable(observer => {
      this.fasta
        .getSequenceList()
        .then(refNames => {
          this.refNames = refNames
        })
        .then(() =>
          this.fasta.fetch(this.refNames.indexOf(refName), start, end),
        )
        .then(ret => {
          observer.next(
            new SimpleFeature({
              uniqueId: `${refName}-${start}-${end}`,
              refName,
              seq: ret,
              start,
              end,
            }),
          )
          observer.complete()
        })
        .catch((e: unknown) => {
          observer.error(e)
        })
      return { unsubscribe: () => {} }
    })
  }
}

/**
 * The reference an alignments test builds its adapter with, the way the RPC
 * path does: `volvoxReference` stands in for the assembly's sequence adapter
 * config, and the sub-adapter ignores it and answers with volvox.fa.
 */
export const volvoxReference = { type: 'TestSequenceAdapter' }

export const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new SequenceAdapter(
    new LocalFile(require.resolve('../../test_data/volvox.fa')),
  ),
  sessionIds: new Set(),
})
