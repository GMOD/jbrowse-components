import { MAX_GROUPS } from '@jbrowse/core/util/groupKeys'

import {
  COLORING,
  GROUPING,
  attributeVerdict,
  candidateCountHint,
} from './attributeVerdict.ts'

import type { GroupByCandidate } from '../../RenderFeatureDataRPC/groupByCandidates.ts'
import type { AttributeScan } from './attributeVerdict.ts'

const verdict = (field: string, scan: AttributeScan | undefined) =>
  attributeVerdict(field, scan, GROUPING)
const hint = (candidate: GroupByCandidate) =>
  candidateCountHint(candidate, GROUPING)

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
  expect(verdict('', scan)).toBeUndefined()
  expect(verdict('biotype', undefined)).toBeUndefined()
  expect(verdict("jexl:get(feature,'type')", scan)).toBeUndefined()
})

test('lists the values in section order, with the no-value section', () => {
  expect(verdict('biotype', scan)).toEqual({
    color: 'text.secondary',
    text: 'Found values: lncRNA, protein_coding, plus features with no biotype',
  })
})

test('an attribute nothing in view carries, and one past the cap, both warn without refusing', () => {
  expect(verdict('gene_biotype', scan)?.color).toBe('warning.main')
  expect(verdict('gene_biotype', scan)?.text).toMatch(
    /No feature in view carries gene_biotype/,
  )
  expect(verdict('name', scan)?.text).toMatch(
    `more than ${MAX_GROUPS} distinct values`,
  )
})

test('a long value list is capped, with the count in front of it', () => {
  const values = Array.from({ length: 12 }, (_, i) => `v${i}`)
  expect(
    verdict('note', [{ field: 'note', values, missing: true, overflow: false }])
      ?.text,
  ).toBe(
    'Found 12 values: v0, v1, v2, v3, v4, v5, v6, v7, and 4 more, plus ' +
      'features with no note',
  )
})

// Said before anything is typed, too: the list is empty either way, and the
// caption is the only thing that distinguishes a region the scan refused from
// a track whose features carry no attributes.
test('a refused region is said with nothing typed', () => {
  expect(verdict('', { regionTooLarge: true })?.text).toMatch(
    /too large to scan/,
  )
})

test('a refused region is said, not counted', () => {
  expect(verdict('biotype', { regionTooLarge: true })?.text).toMatch(
    /too large to scan/,
  )
})

test('the option aside counts sections, the no-value one included', () => {
  expect(hint(scan[0]!)).toBe('3 sections')
  expect(hint(scan[1]!)).toBe(`${MAX_GROUPS}+ sections`)
  expect(
    hint({
      field: 'type',
      values: ['gene'],
      missing: false,
      overflow: false,
    }),
  ).toBe('1 section')
})

test('coloring counts colors and says what the key cannot hold', () => {
  expect(candidateCountHint(scan[0]!, COLORING)).toBe('3 colors')
  expect(candidateCountHint(scan[1]!, COLORING)).toBe(`${MAX_GROUPS}+ colors`)
  expect(attributeVerdict('name', scan, COLORING)?.text).toMatch(
    /more than the color key lists/,
  )
  expect(attributeVerdict('gene_biotype', scan, COLORING)?.text).toMatch(
    /no-value color/,
  )
})
