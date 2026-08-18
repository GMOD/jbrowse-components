import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { buildChainMetadata } from './buildChainMetadata.ts'
import {
  CHAIN_FRAME_REV,
  CHAIN_SPLIT_DELETION,
  CHAIN_SPLIT_INVERSION,
  CHAIN_SUPP_PRESENT,
} from './types.ts'

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
    nextRef: undefined,
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
  // primary strand forward + has supplementary: the present bit, no frame bit
  expect([...chainSuppTypes]).toEqual([CHAIN_SUPP_PRESENT])
})

test('a reverse primary sets the frame bit alongside the present bit', () => {
  // Both, not one or the other: the frame is only meaningful for a chain that
  // HAS a supplementary, so CHAIN_FRAME_REV on its own would say a chain points
  // backwards without saying it splits.
  const { chainSuppTypes } = buildChainMetadata([
    feat({
      id: 'r1.1',
      name: 'r1',
      start: 0,
      end: 100,
      strand: -1,
      flags: SAM_FLAG_REVERSE,
    }),
    feat({
      id: 'r1.supp',
      name: 'r1',
      start: 900,
      end: 950,
      flags: SAM_FLAG_SUPPLEMENTARY,
    }),
  ])
  expect([...chainSuppTypes]).toEqual([CHAIN_SUPP_PRESENT | CHAIN_FRAME_REV])
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

test('read1 mate whose supplementary opposes the primary splits at an inversion', () => {
  // read1 primary forward, read1 supplementary reverse -> read1 spans an
  // inversion junction, so chainMate0SplitKind carries the inversion bit (read2
  // untouched). The chain-level supp type is unaffected — the two are ORed into
  // one byte per read by the fan-out, which uses the mate kind to paint BOTH
  // read1 segments.
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
  expect([...chainSuppTypes]).toEqual([CHAIN_SUPP_PRESENT])
  expect([...chainMate0SplitKind]).toEqual([CHAIN_SPLIT_INVERSION])
  expect([...chainMate1SplitKind]).toEqual([0])
})

test('co-linear (same-strand) supplementary splits at a deletion', () => {
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
  expect([...chainMate0SplitKind]).toEqual([CHAIN_SPLIT_DELETION])
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
  expect([...chainMate1SplitKind]).toEqual([CHAIN_SPLIT_INVERSION])
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
  // unique synthetic key so cross-region merge / readIdsByChainName never rejoin them
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

// A PAF/synteny block carries no QNAME, and LGVSyntenyDisplay pushes those
// through this same worker with `linkedReads` a published config slot. Keyed by
// the empty name they became ONE chain: every block in the region on one row, a
// connecting line across the whole view, and an overlap tint over the lot.
test('nameless features (PAF/synteny blocks) each stand alone', () => {
  const { chainNames, chainHasMultiple, chainAbsMinStarts, chainAbsMaxEnds } =
    buildChainMetadata([
      feat({ id: 'block-a', name: '', start: 0, end: 100 }),
      feat({ id: 'block-b', name: '', start: 5000, end: 5100 }),
      feat({ id: 'block-c', name: '', start: 900_000, end: 900_100 }),
    ])
  expect(chainNames).toHaveLength(3)
  expect([...chainHasMultiple]).toEqual([0, 0, 0])
  // and no chain spans the gap between two unrelated blocks
  expect([...chainAbsMinStarts]).toEqual([0, 5000, 900_000])
  expect([...chainAbsMaxEnds]).toEqual([100, 5100, 900_100])
})
