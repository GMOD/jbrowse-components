import { subfeatureGroups } from './subfeatureGroups.ts'

const part = (type: string, start: number, extra = {}) => ({
  refName: 'ctgA',
  type,
  start,
  end: start + 10,
  ...extra,
})

test('leaf parts of one type are one group, placed where the first sits', () => {
  const groups = subfeatureGroups({
    uniqueId: 't',
    refName: 'ctgA',
    start: 0,
    end: 100,
    subfeatures: [part('exon', 0), part('CDS', 5), part('exon', 50)],
  })
  expect(groups.map(g => (g.kind === 'parts' ? g.type : g.kind))).toEqual([
    'exon',
    'CDS',
  ])
  expect(groups[0]!.kind === 'parts' && groups[0]!.parts.length).toBe(2)
})

test('a subfeature with children of its own stays a feature', () => {
  const groups = subfeatureGroups({
    uniqueId: 'g',
    refName: 'ctgA',
    start: 0,
    end: 100,
    subfeatures: [
      { ...part('mRNA', 0), subfeatures: [part('exon', 0)] },
      { ...part('mRNA', 0), subfeatures: [part('exon', 0)] },
    ],
  })
  expect(groups.map(g => g.kind)).toEqual(['feature', 'feature'])
  expect(groups[1]!.kind === 'feature' && groups[1]!.feature.uniqueId).toBe(
    'g_1',
  )
})

test('parts run 5′ to 3′ on a minus-strand parent', () => {
  const [group] = subfeatureGroups({
    uniqueId: 't',
    refName: 'ctgA',
    start: 0,
    end: 100,
    strand: -1,
    subfeatures: [part('exon', 0), part('exon', 50), part('exon', 20)],
  })
  expect(group!.kind === 'parts' && group!.parts.map(p => p.start)).toEqual([
    50, 20, 0,
  ])
})

test('an attribute with one value across the parts is shared, others vary', () => {
  const [group] = subfeatureGroups({
    uniqueId: 't',
    refName: 'ctgA',
    start: 0,
    end: 100,
    subfeatures: [
      part('CDS', 0, { protein_id: 'NP_1', phase: 0, note: null }),
      part('CDS', 50, { protein_id: 'NP_1', phase: 2 }),
      part('CDS', 80, { protein_id: 'NP_1', phase: 1, exon_number: 3 }),
    ],
  })
  expect(group).toMatchObject({
    shared: { protein_id: 'NP_1' },
    varying: ['phase', 'exon_number'],
  })
})
