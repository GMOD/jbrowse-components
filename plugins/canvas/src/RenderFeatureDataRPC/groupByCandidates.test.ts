import { SimpleFeature } from '@jbrowse/core/util'
import { MAX_GROUPS } from '@jbrowse/core/util/groupKeys'

import { summarizeGroupByCandidates } from './groupByCandidates.ts'

let nextId = 0

function feat(attrs: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: `f${nextId++}`,
    refName: 'ctgA',
    start: 0,
    end: 10,
    strand: 1,
    ...attrs,
  })
}

test('lists each attribute with its values in section order, skipping the structural fields', () => {
  const summary = summarizeGroupByCandidates([
    feat({ type: 'gene', biotype: 'protein_coding' }),
    feat({ type: 'gene', biotype: 'lncRNA' }),
    feat({ type: 'gene', biotype: 'protein_coding' }),
  ])
  expect(summary).toEqual([
    {
      field: 'biotype',
      values: ['lncRNA', 'protein_coding'],
      missing: false,
      overflow: false,
    },
    { field: 'type', values: ['gene'], missing: false, overflow: false },
  ])
})

test('a feature lacking the attribute, or carrying it empty, marks it missing', () => {
  const [biotype] = summarizeGroupByCandidates([
    feat({ biotype: 'protein_coding' }),
    feat({}),
    feat({ biotype: null }),
  ])
  expect(biotype).toEqual({
    field: 'biotype',
    values: ['protein_coding'],
    missing: true,
    overflow: false,
  })
})

test('a multi-valued attribute joins, as the facet stamps it', () => {
  const [ontology] = summarizeGroupByCandidates([
    feat({ ontology: ['GO:1', 'GO:2'] }),
  ])
  expect(ontology!.values).toEqual(['GO:1,GO:2'])
})

test('past MAX_GROUPS distinct values the field overflows and its values are dropped', () => {
  const [name] = summarizeGroupByCandidates(
    Array.from({ length: MAX_GROUPS + 1 }, (_, i) => feat({ name: `g${i}` })),
  )
  expect(name).toEqual({
    field: 'name',
    values: [],
    missing: false,
    overflow: true,
  })
})

test('exactly MAX_GROUPS values plus a missing section is over the cap too', () => {
  const [name] = summarizeGroupByCandidates([
    ...Array.from({ length: MAX_GROUPS }, (_, i) => feat({ name: `g${i}` })),
    feat({}),
  ])
  expect(name!.overflow).toBe(true)
  expect(name!.missing).toBe(true)
})
