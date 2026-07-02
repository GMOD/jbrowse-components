import { formatAssemblies, formatTracks } from './list.ts'

import type { Track } from './types.ts'

test('formatAssemblies lists names sorted with organism/description', () => {
  const out = formatAssemblies({
    hg19: { organism: 'Human', description: 'Feb. 2009 (GRCh37/hg19)' },
    danRer11: { organism: 'Zebrafish', description: 'May 2017 (GRCz11)' },
  })
  expect(out).toContain('Assemblies on genomes.jbrowse.org (2):')
  // sorted: danRer11 before hg19
  expect(out.indexOf('danRer11')).toBeLessThan(out.indexOf('hg19'))
  expect(out).toContain('Human — Feb. 2009 (GRCh37/hg19)')
})

const tracks: Track[] = [
  {
    trackId: 'hg19-ncbiRefSeqCurated',
    name: 'NCBI RefSeq Curated',
    type: 'FeatureTrack',
  },
  { trackId: 'hg19-clinvarMain', name: 'ClinVar Main', type: 'FeatureTrack' },
]

test('formatTracks lists trackId, type and name', () => {
  const out = formatTracks('hg19', tracks)
  expect(out).toContain('Tracks in hg19 (2):')
  expect(out).toContain('hg19-ncbiRefSeqCurated')
  expect(out).toContain('FeatureTrack')
})

test('formatTracks filters case-insensitively on id or name', () => {
  const out = formatTracks('hg19', tracks, 'clinvar')
  expect(out).toContain('1 of 2 matching "clinvar"')
  expect(out).toContain('hg19-clinvarMain')
  expect(out).not.toContain('hg19-ncbiRefSeqCurated')
})
