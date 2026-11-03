import { subfeatureGroups } from './subfeatureGroups.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'

const part = (type: string, start: number, extra = {}) => ({
  refName: 'ctgA',
  type,
  start,
  end: start + 10,
  ...extra,
})

function transcript(
  subfeatures: SimpleFeatureSerialized['subfeatures'],
  extra = {},
): SimpleFeatureSerialized {
  return {
    uniqueId: 't',
    refName: 'ctgA',
    start: 0,
    end: 100,
    type: 'mRNA',
    subfeatures,
    ...extra,
  }
}

test('leaf parts of one type are one group', () => {
  const { cards, groups } = subfeatureGroups(
    transcript([part('exon', 0), part('CDS', 5), part('exon', 50)]),
  )
  expect(cards).toEqual([])
  expect(groups.map(g => [g.type, g.parts.length])).toEqual([
    ['exon', 2],
    ['CDS', 1],
  ])
})

test('a subfeature with children of its own is a card, with its unformatted twin', () => {
  const mrna = (name: string) => ({
    ...part('mRNA', 0),
    name,
    subfeatures: [part('exon', 0)],
  })
  const gene = {
    uniqueId: 'g',
    refName: 'ctgA',
    start: 0,
    end: 100,
    subfeatures: [mrna('<a>A</a>'), mrna('<a>B</a>')],
  }
  const { cards, groups } = subfeatureGroups(gene, {
    ...gene,
    subfeatures: [mrna('A'), mrna('B')],
  })
  expect(groups).toEqual([])
  expect(cards.map(c => [c.feature.uniqueId, c.unformatted?.name])).toEqual([
    ['g_0', 'A'],
    ['g_1', 'B'],
  ])
})

test('parts run 5′ to 3′ on a minus-strand parent', () => {
  const [group] = subfeatureGroups(
    transcript([part('exon', 0), part('exon', 50), part('exon', 20)], {
      strand: -1,
    }),
  ).groups
  expect(group!.parts.map(p => p.feature.start)).toEqual([50, 20, 0])
})

test('groups sit where their 5′-most part does, the larger first on a tie', () => {
  const subs = [
    part('exon', 0),
    part('exon', 40),
    part('exon', 80),
    part('five_prime_UTR', 0),
    part('CDS', 5),
    part('CDS', 40),
    part('start_codon', 5),
    part('stop_codon', 85),
    part('three_prime_UTR', 88),
  ]
  expect(subfeatureGroups(transcript(subs)).groups.map(g => g.type)).toEqual([
    'exon',
    'five_prime_UTR',
    'CDS',
    'start_codon',
    'stop_codon',
    'three_prime_UTR',
  ])
  const minus = subfeatureGroups(transcript(subs, { strand: -1 })).groups
  expect(minus.map(g => g.type)).toEqual([
    'three_prime_UTR',
    'stop_codon',
    'exon',
    'CDS',
    'start_codon',
    'five_prime_UTR',
  ])
})

test('what the parent already says is left out, an array compared whole', () => {
  const tag = ['basic', 'GENCODE_Primary']
  const [group] = subfeatureGroups(
    transcript(
      [
        part('exon', 0, { gene_name: 'TP53', tag: [...tag], level: 2 }),
        part('exon', 50, { gene_name: 'TP53', tag: [...tag], level: 2 }),
      ],
      { gene_name: 'TP53', tag, level: 1 },
    ),
  ).groups
  expect(group!.shared).toEqual({ level: 2 })
})

test('a part never shows its parent link or its own id', () => {
  const [group] = subfeatureGroups(
    transcript([
      part('exon', 0, { ID: 'e1', Parent: 'tx1', exon_number: 1 }),
      part('exon', 50, { id: 'e2', parent: 'tx1', exon_number: 2 }),
    ]),
  ).groups
  expect(group!.shared).toEqual({})
  expect(group!.parts.map(p => p.own)).toEqual([
    { exon_number: 1 },
    { exon_number: 2 },
  ])
})

test('an attribute with one value across the parts is shared, the rest are each part’s own', () => {
  const [group] = subfeatureGroups(
    transcript([
      part('CDS', 0, { protein_id: 'NP_1', phase: 0, note: null }),
      part('CDS', 50, { protein_id: 'NP_1', phase: 2 }),
      part('CDS', 80, { protein_id: 'NP_1', phase: 1, exon_number: 3 }),
    ]),
  ).groups
  expect(group).toMatchObject({ shared: { protein_id: 'NP_1' }, phased: true })
  expect(group!.parts.map(p => p.own)).toEqual([{}, {}, { exon_number: 3 }])
})

test('phase is a column only where a part has one', () => {
  const { groups } = subfeatureGroups(
    transcript([part('exon', 0), part('CDS', 0, { phase: 0 })]),
  )
  expect(groups.map(g => [g.type, g.phased])).toEqual([
    ['exon', false],
    ['CDS', true],
  ])
})
