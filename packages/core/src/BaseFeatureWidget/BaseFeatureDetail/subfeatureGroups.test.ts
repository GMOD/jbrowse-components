import {
  omittedForMember,
  subfeatureGroups,
  subfeatureSummary,
} from './subfeatureGroups.ts'

import type { SimpleFeatureSerializedNoId } from '../../util/index.ts'

const part = (
  type: string,
  start: number,
  extra = {},
): SimpleFeatureSerializedNoId => ({
  refName: 'ctgA',
  type,
  start,
  end: start + 10,
  ...extra,
})

const transcript = (
  subfeatures: SimpleFeatureSerializedNoId[],
  extra = {},
) => ({
  uniqueId: 't',
  id: 'tx1',
  refName: 'ctgA',
  start: 0,
  end: 100,
  source: 'havana',
  subfeatures,
  ...extra,
})

test('subfeatures group by type, in the order the types first appear', () => {
  const groups = subfeatureGroups(
    transcript([part('exon', 0), part('CDS', 5), part('exon', 50)]),
  )
  expect(groups.map(g => [g.type, g.members.length])).toEqual([
    ['exon', 2],
    ['CDS', 1],
  ])
})

test('a part with children of its own stays in its type group', () => {
  const groups = subfeatureGroups(
    transcript([
      part('CDS', 0),
      { ...part('CDS', 50), subfeatures: [part('mature_protein_region', 50)] },
    ]),
  )
  expect(groups.map(g => [g.type, g.members.length])).toEqual([['CDS', 2]])
})

test('members run 5′ to 3′ on a minus-strand parent', () => {
  const [group] = subfeatureGroups(
    transcript([part('exon', 0), part('exon', 50), part('exon', 20)], {
      strand: -1,
    }),
  )
  expect(group!.members.map(m => m.feature.start)).toEqual([50, 20, 0])
})

test('shared attributes leave out what repeats the parent', () => {
  const [group] = subfeatureGroups(
    transcript([
      part('CDS', 0, {
        source: 'havana',
        parent: 'tx1',
        protein_id: 'NP_1',
        phase: 0,
      }),
      part('CDS', 50, {
        source: 'havana',
        parent: 'tx1',
        protein_id: 'NP_1',
        phase: 2,
      }),
    ]),
  )
  expect(group!.shared).toEqual({ protein_id: 'NP_1' })
})

test("a member's own detail leaves out the row, the shared and the parent's", () => {
  const parent = transcript([
    part('exon', 0, { exon_id: 'E1', source: 'havana', rank: 1 }),
    part('exon', 50, { exon_id: 'E2', source: 'havana', rank: 1 }),
  ])
  const [group] = subfeatureGroups(parent)
  const omitted = omittedForMember(group!.members[0]!.feature, group!, parent)
  expect(omitted).toEqual(expect.arrayContaining(['start', 'rank', 'source']))
  expect(omitted).not.toContain('exon_id')
})

test('the summary counts each type and sums the coding bases', () => {
  expect(
    subfeatureSummary(
      transcript([
        part('exon', 0),
        part('exon', 50),
        part('CDS', 5),
        part('CDS', 5),
        part('CDS', 55),
      ]),
    ),
  ).toBe('2 exon · CDS 20 bp')
})

test('unformatted members pair with their formatted subfeature by position', () => {
  const formatted = transcript([part('exon', 0, { name: 'shown' })])
  const raw = transcript([part('exon', 0, { name: 'raw' })])
  const [group] = subfeatureGroups(formatted, raw)
  expect(group!.members[0]!.unformatted?.name).toBe('raw')
  expect(group!.members[0]!.unformatted?.uniqueId).toBe('t_0')
})
