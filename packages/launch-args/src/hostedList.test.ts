import { formatHostedGenomes, formatHostedTracks } from './hostedList.ts'

import type { Track } from './fileInput.ts'

const jb2export = { command: 'jb2export', out: 'out.svg' }

test('genomes are listed sorted, each with its organism and description', () => {
  const out = formatHostedGenomes(
    {
      hg19: { organism: 'Human', description: 'Feb. 2009 (GRCh37/hg19)' },
      danRer11: { organism: 'Zebrafish', description: 'May 2017 (GRCz11)' },
    },
    jb2export,
  )
  expect(out).toContain('UCSC assemblies on genomes.jbrowse.org (2)')
  expect(out.indexOf('danRer11')).toBeLessThan(out.indexOf('hg19'))
  expect(out).toContain('Human — Feb. 2009 (GRCh37/hg19)')
  expect(out).toContain('jb2export list <name> [filter]')
})

const tracks: Track[] = [
  {
    trackId: 'hg19-ncbiRefSeqCurated',
    name: 'NCBI RefSeq Curated',
    type: 'FeatureTrack',
  },
  { trackId: 'hg19-clinvarMain', name: 'ClinVar Main', type: 'FeatureTrack' },
]

test('tracks are listed by trackId, type and name, hinting the command', () => {
  const { text, matched } = formatHostedTracks('hg19', tracks, undefined, {
    command: 'jb2capture',
    out: 'out.png',
  })
  expect(matched).toBe(2)
  expect(text).toContain('Tracks in hg19 (2):')
  expect(text).toContain('hg19-ncbiRefSeqCurated')
  expect(text).toContain('FeatureTrack')
  expect(text).toContain('jb2capture --genome hg19 --track <trackId>')
  expect(text).toContain('--out out.png')
})

test('a filter matches case-insensitively on id or name', () => {
  const { text, matched } = formatHostedTracks(
    'hg19',
    tracks,
    'clinvar',
    jb2export,
  )
  expect(matched).toBe(1)
  expect(text).toContain('1 of 2 matching "clinvar"')
  expect(text).toContain('hg19-clinvarMain')
  expect(text).not.toContain('hg19-ncbiRefSeqCurated')
})

test('a filter matching nothing says so in the count', () => {
  const { text, matched } = formatHostedTracks(
    'hg19',
    tracks,
    'conservation',
    jb2export,
  )
  expect(matched).toBe(0)
  expect(text).toContain('0 of 2 matching "conservation"')
})
