import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { readData } from './readData.ts'

test('a config assembly written as { name, uri } gets its sequence track', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-shorthand-'))
  const configFile = path.join(tmpDir, 'config.json')
  fs.writeFileSync(
    configFile,
    JSON.stringify({ assemblies: [{ name: 'volvox', uri: 'volvox.fa' }] }),
  )
  try {
    const { assembly } = readData({ config: configFile })
    expect(assembly.sequence).toEqual({
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox-ReferenceSequenceTrack',
      adapter: {
        uri: 'volvox.fa',
        baseUri: pathToFileURL(`${tmpDir}${path.sep}`).href,
      },
    })
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('a uri relative to a --config file is a file beside it', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readData-relative-'))
  const configFile = path.join(tmpDir, 'config.json')
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      assemblies: [{ name: 'vv', uri: 'vv.fa' }],
      tracks: [
        {
          trackId: 'reads',
          type: 'AlignmentsTrack',
          assemblyNames: ['vv'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: { uri: 'reads/t.bam' },
            index: { location: { uri: 'https://example.org/t.bam.bai' } },
          },
        },
      ],
    }),
  )
  try {
    const { tracks } = readData({ config: configFile })
    const { bamLocation, index } = tracks[0]!.adapter as {
      bamLocation: { uri: string; baseUri: string }
      index: { location: { uri: string; baseUri: string } }
    }
    const base = pathToFileURL(`${tmpDir}${path.sep}`).href
    expect(new URL(bamLocation.uri, bamLocation.baseUri).href).toBe(
      `${base}reads/t.bam`,
    )
    // a uri that names its own host keeps it
    expect(new URL(index.location.uri, index.location.baseUri).href).toBe(
      'https://example.org/t.bam.bai',
    )
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('readData with a config', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-readData-'))
  const configFile = path.join(tmpDir, 'config.json')
  const tracksFile = path.join(tmpDir, 'tracks.json')

  beforeAll(() => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        assemblies: [
          {
            name: 'hg38',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'hg38-ref',
              adapter: { type: 'IndexedFastaAdapter' },
            },
          },
        ],
        tracks: [
          { trackId: 'genes', type: 'FeatureTrack', name: 'from config' },
          {
            trackId: 'coverage',
            type: 'QuantitativeTrack',
            name: 'from config',
          },
        ],
      }),
    )
    fs.writeFileSync(
      tracksFile,
      JSON.stringify([
        { trackId: 'genes', type: 'FeatureTrack', name: 'from --trackConfigs' },
        {
          trackId: 'variants',
          type: 'VariantTrack',
          name: 'from --trackConfigs',
        },
      ]),
    )
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('--trackConfigs adds to the config tracks rather than replacing them', () => {
    const data = readData({ config: configFile, trackConfigs: tracksFile })
    expect(data.tracks.map(t => t.trackId)).toEqual([
      'genes',
      'coverage',
      'variants',
    ])
  })

  test('a --trackConfigs entry overrides the config track with the same id', () => {
    const data = readData({ config: configFile, trackConfigs: tracksFile })
    expect(data.tracks.find(t => t.trackId === 'genes')?.name).toBe(
      'from --trackConfigs',
    )
    expect(data.tracks.find(t => t.trackId === 'coverage')?.name).toBe(
      'from config',
    )
  })

  test('--assembly finds an assembly by one of its aliases', () => {
    const aliased = path.join(tmpDir, 'aliased.json')
    fs.writeFileSync(
      aliased,
      JSON.stringify({
        assemblies: [
          { name: 'hs1', sequence: {} },
          { name: 'hg38', aliases: ['GRCh38'], sequence: {} },
        ],
      }),
    )
    expect(
      readData({ config: aliased, assembly: 'GRCh38' }).assembly.name,
    ).toBe('hg38')
  })

  test('an --assembly naming a directory is a name to look up, not JSON to read', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hg38-'))
    try {
      expect(() => readData({ config: configFile, assembly: dir })).toThrow(
        `assembly ${dir} not found in config`,
      )
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

test('a bare genome file is the genome when the track list holds a modified copy of its entry', () => {
  const data = readData({
    argv: [
      ['file', ['ref.fa']],
      ['file', ['reads.bam']],
    ],
    trackList: [
      ['file', ['ref.fa', 'force:true']],
      ['file', ['reads.bam', 'force:true']],
    ],
  })
  expect(data.assembly.name).toBe('ref.fa')
  expect(data.tracks.map(t => t.trackId)).toEqual(['reads.bam'])
})

test('a fetched config is read, not changed, so a batch can hand it to every record', () => {
  const fetched = {
    assemblies: [{ name: 'hg38', sequence: {} }],
    tracks: [{ trackId: 'genes', type: 'FeatureTrack' }],
  }
  const before = structuredClone(fetched)
  const opts = { trackList: [['bam', ['reads.bam']]] as [string, string[]][] }
  readData(opts, fetched)
  const second = readData(opts, fetched)
  expect(fetched).toEqual(before)
  expect(second.tracks.map(t => t.trackId)).toEqual(['genes', 'reads.bam'])
})
