import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'

import {
  sashimiArcKey,
  sashimiSelectionKey,
  sashimiSideBand,
} from './sashimiArcs.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { SashimiArcSection } from './sashimiArcs.ts'

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
    side: 'up',
    labelX: 1500,
    labelY: 10,
    showLabel: true,
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

describe('sashimiSideBand', () => {
  const section: SashimiArcSection = {
    groupKey: 'sampleA',
    up: [],
    down: [],
    coverageOverlayTop: 200,
    sashimiBandTop: 290,
  }
  const heights = { coverageHeight: 100, sashimiArcsHeight: 40 }

  it('hangs the up band off the coverage histogram, unclipped', () => {
    // The box starts at the histogram top (one y-scalebar offset into the
    // coverage band) and runs to the band's bottom, so a full-height arc has
    // room; unclipped, so it can rise into the top margin.
    expect(sashimiSideBand(section, 'up', heights)).toEqual({
      top: 200,
      height: 100 - YSCALEBAR_LABEL_OFFSET,
      clipped: false,
    })
  })

  it('clips the down band to the strip the layout reserved', () => {
    // Clipping is the load-bearing half: the strip is only as tall as
    // `sashimiArcsHeight`, and the pileup starts immediately below it.
    expect(sashimiSideBand(section, 'down', heights)).toEqual({
      top: 290,
      height: 40,
      clipped: true,
    })
  })
})

describe('sashimiSelectionKey', () => {
  it('scopes the same junction by group so selection does not bleed across groups', () => {
    const arc = makeArc({})
    expect(sashimiSelectionKey('sampleA', arc)).not.toBe(
      sashimiSelectionKey('sampleB', arc),
    )
  })

  it('matches for the same junction within one group (ungrouped key is empty)', () => {
    const arc = makeArc({})
    expect(sashimiSelectionKey('', arc)).toBe(sashimiSelectionKey('', arc))
  })
})
