import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import { computePileupBezierArcs } from './computeOverlay.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Minimal PileupDataResult with only the fields computePileupBezierArcs reads.
function makeData(opts: {
  names: string[]
  flags: number[]
  strands: number[]
  positions: number[][]
  ys: number[]
}): PileupDataResult {
  const n = opts.names.length
  const readPositions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    readPositions[i * 2] = opts.positions[i]![0]!
    readPositions[i * 2 + 1] = opts.positions[i]![1]!
  }
  return {
    readNames: opts.names,
    readIds: opts.names.map((_, i) => `id${i}`),
    readFlags: new Uint16Array(opts.flags),
    readStrands: new Int8Array(opts.strands),
    readPositions,
    readPairOrientations: new Uint8Array(n),
    readYs: new Uint16Array(opts.ys),
  } as unknown as PileupDataResult
}

const baseOpts = {
  displayedRegions: [{ refName: 'chr1' }],
  // Identity bp→screen so control-point math is checkable by hand.
  bpToScreenX: (_refName: string, bp: number) => bp,
  featureHeight: 10,
  featureSpacing: 2,
  pileupTopOffset: 0,
  scrollTop: 0,
  viewportH: 1000,
}

// Parse `M sx1 sy1 C cp1x cp1y cp2x cp2y sx2 sy2`.
function controlPoints(d: string) {
  const n = String.raw`[-\d.]+`
  const re = new RegExp(
    `M (${n}) (${n}) C (${n}) (${n}) (${n}) (${n}) (${n}) (${n})`,
  )
  const m = re.exec(d)!
  const [, sx1, sy1, cp1x, , cp2x, , sx2, sy2] = m.map(Number)
  return {
    sx1: sx1!,
    sy1: sy1!,
    cp1x: cp1x!,
    cp2x: cp2x!,
    sx2: sx2!,
    sy2: sy2!,
  }
}

describe('computePileupBezierArcs — split-read tangent direction', () => {
  // Regression guard for the "fix split-read bezier tangent" change: the bezier
  // handles must leave each endpoint along the read's *actual* BAM strand, not
  // the classifier-negated strand. fwd primary → handle heads right; rev
  // supplementary → handle heads left.
  it('fwd+rev split inversion: cp1x right of sx1, cp2x left of sx2', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      ...baseOpts,
      laidOutPileupMap: new Map([[0, data]]),
    })
    expect(arcs).toHaveLength(1)
    const { sx1, cp1x, cp2x, sx2 } = controlPoints(arcs[0]!.d)
    expect(cp1x).toBeGreaterThan(sx1) // s1 = +1 → right
    expect(cp2x).toBeLessThan(sx2) // s2 = -1 → left (the fix)
  })

  it('rev+fwd split inversion: cp1x left of sx1, cp2x right of sx2', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [-1, 1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      ...baseOpts,
      laidOutPileupMap: new Map([[0, data]]),
    })
    expect(arcs).toHaveLength(1)
    const { sx1, cp1x, cp2x, sx2 } = controlPoints(arcs[0]!.d)
    expect(cp1x).toBeLessThan(sx1) // s1 = -1 → left
    expect(cp2x).toBeGreaterThan(sx2) // s2 = +1 → right
  })

  it('emits no NaN coordinates', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      ...baseOpts,
      laidOutPileupMap: new Map([[0, data]]),
    })
    expect(arcs[0]!.d).not.toMatch(/NaN/)
  })
})

describe('computePileupBezierArcs — exclusions', () => {
  // Normal-orientation within-region pairs are drawn by the GPU/Canvas2D
  // straight-line pass, so the bezier overlay must not duplicate them.
  it('excludes normal within-region paired reads', () => {
    const data = makeData({
      names: ['p', 'p'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 0],
    })
    const arcs = computePileupBezierArcs({
      ...baseOpts,
      laidOutPileupMap: new Map([[0, data]]),
    })
    expect(arcs).toHaveLength(0)
  })

  it('skips pairs whose endpoints fall outside the displayed regions', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      ys: [0, 1],
    })
    const arcs = computePileupBezierArcs({
      ...baseOpts,
      laidOutPileupMap: new Map([[0, data]]),
      bpToScreenX: () => undefined,
    })
    expect(arcs).toHaveLength(0)
  })
})
