import { fetchJb1 } from './jb1ConfigLoad.ts'

import type { Track } from './types.ts'

const files: Record<string, string> = {}

beforeEach(() => {
  for (const k of Object.keys(files)) {
    delete files[k]
  }
  global.fetch = jest.fn(async (url: unknown) => {
    const body = files[`${url}`]
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(body, { status: 200 })
  }) as typeof fetch
})

const dataDir = {
  uri: 'https://example.com/data/',
  locationType: 'UriLocation',
} as const

const labels = (tracks: Track[]) => tracks.map(t => t.label)

test('reads tracks out of trackList.json', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    tracks: [{ label: 'genes', key: 'Genes', urlTemplate: 'g.bam' }],
  })
  const { tracks, dataRoot } = await fetchJb1(dataDir)
  expect(labels(tracks as Track[])).toEqual(['genes'])
  expect(dataRoot).toBe('https://example.com/data')
})

test('a data directory with no tracks.conf still loads', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    tracks: [{ label: 'genes', urlTemplate: 'g.bam' }],
  })
  const { tracks } = await fetchJb1(dataDir)
  expect(labels(tracks as Track[])).toEqual(['genes'])
})

test('a data directory with neither file yields no tracks', async () => {
  const { tracks } = await fetchJb1(dataDir)
  expect(tracks).toEqual([])
})

test('reads the object-keyed tracks form', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    tracks: { genes: { key: 'Genes', urlTemplate: 'g.bam' } },
  })
  const { tracks } = await fetchJb1(dataDir)
  expect(labels(tracks as Track[])).toEqual(['genes'])
})

test('reads tracks.conf sections and merges them with trackList.json', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    tracks: [{ label: 'genes', urlTemplate: 'g.bam' }],
  })
  files['https://example.com/data/tracks.conf'] = [
    '[tracks.coverage]',
    'key = Coverage',
    'urlTemplate = cov.bw',
    'storeClass = JBrowse/Store/SeqFeature/BigWig',
  ].join('\n')
  const { tracks } = await fetchJb1(dataDir)
  expect(labels(tracks as Track[])).toEqual(['genes', 'coverage'])
  expect((tracks as Track[])[1]!.storeClass).toBe(
    'JBrowse/Store/SeqFeature/BigWig',
  )
})

test('follows an include, once', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    include: ['more.json', 'more.json'],
    tracks: [{ label: 'genes', urlTemplate: 'g.bam' }],
  })
  files['https://example.com/data/more.json'] = JSON.stringify({
    tracks: [{ label: 'extra', urlTemplate: 'e.bam' }],
  })
  const { tracks } = await fetchJb1(dataDir)
  expect(labels(tracks as Track[])).toEqual(['genes', 'extra'])
})

test('an include cycle terminates', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    include: 'more.json',
    tracks: [{ label: 'genes', urlTemplate: 'g.bam' }],
  })
  files['https://example.com/data/more.json'] = JSON.stringify({
    include: 'trackList.json',
    tracks: [{ label: 'extra', urlTemplate: 'e.bam' }],
  })
  const { tracks } = await fetchJb1(dataDir)
  expect(labels(tracks as Track[])).toEqual(['genes', 'extra'])
})

test('fills {dataRoot} in track values', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    tracks: [{ label: 'genes', urlTemplate: '{dataRoot}/sub/g.bam' }],
  })
  const { tracks } = await fetchJb1(dataDir)
  expect((tracks as Track[])[0]!.urlTemplate).toBe(
    'https://example.com/data/sub/g.bam',
  )
})

test('hoists a track config subobject, with the outer keys winning', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    tracks: [
      {
        label: 'genes',
        key: 'Outer',
        config: { key: 'Inner', urlTemplate: 'g.bam' },
      },
    ],
  })
  const { tracks } = await fetchJb1(dataDir)
  expect((tracks as Track[])[0]).toEqual({
    label: 'genes',
    key: 'Outer',
    urlTemplate: 'g.bam',
  })
})

test('leaves NCList {refseq} alone', async () => {
  files['https://example.com/data/trackList.json'] = JSON.stringify({
    tracks: [{ label: 'genes', urlTemplate: 'tracks/g/{refseq}/t.json' }],
  })
  const { tracks } = await fetchJb1(dataDir)
  expect((tracks as Track[])[0]!.urlTemplate).toBe('tracks/g/{refseq}/t.json')
})
