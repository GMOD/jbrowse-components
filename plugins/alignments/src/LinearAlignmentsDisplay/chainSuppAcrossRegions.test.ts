import {
  SAM_FLAG_REVERSE,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import {
  CHAIN_FILL_NO_SUPP,
  CHAIN_FILL_SPLIT_INVERSION,
  CHAIN_FILL_SUPP_PRIMARY_FWD,
  CHAIN_FILL_SUPP_PRIMARY_REV,
} from '../shared/types.ts'
import { reconcileChainSuppAcrossRegions } from './chainSuppAcrossRegions.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

// One region's worth of chain-mode arrays: exactly the fields the pass reads.
// `chainHasSupp` is what THAT region's worker call concluded on its own, which
// is the thing under test.
function region(opts: {
  chainNames: string[]
  chainIndices: number[]
  flags: number[]
  strands: number[]
  chainHasSupp: number[]
}): PileupDataResult {
  return {
    chainNames: opts.chainNames,
    readChainIndices: Uint32Array.from(opts.chainIndices),
    readFlags: Uint16Array.from(opts.flags),
    readStrands: Int8Array.from(opts.strands),
    readChainHasSupp: Uint8Array.from(opts.chainHasSupp),
  } as unknown as PileupDataResult
}

function fills(map: Map<number, PileupDataResult>, idx: number) {
  return [...map.get(idx)!.readChainHasSupp!]
}

// The interchromosomal fusion the mode exists for: chr22 holds each molecule's
// primary, chr9 holds its supplementary, and neither worker call sees both.
describe('a chain split across two displayed regions', () => {
  // fwd primary on chr22; its supplementary lands reverse-strand on chr9, i.e.
  // the junction flipped.
  const chr22 = region({
    chainNames: ['mol'],
    chainIndices: [0],
    flags: [0],
    strands: [1],
    // no supplementary in this region, so the worker said "not a split read"
    chainHasSupp: [CHAIN_FILL_NO_SUPP],
  })
  const chr9 = region({
    chainNames: ['mol'],
    chainIndices: [0],
    flags: [SAM_FLAG_SUPPLEMENTARY | SAM_FLAG_REVERSE],
    strands: [-1],
    // no primary in this region, so the worker fell back to "primary forward"
    chainHasSupp: [CHAIN_FILL_SUPP_PRIMARY_FWD],
  })

  it('marks the primary side as part of a split chain', () => {
    const out = reconcileChainSuppAcrossRegions(
      new Map([
        [0, chr22],
        [1, chr9],
      ]),
    )
    // the primary now frames against itself (+1 → same strand), instead of
    // painting the scheme's plain fill as if the read never split
    expect(fills(out, 0)).toEqual([CHAIN_FILL_SUPP_PRIMARY_FWD])
  })

  it('frames the far segment against the primary it actually has', () => {
    const out = reconcileChainSuppAcrossRegions(
      new Map([
        [0, chr22],
        [1, chr9],
      ]),
    )
    // unchanged here only because the primary IS forward; the point is that it
    // is now the molecule's own primary rather than the unknown-primary fallback
    expect(fills(out, 1)).toEqual([CHAIN_FILL_SUPP_PRIMARY_FWD])
  })

  it('reports a reverse primary to the region that cannot see it', () => {
    const revPrimary = region({
      chainNames: ['mol'],
      chainIndices: [0],
      flags: [SAM_FLAG_REVERSE],
      strands: [-1],
      chainHasSupp: [CHAIN_FILL_NO_SUPP],
    })
    const out = reconcileChainSuppAcrossRegions(
      new Map([
        [0, revPrimary],
        [1, chr9],
      ]),
    )
    // chr9's segment was framed against an invented forward primary and so read
    // as inverted; against the real reverse primary it is co-linear
    expect(fills(out, 1)).toEqual([CHAIN_FILL_SUPP_PRIMARY_REV])
    expect(fills(out, 0)).toEqual([CHAIN_FILL_SUPP_PRIMARY_REV])
  })
})

test('a chain living in one region keeps that region’s answer', () => {
  const withSupp = region({
    chainNames: ['local', 'other'],
    chainIndices: [0, 0, 1],
    flags: [0, SAM_FLAG_SUPPLEMENTARY, 0],
    strands: [1, -1, 1],
    chainHasSupp: [
      CHAIN_FILL_SUPP_PRIMARY_FWD,
      CHAIN_FILL_SUPP_PRIMARY_FWD,
      CHAIN_FILL_NO_SUPP,
    ],
  })
  const elsewhere = region({
    chainNames: ['far'],
    chainIndices: [0],
    flags: [0],
    strands: [1],
    chainHasSupp: [CHAIN_FILL_NO_SUPP],
  })
  const map = new Map([
    [0, withSupp],
    [1, elsewhere],
  ])
  const out = reconcileChainSuppAcrossRegions(map)
  expect(fills(out, 0)).toEqual([
    CHAIN_FILL_SUPP_PRIMARY_FWD,
    CHAIN_FILL_SUPP_PRIMARY_FWD,
    CHAIN_FILL_NO_SUPP,
  ])
  // nothing changed, so the array is the same object — the renderer's upload
  // memo reads that identity
  expect(out.get(0)!.readChainHasSupp).toBe(withSupp.readChainHasSupp)
})

// The paired markers classify a supplementary against its own MATE's primary,
// which is finer than the chain-level question this pass answers.
test('a paired split marker survives the union', () => {
  const a = region({
    chainNames: ['pair'],
    chainIndices: [0],
    flags: [SAM_FLAG_SUPPLEMENTARY],
    strands: [1],
    chainHasSupp: [CHAIN_FILL_SPLIT_INVERSION],
  })
  const b = region({
    chainNames: ['pair'],
    chainIndices: [0],
    flags: [0],
    strands: [1],
    chainHasSupp: [CHAIN_FILL_NO_SUPP],
  })
  const out = reconcileChainSuppAcrossRegions(
    new Map([
      [0, a],
      [1, b],
    ]),
  )
  expect(fills(out, 0)).toEqual([CHAIN_FILL_SPLIT_INVERSION])
})

test('a single-region map is returned untouched', () => {
  const only = new Map([
    [
      0,
      region({
        chainNames: ['x'],
        chainIndices: [0],
        flags: [SAM_FLAG_SUPPLEMENTARY],
        strands: [1],
        chainHasSupp: [CHAIN_FILL_SUPP_PRIMARY_FWD],
      }),
    ],
  ])
  expect(reconcileChainSuppAcrossRegions(only)).toBe(only)
})

// Pileup mode carries no chain arrays at all; the pass must not invent any.
test('non-chain data passes through', () => {
  const plain = { readFlags: new Uint16Array(2) } as unknown as PileupDataResult
  const map = new Map([
    [0, plain],
    [1, plain],
  ])
  expect(reconcileChainSuppAcrossRegions(map)).toBe(map)
})
