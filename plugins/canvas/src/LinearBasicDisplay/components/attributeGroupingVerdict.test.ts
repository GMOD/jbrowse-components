import { MAX_GROUPS } from '@jbrowse/core/util/groupKeys'

import {
  attributeGroupingVerdict,
  sectionCountHint,
} from './attributeGroupingVerdict.ts'

const scan = [
  {
    field: 'biotype',
    values: ['lncRNA', 'protein_coding'],
    missing: true,
    overflow: false,
  },
  { field: 'name', values: [], missing: false, overflow: true },
]

test('nothing to say without a field, a scan, or over a jexl expression', () => {
  expect(attributeGroupingVerdict('', scan)).toBeUndefined()
  expect(attributeGroupingVerdict('biotype', undefined)).toBeUndefined()
  expect(
    attributeGroupingVerdict("jexl:get(feature,'type')", scan),
  ).toBeUndefined()
})

test('lists the values in section order, with the no-value section', () => {
  expect(attributeGroupingVerdict('biotype', scan)).toEqual({
    color: 'text.secondary',
    text: 'Found values: lncRNA, protein_coding, plus features with no biotype',
  })
})

test('an attribute nothing in view carries, and one past the cap, both warn without refusing', () => {
  expect(attributeGroupingVerdict('gene_biotype', scan)?.color).toBe(
    'warning.main',
  )
  expect(attributeGroupingVerdict('gene_biotype', scan)?.text).toMatch(
    /No feature in view carries gene_biotype/,
  )
  expect(attributeGroupingVerdict('name', scan)?.text).toMatch(
    `more than ${MAX_GROUPS} distinct values`,
  )
})

test('a long value list is capped, with the count in front of it', () => {
  const values = Array.from({ length: 12 }, (_, i) => `v${i}`)
  expect(
    attributeGroupingVerdict('note', [
      { field: 'note', values, missing: true, overflow: false },
    ])?.text,
  ).toBe(
    'Found 12 values: v0, v1, v2, v3, v4, v5, v6, v7, and 4 more, plus ' +
      'features with no note',
  )
})

test('a refused region is said, not counted', () => {
  expect(
    attributeGroupingVerdict('biotype', { regionTooLarge: true })?.text,
  ).toMatch(/too large to scan/)
})

test('the option aside counts sections, the no-value one included', () => {
  expect(sectionCountHint(scan[0]!)).toBe('3 sections')
  expect(sectionCountHint(scan[1]!)).toBe(`${MAX_GROUPS}+ sections`)
  expect(
    sectionCountHint({
      field: 'type',
      values: ['gene'],
      missing: false,
      overflow: false,
    }),
  ).toBe('1 section')
})
