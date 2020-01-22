import { Observable } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { LocalFile } from 'generic-filehandle'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import Adapter from './CramAdapter'

function parseSmallFasta(text) {
  return text
    .split('>')
    .filter(t => /\S/.test(t))
    .map(entryText => {
      // eslint-disable-next-line prefer-const
      let [defLine, ...seqLines] = entryText.split('\n')
      // eslint-disable-next-line prefer-const
      let [id, ...description] = defLine.split(' ')
      description = description.join(' ')
      seqLines = seqLines.join('')
      const sequence = seqLines.replace(/\s/g, '')
      return { id, description, sequence }
    })
}

class FetchableSmallFasta {
  constructor(filehandle) {
    this.data = filehandle.readFile().then(buffer => {
      const text = buffer.toString('utf8')
      return parseSmallFasta(text)
    })
  }

  async fetch(id, start, end) {
    const data = await this.data
    const entry = data[id]
    const length = end - start + 1
    if (!entry) throw new Error(`no sequence with id ${id} exists`)
    return entry.sequence.substr(start - 1, length)
  }

  async getSequenceList() {
    const data = await this.data
    return data.map(entry => entry.id)
  }
}

class SequenceAdapter {
  constructor(filehandle) {
    this.fasta = new FetchableSmallFasta(filehandle)
  }

  getRefNames() {
    return this.refNames
  }

  getFeatures({ refName, start, end }) {
    return new Observable(async observer => {
      this.refNames = await this.fasta.getSequenceList()
      const ret = await this.fasta.fetch(
        this.refNames.indexOf(refName),
        start,
        end,
      )
      observer.next(
        new SimpleFeature({
          data: {
            uniqueId: `${refName}-${start}-${end}`,
            seq: ret,
            start,
            end,
          },
        }),
      )
      observer.complete()
    })
  }
}

test('adapter can fetch features from volvox-sorted.cram', async () => {
  const adapter = new Adapter({
    cramLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram'),
    },
    craiLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
    },
    sequenceAdapter: new SequenceAdapter(
      new LocalFile(require.resolve('../../test_data/volvox.fa')),
    ),
  })

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('ctgA')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(await adapter.refIdToName(0)).toBe('ctgA')
  expect(await adapter.refIdToName(1)).toBe(undefined)

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

test('test usage of cramSlightlyLazyFeature toJSON (used in the drawer widget)', async () => {
  const adapter = new Adapter({
    cramLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram'),
    },
    craiLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
    },
  })

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const f = featuresArray[0].toJSON()
  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(2)
  expect(f.end).toBe(102)
  // don't pass the mismatches to the frontend
  expect(f.mismatches).toEqual(undefined)
})

test('test usage of getMultiRegion stats, adapter can generate a domain', async () => {
  const adapter = new Adapter({
    cramLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram'),
    },
    craiLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
    },
  })

  const stats = await adapter.getMultiRegionStats(
    [
      {
        refName: 'ctgA',
        start: 0,
        end: 100,
        parentRegion: {
          refName: 'ctgA',
          start: 0,
          end: 10000,
        },
      },
    ],
    {
      opts: {
        signal: {
          aborted: false,
          onabort: null,
        },
        bpPerPx: 0.2,
      },
    },
    100,
  )

  expect(stats).toEqual(
    expect.objectContaining({
      scoreMin: 0,
      scoreMax: expect.any(Number),
    }),
  )
  expect(stats.scoreMax).toBeGreaterThan(0)
})
