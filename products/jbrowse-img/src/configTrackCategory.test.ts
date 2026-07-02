import { configTrackCategory } from './applyTrackOpts.ts'

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
