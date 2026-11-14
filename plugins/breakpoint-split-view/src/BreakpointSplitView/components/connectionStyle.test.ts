import { alpha } from '@jbrowse/core/ui/palette'

import { CONNECTION_ALPHA, connectionKeyRows } from './connectionStyle.ts'

test('the key has one row per color, its labels joined once each', () => {
  const rows = connectionKeyRows([
    { kind: 'interchrom', color: '#800080', label: 'Inter-chromosomal' },
    { kind: 'pairRR', color: '#008080', label: 'RR pair' },
    { kind: 'splitSameStrand', color: '#008080', label: 'RR split' },
    { kind: 'pairRR', color: '#008080', label: 'RR pair' },
  ])
  expect(rows.map(r => r.label)).toEqual([
    'RR pair / RR split',
    'Inter-chromosomal',
  ])
  expect(rows[0]!.color).toBe(alpha('#008080', CONNECTION_ALPHA))
})

test('rows follow the connection kinds order, by the first kind of each', () => {
  const rows = connectionKeyRows([
    { kind: 'interchrom', color: 'a', label: 'A' },
    { kind: 'readPair', color: 'b', label: 'B' },
  ])
  expect(rows.map(r => r.label)).toEqual(['B', 'A'])
})

const chr10 = { refName: 'chr10', loc: 'chr10:600,001-600,199' }
const chr12 = { refName: 'chr12', loc: 'chr12:700,001-700,183' }

test('the connections through segments not in view key one row, last, naming where the reads went', () => {
  const grey = '#2e2e2e'
  const rows = connectionKeyRows([
    {
      kind: 'splitInverted',
      color: grey,
      label: 'Split read (segment not in view)',
      hiddenSegments: [chr10, chr12],
    },
    { kind: 'readPair', color: 'b', label: 'B' },
    {
      kind: 'splitSameStrand',
      color: grey,
      label: 'Split read (segment not in view)',
      hiddenSegments: [chr12, { refName: 'chr3', loc: 'chr3:1-10' }],
    },
  ])
  expect(rows.map(r => r.label)).toEqual([
    'B',
    'Split read via chr3, chr10, chr12 (not in view)',
  ])
})
