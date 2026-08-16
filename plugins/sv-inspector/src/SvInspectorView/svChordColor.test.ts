import { SimpleFeature } from '@jbrowse/core/util'

import { svChordColor, svTypeTallies } from './svChordColor.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

function feat(id: string, rest: Record<string, unknown>) {
  return {
    uniqueId: id,
    refName: 'chr1',
    start: 0,
    end: 1,
    ...rest,
  } as SimpleFeatureSerialized
}

const del = (id: string) => feat(id, { ALT: ['<DEL>'] })
const dup = (id: string) => feat(id, { ALT: ['<DUP:TANDEM>'] })
const bnd = (id: string) => feat(id, { ALT: ['C]chr13:11435321]'] })

test('a chord color is translucent, so overlapping chords still read', () => {
  const color = svChordColor(new SimpleFeature(del('a')))
  expect(color).toMatch(/^rgba\(/)
  expect(color).toContain('0.45')
})

test('the class decides the color, not the record', () => {
  expect(svChordColor(new SimpleFeature(del('a')))).toBe(
    svChordColor(new SimpleFeature(del('b'))),
  )
  expect(svChordColor(new SimpleFeature(del('a')))).not.toBe(
    svChordColor(new SimpleFeature(dup('c'))),
  )
})

test('tallies count each class and carry the color the chords use', () => {
  const tallies = svTypeTallies([del('a'), del('b'), bnd('c')])
  expect(tallies).toEqual([
    {
      type: 'DEL',
      label: 'Deletion',
      color: svChordColor(new SimpleFeature(del('a'))),
      count: 2,
    },
    {
      type: 'BND',
      label: 'Breakend',
      color: svChordColor(new SimpleFeature(bnd('c'))),
      count: 1,
    },
  ])
})

// canonical order, not the order the rows happen to arrive in, so the legend
// does not reshuffle itself as a filter changes which class is seen first
test('tallies come back in canonical order', () => {
  expect(
    svTypeTallies([bnd('a'), dup('b'), del('c')]).map(t => t.type),
  ).toEqual(['DEL', 'DUP', 'BND'])
})

test('a record that is not a structural variant is left out', () => {
  expect(svTypeTallies([feat('snv', { ALT: ['G'] })])).toEqual([])
})
