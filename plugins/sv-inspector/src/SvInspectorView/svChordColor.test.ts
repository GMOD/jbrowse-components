import { SimpleFeature } from '@jbrowse/core/util'

import { chordColorForType, svChordColor } from './svChordColor.ts'

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

// the legend has counted its classes and no longer holds a record of each, so
// it paints from the class alone — and has to land on the same color
test('a class alone gets the color its records get', () => {
  expect(chordColorForType('DEL')).toBe(
    svChordColor(new SimpleFeature(del('a'))),
  )
})

test('a record that is not a structural variant still gets a color', () => {
  expect(svChordColor(new SimpleFeature(feat('snv', { ALT: ['G'] })))).toMatch(
    /^rgba\(/,
  )
})
