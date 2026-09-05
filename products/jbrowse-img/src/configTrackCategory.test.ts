import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { configTrackCategory } from './applyTrackOpts.ts'
import { trackTypes } from './makeConfigs.ts'
import { readData } from './readData.ts'

import type { Track } from './types.ts'

const tracks: Track[] = [
  { trackId: 'aln', type: 'AlignmentsTrack' },
  { trackId: 'cov', type: 'QuantitativeTrack' },
  { trackId: 'vars', type: 'VariantTrack' },
  { trackId: 'genes', type: 'FeatureTrack' },
  { trackId: 'contacts', type: 'HicTrack' },
]

test('config track type maps to a display category', () => {
  expect(configTrackCategory(tracks, 'aln')).toBe('alignments')
  expect(configTrackCategory(tracks, 'cov')).toBe('wiggle')
  expect(configTrackCategory(tracks, 'vars')).toBe('variant')
  expect(configTrackCategory(tracks, 'genes')).toBe('feature')
  expect(configTrackCategory(tracks, 'contacts')).toBe('hic')
})

test('unknown or missing trackId falls back to feature', () => {
  expect(configTrackCategory(tracks, 'nope')).toBe('feature')
  expect(configTrackCategory([{ trackId: 'x' }], 'x')).toBe('feature')
})

// A CLI file-type flag used to carry its own hand-written category map, parallel
// to (and independently editable from) this one. A flag's track now goes into
// the config like any other and its category is read back off that, so this
// walks every flag through the real path: a new --flag whose track type has no
// category entry shows up here rather than silently driving a feature display.
test('every CLI file-type flag resolves to its display category', () => {
  const byFlag = Object.fromEntries(
    trackTypes.map(flag => {
      const file = flag === 'multiwig' ? 'a.bw,b.bw' : `input.${flag}`
      const data = readData({
        fasta: '/ref.fa',
        trackList: [[flag, [file]]],
      })
      return [flag, configTrackCategory(data.tracks, file)]
    }),
  )
  expect(byFlag).toEqual({
    bam: 'alignments',
    cram: 'alignments',
    bigwig: 'wiggle',
    multiwig: 'wiggle',
    vcfgz: 'variant',
    gffgz: 'feature',
    bigbed: 'feature',
    bedgz: 'feature',
    hic: 'hic',
  })
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
        { trackId: 'genes', type: 'FeatureTrack', name: 'from --tracks' },
        { trackId: 'variants', type: 'VariantTrack', name: 'from --tracks' },
      ]),
    )
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('--tracks adds to the config tracks rather than replacing them', () => {
    const data = readData({ config: configFile, tracks: tracksFile })
    expect(data.tracks.map(t => t.trackId)).toEqual([
      'genes',
      'coverage',
      'variants',
    ])
  })

  test('a --tracks entry overrides the config track with the same id', () => {
    const data = readData({ config: configFile, tracks: tracksFile })
    expect(data.tracks.find(t => t.trackId === 'genes')?.name).toBe(
      'from --tracks',
    )
    expect(data.tracks.find(t => t.trackId === 'coverage')?.name).toBe(
      'from config',
    )
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
