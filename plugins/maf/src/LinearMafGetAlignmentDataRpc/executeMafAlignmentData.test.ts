import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import { of } from 'rxjs'

import { executeMafAlignmentData } from './executeMafAlignmentData.ts'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Feature } from '@jbrowse/core/util'

// The RPC packs each block into the arena as its feature arrives, instead of
// buffering the region and sizing the arena from exact counts. What that
// restructure puts at risk is everything the buffered pass used to resolve
// BEFORE any encoding started — row order across blocks, the subtree filter,
// and above all the sample list, which still has to name genomes whose rows the
// filter dropped. So these tests are written against that boundary rather than
// against the packer, which has its own.

const mockLoadAdapter = jest.fn()
jest.mock('../util/loadMafSamplesAdapter.ts', () => ({
  loadMafSamplesAdapter: (...args: unknown[]) =>
    mockLoadAdapter(...args) as unknown,
}))

function feature(
  startBp: number,
  refSeq: string,
  alignments: Record<string, AlignmentRecord>,
  empties: Record<string, EmptyRecord> = {},
) {
  const data: Record<string, unknown> = {
    start: startBp,
    seq: refSeq,
    alignments,
    empties,
  }
  return { get: (field: string) => data[field] } as unknown as Feature
}

function row(seq: string, start = 0): AlignmentRecord {
  return { chr: 'chr1', start, strand: 1, srcSize: 1000, seq }
}

// This suite never passes a `byteLimit`, so the executor measures nothing and
// the refusal arm of its return is unreachable. Narrowed once here rather than
// at every assertion.
function payload<T>(result: T | RegionTooLargeResult) {
  if (isRegionRefused(result)) {
    throw new Error('unexpected region-too-large result')
  }
  return result
}

async function run(features: Feature[], subtreeFilter?: string[]) {
  mockLoadAdapter.mockResolvedValue({
    adapter: { getFeatures: () => of(...features) },
    samples: [],
    treeNewick: undefined,
  })
  const result = await executeMafAlignmentData({
    pluginManager: {} as PluginManager,
    args: {
      regions: [{ refName: 'chr1', start: 0, end: 100, assemblyName: 'hg38' }],
      adapterConfig: {},
      sessionId: 'session-1',
      subtreeFilter,
    },
  })
  return payload(unwrapRpcResult(result))
}

const decoder = new TextDecoder()

/** Every row's sequence, read back out of the arena in packed order. */
function rowSeqs(data: {
  arena: Uint8Array
  rowOffset: Uint32Array
  rowLength: Uint32Array
}) {
  return [...data.rowOffset].map((offset, i) =>
    decoder.decode(data.arena.subarray(offset, offset + data.rowLength[i]!)),
  )
}

test('blocks and rows pack in the order the features arrived', async () => {
  const { regionData } = await run([
    feature(10, 'ACGT', { hg38: row('ACGT'), mm10: row('AC-T') }),
    feature(40, 'TTTT', { hg38: row('TTTT'), mm10: row('TTTA') }),
  ])

  expect([...regionData.blockStartBp]).toEqual([10, 40])
  expect([...regionData.blockRowStart]).toEqual([0, 2, 4])
  expect(rowSeqs(regionData)).toEqual(['ACGT', 'AC-T', 'TTTT', 'TTTA'])
  // the reference row is written as its own arena slice, before its block's rows
  expect([...regionData.blockRefLength]).toEqual([4, 4])
  expect(regionData.refSampleId).toBe('hg38')
})

test('a growing arena packs the same bytes as an exactly sized one would', async () => {
  // 40 blocks is past the point where the arena has had to double several times
  // from its 1024-byte floor, which is the one thing the removed sizing pass
  // was buying.
  const blocks = Array.from({ length: 40 }, (_, i) =>
    feature(i * 100, 'ACGTACGTAC', {
      hg38: row('ACGTACGTAC', i * 10),
      mm10: row(`ACGTACGTA${i % 2 ? 'T' : 'C'}`, i * 10),
    }),
  )
  const { regionData } = await run(blocks)

  expect(regionData.blockStartBp.length).toBe(40)
  expect(regionData.rowOffset.length).toBe(80)
  // 40 blocks x (one 10-byte reference + two 10-byte rows), contiguous and in
  // order: a doubling that dropped or double-wrote bytes shows up here.
  expect(regionData.arena.length).toBe(40 * 30)
  expect(rowSeqs(regionData).at(-1)).toBe('ACGTACGTAT')
})

test('the subtree filter drops rows but the sample list keeps every genome', async () => {
  const { regionData, samples } = await run(
    [
      feature(10, 'ACGT', {
        hg38: row('ACGT'),
        mm10: row('AC-T'),
        rn6: row('ACGA'),
      }),
    ],
    ['hg38', 'rn6'],
  )

  expect(rowSeqs(regionData)).toEqual(['ACGT', 'ACGA'])
  expect(regionData.sampleIds).toEqual(['hg38', 'rn6'])
  // mm10 is filtered out of the arena and still listed, so the sidebar tree can
  // offer it back. Discovery order is the order the blocks named them, which is
  // why this cannot be read off the packer's own dictionary.
  expect(samples.map(s => s.id)).toEqual(['hg38', 'mm10', 'rn6'])
  expect(samples.length).toBe(3)
})

test('a species seen only on an e line is discovered and packed as an empty', async () => {
  const { regionData, samples } = await run([
    feature(
      10,
      'ACGT',
      { hg38: row('ACGT') },
      {
        canFam: {
          chr: 'chr5',
          start: 7,
          size: 3,
          strand: -1,
          srcSize: 90,
          status: 'C',
        },
      },
    ),
  ])

  expect(rowSeqs(regionData)).toEqual(['ACGT'])
  expect([...regionData.blockEmptyStart]).toEqual([0, 1])
  expect([...regionData.emptyStart]).toEqual([7])
  expect(samples.map(s => s.id)).toEqual(['hg38', 'canFam'])
})

test('a region with no blocks packs empty rather than throwing', async () => {
  const { regionData, samples } = await run([])

  expect(regionData.blockStartBp.length).toBe(0)
  expect(regionData.arena.length).toBe(0)
  expect(samples).toEqual([])
})
