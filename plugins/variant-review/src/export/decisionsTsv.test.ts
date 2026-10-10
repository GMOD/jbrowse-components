import { decisionsTsv } from './decisionsTsv.ts'

import type { CandidateVariant, DecisionRecord } from '../candidates/types.ts'

const candidate: CandidateVariant = {
  id: 'volvox:ctgA:101:G:A',
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 100,
  end: 101,
  pos1: 101,
  ref: 'G',
  alt: ['A'],
  vcfId: 'rs1',
  filter: ['PASS'],
  qual: 50,
  info: {},
  kind: 'snv',
  sort: { type: 'basePair', pos: 100 },
  sourceFeatureId: 'f1',
}

function rows(tsv: string) {
  return tsv
    .trimEnd()
    .split('\n')
    .map(l => l.split('\t'))
}

test('header, 1-based pos and unreviewed rows', () => {
  const second = { ...candidate, id: 'volvox:ctgA:201:C:T', pos1: 201 }
  const out = rows(
    decisionsTsv(
      [candidate, second],
      new Map<string, DecisionRecord>([
        [candidate.id, { decision: 'accepted', note: 'looks\tgood' }],
      ]),
    ),
  )
  expect(out[0]).toEqual([
    'candidate_id',
    'assembly',
    'ref_name',
    'pos',
    'ref',
    'alt',
    'vcf_id',
    'filter',
    'qual',
    'decision',
    'note',
    'timestamp',
  ])
  expect(out[1]).toEqual([
    candidate.id,
    'volvox',
    'ctgA',
    '101',
    'G',
    'A',
    'rs1',
    'PASS',
    '50',
    'accepted',
    'looks good',
    '',
  ])
  expect(out[2]![3]).toBe('201')
  expect(out[2]![9]).toBe('unreviewed')
})

test('orphaned decisions are appended, not dropped', () => {
  const out = rows(
    decisionsTsv(
      [candidate],
      new Map<string, DecisionRecord>([
        ['gone:ctgB:5:A:T', { decision: 'flagged' }],
      ]),
    ),
  )
  expect(out).toHaveLength(3)
  expect(out[2]![0]).toBe('gone:ctgB:5:A:T')
  expect(out[2]![9]).toBe('flagged')
  expect(out[2]!.filter(Boolean)).toHaveLength(2)
})
