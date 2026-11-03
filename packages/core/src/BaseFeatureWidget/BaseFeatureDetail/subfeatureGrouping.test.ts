import {
  omittedForMember,
  subfeatureGroups,
  subfeatureSummary,
} from './subfeatureGrouping.ts'

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
  ).toBe('2 exons · CDS 20 bp')
})

test("the summary leaves a GENCODE transcript's UTRs and codons for its groups", () => {
  expect(
    subfeatureSummary(
      transcript([
        part('exon', 0),
        part('five_prime_UTR', 0),
        part('five_prime_UTR', 20),
        part('exon', 20),
        part('exon', 40),
        part('CDS', 45),
        part('start_codon', 45),
        part('stop_codon', 50),
      ]),
    ),
  ).toBe('3 exons · CDS 10 bp')
  expect(subfeatureSummary(transcript([part('match_part', 0)]))).toBe(
    '1 match_part',
  )
})

test('unformatted members pair with their formatted subfeature by position', () => {
  const formatted = transcript([part('exon', 0, { name: 'shown' })])
  const raw = transcript([part('exon', 0, { name: 'raw' })])
  const [group] = subfeatureGroups(formatted, raw)
  expect(group!.members[0]!.unformatted?.name).toBe('raw')
  expect(group!.members[0]!.unformatted?.uniqueId).toBe('t_0')
})

test("a shared value naming the group's own type is left out", () => {
  const [group] = subfeatureGroups(
    transcript([
      part('CDS', 0, { gbkey: 'CDS', protein_id: 'NP_1' }),
      part('CDS', 50, { gbkey: 'CDS', protein_id: 'NP_1' }),
    ]),
  )
  expect(group!.shared).toEqual({ protein_id: 'NP_1' })
})

test('one name on every member is shared, and the table names none', () => {
  const [group] = subfeatureGroups(
    transcript([
      part('CDS', 0, { name: 'NP_1' }),
      part('CDS', 50, { name: 'NP_1' }),
    ]),
  )
  expect(group).toMatchObject({ named: false, shared: { name: 'NP_1' } })
})

test('differing names, or a member holding subfeatures, name each row', () => {
  const [exons] = subfeatureGroups(
    transcript([
      part('exon', 0, { name: 'e1' }),
      part('exon', 50, { name: 'e2' }),
    ]),
  )
  expect(exons).toMatchObject({ named: true, shared: {} })
  const [mrna] = subfeatureGroups(
    transcript([
      { ...part('mRNA', 0, { name: 'tx' }), subfeatures: [part('exon', 0)] },
    ]),
  )
  expect(mrna!.named).toBe(true)
})
