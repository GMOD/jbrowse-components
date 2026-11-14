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

test('the connections through regions not shown key one fixed row, last', () => {
  const grey = '#2e2e2e'
  const rows = connectionKeyRows([
    {
      kind: 'splitInverted',
      color: grey,
      label: 'Split read (skips parts aligned outside this view)',
      throughHidden: true,
    },
    { kind: 'readPair', color: 'b', label: 'B' },
    {
      kind: 'splitSameStrand',
      color: grey,
      label: 'Split read (skips parts aligned outside this view)',
      throughHidden: true,
    },
  ])
  expect(rows.map(r => r.label)).toEqual([
    'B',
    'Split read (skips parts aligned outside this view)',
  ])
})
