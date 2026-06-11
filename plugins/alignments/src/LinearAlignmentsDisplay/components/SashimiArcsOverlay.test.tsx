import { sashimiArcKey } from './sashimiArcs.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'

function makeArc(arc: Partial<SashimiArc>): SashimiArc {
  return {
    refName: 'chr1',
    start: 1000,
    end: 2000,
    strand: 1,
    score: 5,
    d: 'M...',
    stroke: 'red',
    strokeWidth: 2,
    ...arc,
  }
}

describe('sashimiArcKey', () => {
  it('keys by stable identity (refName/start/end/strand), not array index', () => {
    const key = sashimiArcKey(makeArc({ start: 1000, end: 2000, strand: 1 }))
    expect(key).toBe('chr1:1000:2000:1')
    expect(key).not.toBe('0')
  })

  it('distinguishes same coordinates in different regions', () => {
    const a = sashimiArcKey(makeArc({ refName: 'chr1' }))
    const b = sashimiArcKey(makeArc({ refName: 'chr2' }))
    expect(a).not.toBe(b)
  })

  it('distinguishes forward/reverse arcs at the same junction', () => {
    const fwd = sashimiArcKey(makeArc({ strand: 1 }))
    const rev = sashimiArcKey(makeArc({ strand: -1 }))
    expect(fwd).not.toBe(rev)
  })
})
