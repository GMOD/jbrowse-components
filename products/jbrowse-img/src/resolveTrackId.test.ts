import { resolveTrackId } from './applyTrackOpts.ts'

import type { Track } from './types.ts'

const tracks: Track[] = [
  { trackId: 'hg19-ncbiRefSeqCurated', name: 'NCBI RefSeq Curated' },
  { trackId: 'hg19-clinvarMain', name: 'ClinVar Main' },
  { trackId: 'hg19-phyloP100way', name: 'phyloP 100way' },
]

test('exact trackId resolves as-is', () => {
  expect(resolveTrackId(tracks, 'hg19-clinvarMain', 'hg19')).toBe(
    'hg19-clinvarMain',
  )
})

test('assembly-name prefix is filled in automatically', () => {
  expect(resolveTrackId(tracks, 'ncbiRefSeqCurated', 'hg19')).toBe(
    'hg19-ncbiRefSeqCurated',
  )
})

test('case-insensitive id and display-name matching', () => {
  expect(resolveTrackId(tracks, 'NCBIREFSEQCURATED', 'hg19')).toBe(
    'hg19-ncbiRefSeqCurated',
  )
  expect(resolveTrackId(tracks, 'clinvar main', 'hg19')).toBe(
    'hg19-clinvarMain',
  )
})

test('a miss throws with substring suggestions', () => {
  expect(() => resolveTrackId(tracks, 'clinvar', 'hg19')).toThrow(
    /Did you mean: hg19-clinvarMain/,
  )
})

test('an unrelated miss throws without suggestions', () => {
  expect(() => resolveTrackId(tracks, 'nonexistent-xyz', 'hg19')).toThrow(
    /not found in the config$/,
  )
})
