import { categoryForTrackType, configTrackCategory } from './applyTrackOpts.ts'
import { trackTypeForFlag, trackTypes } from './makeConfigs.ts'

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
// to (and independently editable from) the config-track-type one. It now derives
// through makeConfigs' flag -> track type map, so this pins the composed result:
// a new --flag with no category entry shows up here rather than silently driving
// a feature display.
test('every CLI file-type flag resolves to its display category', () => {
  const byFlag = Object.fromEntries(
    trackTypes.map(flag => [
      flag,
      categoryForTrackType(trackTypeForFlag(flag)),
    ]),
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
