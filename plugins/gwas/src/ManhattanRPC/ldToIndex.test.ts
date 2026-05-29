import { buildLdToIndex, posKey } from './ldToIndex.ts'

import type { LDRecordSource } from './ldToIndex.ts'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

function rec(p: Partial<PlinkLDRecord>): PlinkLDRecord {
  return {
    chrA: 'chr1',
    bpA: 0,
    snpA: '',
    chrB: 'chr1',
    bpB: 0,
    snpB: '',
    r2: 0,
    ...p,
  }
}

function source(records: PlinkLDRecord[]): LDRecordSource {
  return { getLDRecords: () => Promise.resolve(records) }
}

const region = { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' }

test('posKey is 1-based to line up with chr:bp ids', () => {
  expect(posKey('chr1', 99)).toBe('chr1:100')
})

test('maps r² of the partner SNP, keyed by id and by chr:bp, both orientations', async () => {
  const ld = await buildLdToIndex({
    adapter: source([
      // index as snpA
      rec({
        snpA: 'rsIndex',
        bpA: 100,
        snpB: 'rsB',
        chrB: 'chr1',
        bpB: 200,
        r2: 0.8,
      }),
      // index as snpB
      rec({
        snpA: 'rsC',
        chrA: 'chr1',
        bpA: 300,
        snpB: 'rsIndex',
        bpB: 100,
        r2: 0.4,
      }),
    ]),
    region,
    indexSnp: 'rsIndex',
  })
  expect(ld.indexFound).toBe(true)
  expect(ld.r2ByKey.get('rsB')).toBe(0.8)
  expect(ld.r2ByKey.get('chr1:200')).toBe(0.8)
  expect(ld.r2ByKey.get('rsC')).toBe(0.4)
  expect(ld.r2ByKey.get('chr1:300')).toBe(0.4)
})

test('matches the index SNP by chr:bp as well as by id', async () => {
  const ld = await buildLdToIndex({
    adapter: source([
      rec({
        snpA: 'rsA',
        chrA: 'chr1',
        bpA: 100,
        snpB: 'rsB',
        bpB: 200,
        r2: 0.5,
      }),
    ]),
    region,
    indexSnp: 'chr1:100',
  })
  expect(ld.indexFound).toBe(true)
  expect(ld.r2ByKey.get('rsB')).toBe(0.5)
})

test('indexFound is false when no pair references the index SNP', async () => {
  const ld = await buildLdToIndex({
    adapter: source([rec({ snpA: 'rsA', snpB: 'rsB', r2: 0.9 })]),
    region,
    indexSnp: 'rsIndex',
  })
  expect(ld.indexFound).toBe(false)
  expect(ld.r2ByKey.size).toBe(0)
})

test('a pair where both sides are the index SNP is ignored', async () => {
  const ld = await buildLdToIndex({
    adapter: source([
      rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsIndex', bpB: 100, r2: 1 }),
    ]),
    region,
    indexSnp: 'rsIndex',
  })
  expect(ld.indexFound).toBe(false)
  expect(ld.r2ByKey.size).toBe(0)
})
