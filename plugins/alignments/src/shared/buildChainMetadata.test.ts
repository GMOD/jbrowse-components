import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import { buildChainMetadata } from './buildChainMetadata.ts'

import type { ChainFeatureData } from './webglRpcTypes.ts'

function feat(
  partial: Partial<ChainFeatureData> & Pick<ChainFeatureData, 'id' | 'name'>,
): ChainFeatureData {
  return {
    start: 0,
    end: 100,
    flags: 0,
    mapq: 60,
    insertSize: 0,
    pairOrientation: 0,
    strand: 1,
    refName: 'chr1',
    nextRef: undefined,
    pairOrientationStr: undefined,
    templateLength: 0,
    ...partial,
  }
}

test('mates sharing a QNAME form one chain', () => {
  const { chainNames, chainHasMultiple } = buildChainMetadata([
    feat({ id: 'r1.1', name: 'r1', start: 0, end: 100 }),
    feat({ id: 'r1.2', name: 'r1', start: 400, end: 500 }),
  ])
  expect(chainNames).toEqual(['r1'])
  expect([...chainHasMultiple]).toEqual([1])
})

test('a supplementary alignment chains with its primary', () => {
  const { chainNames, chainHasMultiple, chainSuppTypes } = buildChainMetadata([
    feat({ id: 'r1.1', name: 'r1', start: 0, end: 100 }),
    feat({
      id: 'r1.supp',
      name: 'r1',
      start: 900,
      end: 950,
      flags: SAM_FLAG_SUPPLEMENTARY,
    }),
  ])
  expect(chainNames).toEqual(['r1'])
  expect([...chainHasMultiple]).toEqual([1])
  // primary strand forward + has supplementary -> type 1
  expect([...chainSuppTypes]).toEqual([1])
})

test('chain pair orientation comes from the primary, not the supplementary', () => {
  // The primary read pair is LL (3, abnormal same-strand); the split
  // supplementary segment's own record computes a divergent LR (1). The chain
  // must carry the primary's LL so supplementary segments can inherit it.
  const { chainPairOrientations } = buildChainMetadata([
    feat({ id: 'r1.1', name: 'r1', start: 0, end: 100, pairOrientation: 3 }),
    feat({
      id: 'r1.supp',
      name: 'r1',
      start: 900,
      end: 950,
      flags: SAM_FLAG_SUPPLEMENTARY,
      pairOrientation: 1,
    }),
  ])
  expect([...chainPairOrientations]).toEqual([3])
})

test('read1 mate whose supplementary opposes the primary is split-kind 1 (inversion)', () => {
  // read1 primary forward, read1 supplementary reverse -> read1 spans an
  // inversion junction, so chainMate0SplitKind is 1 (read2 untouched). The
  // chain-level supp type stays 1 (has-supp); the per-read fan-out uses the mate
  // kind to paint BOTH read1 segments.
  const { chainSuppTypes, chainMate0SplitKind, chainMate1SplitKind } =
    buildChainMetadata([
      feat({
        id: 'r1.1',
        name: 'r1',
        strand: 1,
        flags: SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
      }),
      feat({
        id: 'r1.supp',
        name: 'r1',
        start: 900,
        end: 950,
        strand: -1,
        flags:
          SAM_FLAG_PAIRED |
          SAM_FLAG_FIRST_IN_PAIR |
          SAM_FLAG_SUPPLEMENTARY |
          SAM_FLAG_REVERSE,
      }),
    ])
  expect([...chainSuppTypes]).toEqual([1])
  expect([...chainMate0SplitKind]).toEqual([1])
  expect([...chainMate1SplitKind]).toEqual([0])
})

test('co-linear (same-strand) supplementary is split-kind 2 (deletion)', () => {
  const { chainMate0SplitKind } = buildChainMetadata([
    feat({
      id: 'r1.1',
      name: 'r1',
      strand: 1,
      flags: SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
    }),
    feat({
      id: 'r1.supp',
      name: 'r1',
      start: 900,
      end: 950,
      strand: 1,
      flags: SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
    }),
  ])
  expect([...chainMate0SplitKind]).toEqual([2])
})

test('flags the read2 mate for a second-in-pair inverted supplementary', () => {
  const { chainMate0SplitKind, chainMate1SplitKind } = buildChainMetadata([
    feat({
      id: 'r1.2',
      name: 'r1',
      strand: 1,
      flags: SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
    }),
    feat({
      id: 'r1.supp',
      name: 'r1',
      start: 900,
      end: 950,
      strand: -1,
      flags:
        SAM_FLAG_PAIRED |
        SAM_FLAG_SECOND_IN_PAIR |
        SAM_FLAG_SUPPLEMENTARY |
        SAM_FLAG_REVERSE,
    }),
  ])
  expect([...chainMate0SplitKind]).toEqual([0])
  expect([...chainMate1SplitKind]).toEqual([1])
})

test('an unpaired long-read inverted split does not set a mate kind', () => {
  // unpaired split-inversion is the long-read strand-framing path's job
  const { chainMate0SplitKind, chainMate1SplitKind } = buildChainMetadata([
    feat({ id: 'r1.1', name: 'r1', strand: 1, flags: 0 }),
    feat({
      id: 'r1.supp',
      name: 'r1',
      start: 900,
      end: 950,
      strand: -1,
      flags: SAM_FLAG_SUPPLEMENTARY | SAM_FLAG_REVERSE,
    }),
  ])
  expect([...chainMate0SplitKind]).toEqual([0])
  expect([...chainMate1SplitKind]).toEqual([0])
})

test('a secondary alignment does NOT chain with its primary', () => {
  // A competing mapping of the same read to another locus. It must render
  // standalone, not share the primary's row / connecting line.
  const { chainNames, chainHasMultiple } = buildChainMetadata([
    feat({ id: 'r1.1', name: 'r1', start: 0, end: 100 }),
    feat({
      id: 'r1.sec',
      name: 'r1',
      start: 5000,
      end: 5100,
      flags: SAM_FLAG_SECONDARY,
    }),
  ])
  // two independent chains: the primary keyed by QNAME, the secondary by a
  // unique synthetic key so cross-region merge / chainIdMap never rejoin them
  expect(chainNames).toHaveLength(2)
  expect(chainNames).toContain('r1')
  expect(chainNames.filter(n => n === 'r1')).toHaveLength(1)
  // neither chain draws a connecting line (each is a singleton)
  expect([...chainHasMultiple]).toEqual([0, 0])
})

test('secondary on the reverse strand still stands alone', () => {
  const { chainNames } = buildChainMetadata([
    feat({ id: 'a.1', name: 'a', start: 0, end: 100 }),
    feat({
      id: 'a.sec',
      name: 'a',
      flags: SAM_FLAG_SECONDARY | SAM_FLAG_REVERSE,
    }),
    feat({ id: 'b.1', name: 'b', start: 200, end: 300 }),
  ])
  expect(chainNames).toHaveLength(3)
})
