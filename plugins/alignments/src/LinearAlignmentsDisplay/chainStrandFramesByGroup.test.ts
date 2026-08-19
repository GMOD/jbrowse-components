import { SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/cigar-utils'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { CHAIN_FRAME_REV, CHAIN_SUPP_PRESENT } from '../shared/types.ts'
import { applyChainStrandFrames } from './groupLayout.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { LaidOutByGroup } from './groupLayout.ts'

interface Seg {
  chain: string
  start: number
  end: number
  strand: 1 | -1
}

function region(segs: Seg[]): PileupDataResult {
  const names = [...new Set(segs.map(s => s.chain))]
  return makePileupDataResult({
    chainNames: names,
    readChainIndices: Uint32Array.from(segs.map(s => names.indexOf(s.chain))),
    readPositions: Uint32Array.from(segs.flatMap(s => [s.start, s.end])),
    readStrands: Int8Array.from(segs.map(s => s.strand)),
    readFlags: Uint16Array.from(segs.map(() => SAM_FLAG_SUPPLEMENTARY)),
    readChainHasSupp: Uint8Array.from(segs.map(() => CHAIN_SUPP_PRESENT)),
  })
}

const FWD = CHAIN_SUPP_PRESENT
const REV = CHAIN_SUPP_PRESENT | CHAIN_FRAME_REV

function fills(out: LaidOutByGroup, key: string, idx: number) {
  return [...out.get(key)!.get(idx)!.readChainHasSupp!]
}

// The same foldback as `chainStrandConsensus.test.ts`, with the five molecules
// split over two haplotype lanes — the case `applyChainStrandFrames` widened its
// scope for. A/b/c were flagged primary on one arm and d/e on the other, and
// only comparing them to each other can tell.
//
// A locus is one overlap run WITHIN one entry of the map the consensus is
// handed, so pooling the lanes into a shared key space is not enough on its own:
// the two lanes' segments have to reach it as one locus, or their chains never
// share a bucket and the pairwise objective between them is identically zero.
describe('the chain-strand consensus reaches across grouping lanes', () => {
  function anchor(chains: string[], flipped: boolean) {
    return region(
      chains.flatMap(chain => [
        { chain, start: 1000, end: 1800, strand: flipped ? -1 : 1 },
        { chain, start: 1200, end: 1500, strand: flipped ? 1 : -1 },
      ]),
    )
  }
  function insert(chains: string[], flipped: boolean) {
    return region(
      chains.map(chain => ({
        chain,
        start: 9000,
        end: 9200,
        strand: flipped ? -1 : 1,
      })),
    )
  }

  const byGroup: LaidOutByGroup = new Map([
    [
      'HP:1',
      new Map([
        [0, anchor(['a', 'b', 'c'], false)],
        [1, insert(['a', 'b', 'c'], false)],
      ]),
    ],
    [
      'HP:2',
      new Map([
        [0, anchor(['d', 'e'], true)],
        [1, insert(['d', 'e'], true)],
      ]),
    ],
  ])

  const out = applyChainStrandFrames(byGroup, true, true)

  it('paints one insert colour across both lanes', () => {
    expect(fills(out, 'HP:1', 1)).toEqual([FWD, FWD, FWD])
    expect(fills(out, 'HP:2', 1)).toEqual([REV, REV])
  })

  it('makes each arm of the foldback one colour across both lanes', () => {
    const framed = (key: string) => {
      const { readChainHasSupp, readStrands } = out.get(key)!.get(0)!
      return [...readStrands].map(
        (s, i) => s * (readChainHasSupp![i] === REV ? -1 : 1),
      )
    }
    expect(framed('HP:1')).toEqual([1, -1, 1, -1, 1, -1])
    expect(framed('HP:2')).toEqual([1, -1, 1, -1])
  })
})
