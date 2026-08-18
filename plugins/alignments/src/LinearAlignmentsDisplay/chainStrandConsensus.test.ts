import { SAM_FLAG_PAIRED, SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/cigar-utils'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  CHAIN_FRAME_REV,
  CHAIN_SPLIT_INVERSION,
  CHAIN_SUPP_NONE,
  CHAIN_SUPP_PRESENT,
} from '../shared/types.ts'
import { consensusChainStrandFrames } from './chainStrandConsensus.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

interface Seg {
  chain: string
  start: number
  end: number
  strand: 1 | -1
  // the frame this region's worker call arrived at on its own, i.e. the chain's
  // own primary strand — the thing the pass is there to second-guess
  fill?: number
  paired?: boolean
}

function region(segs: Seg[]): PileupDataResult {
  const names = [...new Set(segs.map(s => s.chain))]
  return makePileupDataResult({
    chainNames: names,
    readChainIndices: Uint32Array.from(segs.map(s => names.indexOf(s.chain))),
    readPositions: Uint32Array.from(segs.flatMap(s => [s.start, s.end])),
    readStrands: Int8Array.from(segs.map(s => s.strand)),
    readFlags: Uint16Array.from(
      segs.map(s => SAM_FLAG_SUPPLEMENTARY | (s.paired ? SAM_FLAG_PAIRED : 0)),
    ),
    readChainHasSupp: Uint8Array.from(
      segs.map(s => s.fill ?? CHAIN_SUPP_PRESENT),
    ),
  })
}

function fills(map: Map<number, PileupDataResult>, idx: number) {
  return [...map.get(idx)!.readChainHasSupp!]
}

const FWD = CHAIN_SUPP_PRESENT
const REV = CHAIN_SUPP_PRESENT | CHAIN_FRAME_REV

// The COLO829 chr3 foldback in miniature, and the shape the pass exists for.
//
// Each molecule crosses one junction: an arm at the anchor locus, and one
// segment at a distant insert locus. The two arms overlap in REFERENCE and point
// opposite ways, so both are candidates for the aligner's primary flag — and
// which one gets it decides the frame. Chains a/b/c were flagged on one arm and
// d/e on the other, which is why their inserts disagree while the molecules do
// not.
describe('a foldback whose primary flag lands on either arm', () => {
  // anchor: every chain contributes BOTH arms, which is what makes this locus
  // unable to answer on its own — the two cancel.
  const anchor = region([
    { chain: 'a', start: 1000, end: 1800, strand: 1 },
    { chain: 'a', start: 1200, end: 1500, strand: -1 },
    { chain: 'b', start: 1000, end: 1800, strand: 1 },
    { chain: 'b', start: 1200, end: 1500, strand: -1 },
    { chain: 'c', start: 1000, end: 1800, strand: 1 },
    { chain: 'c', start: 1200, end: 1500, strand: -1 },
    // d/e were framed off the other arm, so their arms come out inverted
    { chain: 'd', start: 1000, end: 1800, strand: -1 },
    { chain: 'd', start: 1200, end: 1500, strand: 1 },
    { chain: 'e', start: 1000, end: 1800, strand: -1 },
    { chain: 'e', start: 1200, end: 1500, strand: 1 },
  ])
  // insert: one segment per chain, so this is the locus that CAN answer
  const insert = region([
    { chain: 'a', start: 9000, end: 9200, strand: 1 },
    { chain: 'b', start: 9000, end: 9200, strand: 1 },
    { chain: 'c', start: 9000, end: 9200, strand: 1 },
    { chain: 'd', start: 9000, end: 9200, strand: -1 },
    { chain: 'e', start: 9000, end: 9200, strand: -1 },
  ])
  const out = consensusChainStrandFrames(
    new Map([
      [0, anchor],
      [1, insert],
    ]),
  )

  it('paints the insert one color instead of splitting it', () => {
    // d and e flip, so all five now agree about the insert. Under the primary
    // framing this row was five FWD over strands [1, 1, 1, -1, -1] — three red
    // and two blue for five identical molecules.
    expect(fills(out, 1)).toEqual([FWD, FWD, FWD, REV, REV])
  })

  it('makes each arm of the foldback one color across every chain', () => {
    // the long arm is now red on every chain and the short arm blue on every
    // chain, rather than the assignment alternating with the primary flag
    const { readChainHasSupp, readStrands } = out.get(0)!
    const framed = [...readStrands].map(
      (s, i) => s * (readChainHasSupp![i] === REV ? -1 : 1),
    )
    expect(framed).toEqual([1, -1, 1, -1, 1, -1, 1, -1, 1, -1])
  })

  it('leaves the majority of chains on the frame they arrived with', () => {
    // the objective is invariant under negating every frame, so the global sign
    // is anchored rather than left to the solver: a/b/c keep theirs, d/e move
    expect(fills(out, 0)).toEqual([
      FWD,
      FWD,
      FWD,
      FWD,
      FWD,
      FWD,
      REV,
      REV,
      REV,
      REV,
    ])
  })
})

