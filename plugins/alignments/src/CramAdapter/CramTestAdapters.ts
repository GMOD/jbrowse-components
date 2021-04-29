import { GenericFilehandle } from 'generic-filehandle'
import { Observable } from 'rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

// setup for Cram Adapter Testing
export function parseSmallFasta(text: string) {
  return text
    .split('>')
    .filter(t => /\S/.test(t))
    .map(entryText => {
      const [defLine, ...seqLines] = entryText.split('\n')
      const [id, ...descriptionLines] = defLine.split(' ')
      const description = descriptionLines.join(' ')
      const sequence = seqLines.join('').replace(/\s/g, '')
      return { id, description, sequence }
    })
}

type FileHandle = GenericFilehandle

export class FetchableSmallFasta {
  data: Promise<ReturnType<typeof parseSmallFasta>>

  constructor(filehandle: FileHandle) {
    this.data = filehandle.readFile().then(buffer => {
      const text = buffer.toString('utf8')
      return parseSmallFasta(text)
    })
  }

  async fetch(id: number, start: number, end: number) {
    const data = await this.data
    const entry = data[id]
    const length = end - start + 1
    if (!entry) {
      throw new Error(`no sequence with id ${id} exists`)
    }
    return entry.sequence.substr(start - 1, length)
  }

  async getSequenceList() {
    const data = await this.data
    return data.map(entry => entry.id)
  }
}

export class SequenceAdapter extends BaseFeatureDataAdapter {
  fasta: FetchableSmallFasta

  refNames: string[] = []

  constructor(filehandle: FileHandle) {
    super()
    this.fasta = new FetchableSmallFasta(filehandle)
  }

  async getRefNames() {
    return this.refNames
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
              seq: ret,
              start,
              end,
            }),
          )
          observer.complete()
        })
      return { unsubscribe: () => {} }
    })
  }

  freeResources(/* { region } */): void {}
}
