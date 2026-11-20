import { OVERFLOW_GROUP_KEY, overflowLabel } from '@jbrowse/core/util/groupKeys'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/pileupData.fixture.ts'
import { knownSections, sectionsHeadingOf } from './knownSections.ts'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'

function region(
  groups: { key: string; label: string; mergedKeys?: string[] }[],
) {
  return {
    groups: groups.map(g => ({ ...g, data: makePileupDataResult({}) })),
  } satisfies GroupedAlignmentsResult
}

test('a tag facet lists every value bare, hidden ones and sorted ones included, in stacking order', () => {
  const rpcDataMap = new Map([
    [
      0,
      region([
        { key: '1', label: 'HP: 1' },
        { key: '', label: 'HP: none' },
      ]),
    ],
    [1, region([{ key: '2', label: 'HP: 2' }])],
  ])
  expect(
    knownSections(
      rpcDataMap,
      { field: 'tags.HP', sort: ['3'] },
      new Set(['1', '4']),
    ),
  ).toEqual([
    { key: '3', label: '3' },
    { key: '1', label: '1' },
    { key: '2', label: '2' },
    { key: '4', label: '4' },
    { key: '', label: expect.not.stringContaining('HP') },
  ])
})

test('a read dimension keeps its level names, and the overflow lane its count', () => {
  const rpcDataMap = new Map([
    [
      0,
      region([
        { key: '1', label: 'Forward strand' },
        {
          key: OVERFLOW_GROUP_KEY,
          label: '',
          mergedKeys: ['a', 'b', 'c'],
        },
      ]),
    ],
  ])
  expect(
    knownSections(rpcDataMap, { field: 'strand' }, new Set()).map(s => s.label),
  ).toEqual(['Forward strand', overflowLabel(3)])
})

test('nothing lists while ungrouped', () => {
  expect(knownSections(new Map(), undefined, new Set())).toEqual([])
})

test('the column header is a dimension name, a tag, or the field', () => {
  expect(sectionsHeadingOf('strand')).not.toBe('Section')
  expect(sectionsHeadingOf('tags.HP')).toBe('HP')
  expect(sectionsHeadingOf('jexl:get(feature,"x")')).toBe('Section')
})
