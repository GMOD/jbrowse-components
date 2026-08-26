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
      // the id readData actually assigned, not one recomputed from the file:
      // that derivation is the flag's business (a --multiwig list has no single
      // filename to be named after), and this test is about the category.
      return [
        flag,
        configTrackCategory(data.tracks, data.openTracks![0]!.trackId),
      ]
    }),
  )
  expect(byFlag).toEqual({
    bam: 'alignments',
    cram: 'alignments',
    bigwig: 'wiggle',
    multiwig: 'wiggle',
    vcfgz: 'variant',
    gffgz: 'feature',
    gff: 'feature',
    bigbed: 'feature',
    bedgz: 'feature',
    hic: 'hic',
  })
})