// The counterpart, and the limit worth pinning: a chain seen at ONE locus has no
// evidence about its own frame — there, "which way I point" and "which way my
// frame points" are the same statement. Re-framing it would not resolve an
// ambiguity, it would overwrite the read's orientation with its neighbours'.
it('does not absorb a lone inverted segment into the reads around it', () => {
  const map = new Map([
    [
      0,
      region([
        { chain: 'a', start: 100, end: 900, strand: 1 },
        { chain: 'b', start: 100, end: 900, strand: 1 },
        { chain: 'c', start: 100, end: 900, strand: -1 },
      ]),
    ],
  ])
  const out = consensusChainStrandFrames(map)
  // c is a real inversion against a and b and stays blue — which is the whole
  // signal an inverted supplementary at a breakpoint carries
  expect(out.get(0)).toBe(map.get(0))
})

it('leaves paired chains and their split markers alone', () => {
  const map = new Map([
    [
      0,
      region([
        { chain: 'a', start: 100, end: 900, strand: 1, paired: true },
        {
          chain: 'b',
          start: 100,
          end: 900,
          strand: -1,
          paired: true,
          fill: CHAIN_SUPP_PRESENT | CHAIN_SPLIT_INVERSION,
        },
        {
          chain: 'c',
          start: 100,
          end: 900,
          strand: -1,
          fill: CHAIN_SUPP_NONE,
        },
      ]),
    ],
  ])
  const out = consensusChainStrandFrames(map)
  // nothing here is an unpaired split chain, so the pass has no vote to cast and
  // returns the input untouched — reference identity included, which the
  // renderer's upload memo reads
  expect(out.get(0)).toBe(map.get(0))
})

it('is a no-op below two chains', () => {
  const one = new Map([
    [
      0,
      region([
        { chain: 'a', start: 100, end: 900, strand: 1 },
        { chain: 'a', start: 200, end: 400, strand: -1 },
      ]),
    ],
  ])
  expect(consensusChainStrandFrames(one)).toBe(one)
})

// Two pileups in one wide window are two questions, and merging them would let
// an unrelated locus outvote the one a chain is actually at.
it('does not let one pileup frame a chain that is only at another', () => {
  const map = new Map([
    [
      0,
      region([
        { chain: 'a', start: 100, end: 900, strand: 1 },
        { chain: 'b', start: 100, end: 900, strand: 1 },
        { chain: 'c', start: 100, end: 900, strand: 1 },
        // a distant, non-overlapping cluster: its own bucket
        { chain: 'd', start: 90000, end: 90800, strand: -1 },
        { chain: 'e', start: 90000, end: 90800, strand: -1 },
      ]),
    ],
  ])
  const out = consensusChainStrandFrames(map)
  // d/e are compared with nobody but each other, so the three-chain cluster next
  // door does not drag them onto its orientation
  expect(fills(out, 0)).toEqual([FWD, FWD, FWD, FWD, FWD])
})

// The pass is fed by a fetch, so its answer must not depend on which region's
// worker call landed first.
it('gives the same answer whichever order the regions arrive in', () => {
  const anchor = region([
    { chain: 'a', start: 1000, end: 1800, strand: 1 },
    { chain: 'a', start: 1200, end: 1500, strand: -1 },
    { chain: 'b', start: 1000, end: 1800, strand: -1 },
    { chain: 'b', start: 1200, end: 1500, strand: 1 },
  ])
  const insert = region([
    { chain: 'a', start: 9000, end: 9200, strand: 1 },
    { chain: 'b', start: 9000, end: 9200, strand: -1 },
  ])
  const forwards = consensusChainStrandFrames(
    new Map([
      [0, anchor],
      [1, insert],
    ]),
  )
  const backwards = consensusChainStrandFrames(
    new Map([
      [1, insert],
      [0, anchor],
    ]),
  )
  expect(fills(forwards, 1)).toEqual(fills(backwards, 1))
})

// The frame is derived from what is on screen, so PANNING is the one input that
// can move it without the data moving. Two different claims, and only the first
// is a guarantee.
describe('panning', () => {
  const anchorSegs: Seg[] = [
    { chain: 'a', start: 1000, end: 1800, strand: 1 },
    { chain: 'a', start: 1200, end: 1500, strand: -1 },
    { chain: 'b', start: 1000, end: 1800, strand: 1 },
    { chain: 'b', start: 1200, end: 1500, strand: -1 },
    { chain: 'c', start: 1000, end: 1800, strand: 1 },
    { chain: 'c', start: 1200, end: 1500, strand: -1 },
    { chain: 'd', start: 1000, end: 1800, strand: -1 },
    { chain: 'd', start: 1200, end: 1500, strand: 1 },
    { chain: 'e', start: 1000, end: 1800, strand: -1 },
    { chain: 'e', start: 1200, end: 1500, strand: 1 },
  ]
  const insert = region([
    { chain: 'a', start: 9000, end: 9200, strand: 1 },
    { chain: 'b', start: 9000, end: 9200, strand: 1 },
    { chain: 'c', start: 9000, end: 9200, strand: 1 },
    { chain: 'd', start: 9000, end: 9200, strand: -1 },
    { chain: 'e', start: 9000, end: 9200, strand: -1 },
  ])
  const bothLoci = () =>
    new Map([
      [0, region(anchorSegs)],
      [1, insert],
    ])

  it('does not repaint a chain when other reads scroll into view', () => {
    // the ordinary pan: more reads arrive at a locus a chain is already framed
    // by. Rows the user is looking at must not change colour underneath them.
    const before = consensusChainStrandFrames(bothLoci())
    const after = consensusChainStrandFrames(
      new Map([
        [
          0,
          region([
            ...anchorSegs,
            { chain: 'f', start: 1000, end: 1800, strand: 1 },
            { chain: 'f', start: 1200, end: 1500, strand: -1 },
          ]),
        ],
        [1, insert],
      ]),
    )
    expect(fills(after, 0).slice(0, anchorSegs.length)).toEqual(
      fills(before, 0),
    )
  })

  // The honest limit, pinned because it IS reachable and is deliberately not
  // fixed here. Pan the second locus away and the chains it was framing drop to
  // one bucket, so `solveFrames`' freeze applies and they fall back to the frame
  // their own primary gives.
  //
  // That is a colour change with no data change, and the reason to accept it is
  // that the fallback is exactly the answer these reads had before this pass
  // existed: the pass can only CHANGE a chain where cross-locus evidence is on
  // screen, so losing that evidence cannot land the display anywhere it could
  // not already have been. Anything that tried to hold the old frame would have
  // to carry state across fetches, and would then be showing a frame derived
  // from reads that are no longer on screen.
  it('falls back to the primary frame when the evidence pans away', () => {
    const both = fills(consensusChainStrandFrames(bothLoci()), 0)
    const anchorOnly = fills(
      consensusChainStrandFrames(new Map([[0, region(anchorSegs)]])),
      0,
    )
    expect(both).not.toEqual(anchorOnly)
    // every chain back on its own primary's answer, which is what `region`
    // seeds — not some third state
    expect(anchorOnly).toEqual(new Array(anchorSegs.length).fill(FWD))
  })
})
